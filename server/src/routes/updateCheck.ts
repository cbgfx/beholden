import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { requireAdmin } from "../middleware/auth.js";

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/cbgfx/beholden/main/server/package.json";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

interface CacheEntry {
  latestVersion: string | null;
  fetchedAt: number;
  ttlMs: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<string | null> | null = null;

const CURRENT_VERSION = (() => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(__dirname, "../../package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version: string };
  return pkg.version;
})();

export async function getLatestVersion(options: {
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
} = {}): Promise<string | null> {
  const now = options.now?.() ?? Date.now();
  if (cache && now - cache.fetchedAt < cache.ttlMs) {
    return cache.latestVersion;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    try {
      const res = await (options.fetchImpl ?? fetch)(GITHUB_RAW_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);
      const pkg = (await res.json()) as { version?: unknown };
      const latestVersion = typeof pkg.version === "string" ? pkg.version.trim() : "";
      if (!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(latestVersion)) {
        throw new Error("GitHub returned an invalid version");
      }
      cache = { latestVersion, fetchedAt: options.now?.() ?? Date.now(), ttlMs: CACHE_TTL_MS };
      return latestVersion;
    } catch {
      cache = { latestVersion: null, fetchedAt: options.now?.() ?? Date.now(), ttlMs: FAILURE_CACHE_TTL_MS };
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): { core: [number, number, number]; prerelease: string[] } => {
    const withoutBuild = v.split("+", 1)[0] ?? v;
    const [corePart = "0.0.0", prereleasePart] = withoutBuild.split("-", 2);
    const parts = corePart.split(".").map(Number);
    return {
      core: [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0],
      prerelease: prereleasePart ? prereleasePart.split(".") : [],
    };
  };
  const latestVersion = parse(latest);
  const currentVersion = parse(current);
  for (let index = 0; index < latestVersion.core.length; index += 1) {
    if (latestVersion.core[index] !== currentVersion.core[index]) {
      return latestVersion.core[index]! > currentVersion.core[index]!;
    }
  }
  if (latestVersion.prerelease.length === 0) return currentVersion.prerelease.length > 0;
  if (currentVersion.prerelease.length === 0) return false;
  const count = Math.max(latestVersion.prerelease.length, currentVersion.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    const latestIdentifier = latestVersion.prerelease[index];
    const currentIdentifier = currentVersion.prerelease[index];
    if (latestIdentifier === undefined) return false;
    if (currentIdentifier === undefined) return true;
    if (latestIdentifier === currentIdentifier) continue;
    const latestNumber = /^\d+$/.test(latestIdentifier) ? Number(latestIdentifier) : null;
    const currentNumber = /^\d+$/.test(currentIdentifier) ? Number(currentIdentifier) : null;
    if (latestNumber !== null && currentNumber !== null) return latestNumber > currentNumber;
    if (latestNumber !== null) return false;
    if (currentNumber !== null) return true;
    return latestIdentifier > currentIdentifier;
  }
  return false;
}

export function registerUpdateCheckRoutes(app: Express, _ctx: ServerContext) {
  app.get("/api/update-check", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const currentVersion = CURRENT_VERSION;
      const latestVersion = await getLatestVersion();
      if (!latestVersion) return res.json({ ok: false, currentVersion, updateAvailable: false });
      res.json({
        ok: true,
        currentVersion,
        latestVersion,
        updateAvailable: isNewer(latestVersion, currentVersion),
      });
    } catch {
      // Silently fail — don't block users if GitHub is unreachable
      res.json({ ok: false, currentVersion: CURRENT_VERSION, updateAvailable: false });
    }
  });

  app.post("/api/update", requireAdmin, (_req, res) => {
    if (process.platform !== "win32") {
      return res.status(501).json({ ok: false, message: "The automatic updater is only available on Windows." });
    }

    const scriptPath = path.join(_ctx.paths.repoRootDir, "update-beholden.bat");
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ ok: false, message: "The updater script is missing." });
    }

    try {
      const child = spawn("cmd.exe", ["/d", "/s", "/c", scriptPath], {
        cwd: _ctx.paths.repoRootDir,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
      return res.status(202).json({
        ok: true,
        message: "Update started. Restart Beholden after the updater finishes.",
      });
    } catch {
      return res.status(500).json({ ok: false, message: "Could not start the updater." });
    }
  });
}

export function resetUpdateCheckCacheForTests(): void {
  cache = null;
  inFlight = null;
}
