import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Paths } from "../server/context.js";

export function getPaths({ dataDir, dbPath: dbPathOverride }: { dataDir: string; dbPath?: string }): Paths {
  const dbPath = dbPathOverride ?? path.join(dataDir, "beholden.db");

  ensureDir(dataDir);

  const serverSrcDir = path.dirname(fileURLToPath(import.meta.url));
  const serverRootDir = path.join(serverSrcDir, "..", "..");
  const repoRootDir = path.join(serverRootDir, "..");

  const webDistDir = process.env.BEHOLDEN_WEB_DIST
    ? path.resolve(process.env.BEHOLDEN_WEB_DIST)
    : path.join(repoRootDir, "web-dm", "dist");

  const hasWebDist = fs.existsSync(path.join(webDistDir, "index.html"));

  return {
    dataDir,
    dbPath,
    webDistDir,
    hasWebDist,
    repoRootDir,
  };
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
