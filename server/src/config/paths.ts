import path from "node:path";
import fs from "node:fs";
import { repoRootDir } from "./installation.js";
import type { Paths } from "../server/context.js";

export function getPaths({ dataDir, dbPath: dbPathOverride }: { dataDir: string; dbPath?: string }): Paths {
  const dbPath = dbPathOverride ?? path.join(dataDir, "beholden.db");

  ensureDir(dataDir);

  const webDistDir = process.env.BEHOLDEN_WEB_DIST
    ? path.resolve(process.env.BEHOLDEN_WEB_DIST)
    : path.join(repoRootDir, "web-dm", "dist");

  const hasWebDist = fs.existsSync(path.join(webDistDir, "index.html"));

  const webPlayerDistDir = process.env.BEHOLDEN_WEB_PLAYER_DIST
    ? path.resolve(process.env.BEHOLDEN_WEB_PLAYER_DIST)
    : path.join(repoRootDir, "web-player", "dist");

  const hasWebPlayerDist = fs.existsSync(path.join(webPlayerDistDir, "index.html"));

  return {
    dataDir,
    dbPath,
    webDistDir,
    hasWebDist,
    webPlayerDistDir,
    hasWebPlayerDist,
    repoRootDir,
  };
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
