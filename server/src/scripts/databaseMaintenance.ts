import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { deleteOrphanImages, findOrphanImages } from "../services/images/orphanImages.js";
import { checkCombatIntegrity } from "../services/combat.removal.js";
import { scanJsonReferences } from "../services/maintenance/jsonReferences.js";
import { compactDatabase, formatMiB, reclaimableBytes } from "../services/maintenance/startupMaintenance.js";
import dotenv from "dotenv";
import { getRuntimeConfig } from "../config/runtime.js";
import { getPaths } from "../config/paths.js";

function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) dotenv.config({ path: found });
}

function fileSize(file: string): number {
  return fs.existsSync(file) ? fs.statSync(file).size : 0;
}

loadEnv();
const runtime = getRuntimeConfig();
const paths = getPaths({
  dataDir: runtime.dataDir,
  ...(runtime.dbPath != null ? { dbPath: runtime.dbPath } : {}),
});
const execute = process.argv.includes("--execute");
const db = new Database(paths.dbPath);

try {
  db.pragma("busy_timeout = 5000");
  const pageCount = Number(db.pragma("page_count", { simple: true }));
  const freePages = Number(db.pragma("freelist_count", { simple: true }));
  const reclaimable = reclaimableBytes(db);

  console.log(`[beholden] Database: ${paths.dbPath}`);
  console.log(`[beholden] Main file: ${formatMiB(fileSize(paths.dbPath))}`);
  console.log(`[beholden] WAL file: ${formatMiB(fileSize(`${paths.dbPath}-wal`))}`);
  console.log(`[beholden] Reclaimable main-file space: ${formatMiB(reclaimable)} (${freePages}/${pageCount} pages)`);

  // Image files whose row is gone (a deleted character took its player rows with it, say).
  const orphanImages = findOrphanImages(db, paths.dataDir);
  const orphanImageBytes = orphanImages.reduce((total, image) => total + image.bytes, 0);
  console.log(`[beholden] Orphaned image files: ${orphanImages.length} (${formatMiB(orphanImageBytes)})`);

  // Combat references that point at nothing (see checkCombatIntegrity).
  const combat = checkCombatIntegrity(db, () => {}, { repair: false });
  console.log(`[beholden] Orphaned combatants: ${combat.orphanedCombatants}; `
    + `conditions whose caster left: ${combat.strandedCasterConditions}; `
    + `turns pointing at nobody: ${combat.danglingTurnPointers}`);

  // References stored inside JSON, which the schema guard cannot see. Report only.
  const json = scanJsonReferences(db);
  for (const check of json.checks) {
    if (check.dangling > 0) console.log(`[beholden] ${check.reference}: ${check.dangling} of ${check.checked} point at nothing (${check.effect})`);
  }
  if (json.unclassified.length > 0) {
    console.log(`[beholden] Unclassified id-like keys in stored JSON: ${json.unclassified.join(", ")}. `
      + "Each is either a reference (add a check in services/maintenance/jsonReferences.ts) or not (add it to NOT_REFERENCES).");
  }

  if (!execute) {
    console.log("[beholden] Dry run only. Stop the server, then add --execute to checkpoint, VACUUM and delete what is listed above.");
    console.log("[beholden] (The server also does both for itself at startup; this script is for running it on demand.)");
    process.exitCode = 0;
  } else {
    if (orphanImages.length > 0) {
      console.log(`[beholden] Deleting ${orphanImages.length} orphaned image file(s)...`);
      console.log(`[beholden] Deleted ${deleteOrphanImages(orphanImages)} file(s).`);
    }
    checkCombatIntegrity(db, () => {}, { repair: true });
    console.log("[beholden] Checkpointing WAL and rewriting the database with VACUUM...");
    compactDatabase(db);
    console.log(`[beholden] Complete. Main file: ${formatMiB(fileSize(paths.dbPath))}; WAL: ${formatMiB(fileSize(`${paths.dbPath}-wal`))}`);
  }
} finally {
  db.close();
}
