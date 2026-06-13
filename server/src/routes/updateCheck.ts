import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/cbgfx/beholden/main/server/package.json";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  latestVersion: string;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

function getCurrentVersion(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(__dirname, "../../package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version: string };
  return pkg.version;
}

async function getLatestVersion(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.latestVersion;
  }
  const res = await fetch(GITHUB_RAW_URL);
  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);
  const pkg = (await res.json()) as { version: string };
  cache = { latestVersion: pkg.version, fetchedAt: now };
  return pkg.version;
}

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const parts = v.split(".").map(Number);
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
      const currentVersion = getCurrentVersion();
      const latestVersion = await getLatestVersion();
      res.json({
        ok: true,
        currentVersion,
        latestVersion,
        updateAvailable: isNewer(latestVersion, currentVersion),
      });
    } catch {
      // Silently fail — don't block users if GitHub is unreachable
      res.json({ ok: false, updateAvailable: false });
    }
  });
}
