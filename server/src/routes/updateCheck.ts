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
const REQUEST_TIMEOUT_MS = 5_000;

interface CacheEntry {
  latestVersion: string;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<string> | null = null;

const CURRENT_VERSION = (() => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(__dirname, "../../package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version: string };
  return pkg.version;
})();

async function getLatestVersion(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.latestVersion;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(GITHUB_RAW_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);
      const pkg = (await res.json()) as { version?: unknown };
      const latestVersion = typeof pkg.version === "string" ? pkg.version.trim() : "";
      if (!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(latestVersion)) {
        throw new Error("GitHub returned an invalid version");
      }
      cache = { latestVersion, fetchedAt: Date.now() };
      return latestVersion;
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

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const parts = v.replace(/[-+].*$/, "").split(".").map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };
  const [lMaj, lMin, lPat] = parse(latest);
  const [cMaj, cMin, cPat] = parse(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

export function registerUpdateCheckRoutes(app: Express, _ctx: ServerContext) {
  app.get("/api/update-check", async (_req, res) => {
    try {
      const currentVersion = CURRENT_VERSION;
      const latestVersion = await getLatestVersion();
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
