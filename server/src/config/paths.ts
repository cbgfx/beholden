import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export function getPaths({ dataDir }) {
  const campaignsDir = path.join(dataDir, "campaigns");
  const campaignsIndexPath = path.join(campaignsDir, "index.json");
  const compendiumPath = path.join(dataDir, "compendium.json");

  ensureDir(dataDir);
  ensureDir(campaignsDir);

  const serverSrcDir = path.dirname(fileURLToPath(import.meta.url));
  const serverRootDir = path.join(serverSrcDir, "..", "..");
  const repoRootDir = path.join(serverRootDir, "..");

  const webDistDir = process.env.BEHOLDEN_WEB_DIST
    ? path.resolve(process.env.BEHOLDEN_WEB_DIST)
    : path.join(repoRootDir, "web", "dist");

  const hasWebDist = fs.existsSync(path.join(webDistDir, "index.html"));

  return {
    dataDir,
    compendiumPath,
    campaignsDir,
    campaignsIndexPath,
    webDistDir,
    hasWebDist,
    repoRootDir,
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
