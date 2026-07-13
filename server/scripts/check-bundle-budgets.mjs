#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..", "..");
const targets = [
  { name: "DM", dist: path.join(root, "web-dm", "dist"), budgetKiB: 160 },
  { name: "Player", dist: path.join(root, "web-player", "dist"), budgetKiB: 170 },
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
}
