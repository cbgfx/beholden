#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..", "..");
const targets = [
  { name: "DM", dist: path.join(root, "web-dm", "dist"), budgetKiB: 185 },
  { name: "Player", dist: path.join(root, "web-player", "dist"), budgetKiB: 190 },
];

for (const target of targets) {
  const html = fs.readFileSync(path.join(target.dist, "index.html"), "utf8");
  const assets = new Set(
    [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((match) => match[1]),
  );
  let gzipBytes = 0;
  for (const asset of assets) {
    const relative = asset.replace(/^\//, "").replace(/^player\//, "");
    gzipBytes += gzipSync(fs.readFileSync(path.join(target.dist, relative))).byteLength;
  }
  const actualKiB = gzipBytes / 1024;
  if (actualKiB > target.budgetKiB) {
    throw new Error(`${target.name} initial JS is ${actualKiB.toFixed(2)} KiB gzip; budget is ${target.budgetKiB} KiB`);
  }
  console.log(`ok: ${target.name} initial JS ${actualKiB.toFixed(2)} KiB gzip (budget ${target.budgetKiB} KiB)`);
  // Translation assets must remain on demand. One cacheable chunk per language avoids
  // a request for each translated feature and keeps English startup independent of French.
  const localeAssets = fs.readdirSync(path.join(target.dist, "assets")).filter((name) => /^locale-fr-.*\.js$/.test(name));
  if (localeAssets.length !== 1) throw new Error(`${target.name} must emit one French language chunk`);
  for (const name of localeAssets) {
    if ([...assets].some((asset) => asset.endsWith(name))) throw new Error(`${target.name} eagerly loads French translations`);
    const localeKiB = gzipSync(fs.readFileSync(path.join(target.dist, "assets", name))).byteLength / 1024;
    if (localeKiB > 45) throw new Error(`${target.name} French language chunk exceeds 45 KiB gzip (${localeKiB.toFixed(2)})`);
    console.log(`ok: ${target.name} French language chunk ${localeKiB.toFixed(2)} KiB gzip (on demand, budget 45 KiB)`);
  }
}
