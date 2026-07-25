import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
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

function formatMiB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
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
  const pageSize = Number(db.pragma("page_size", { simple: true }));
  const pageCount = Number(db.pragma("page_count", { simple: true }));
  const freePages = Number(db.pragma("freelist_count", { simple: true }));
  const reclaimableBytes = pageSize * freePages;

  console.log(`[beholden] Database: ${paths.dbPath}`);
  console.log(`[beholden] Main file: ${formatMiB(fileSize(paths.dbPath))}`);
  console.log(`[beholden] WAL file: ${formatMiB(fileSize(`${paths.dbPath}-wal`))}`);
  console.log(`[beholden] Reclaimable main-file space: ${formatMiB(reclaimableBytes)} (${freePages}/${pageCount} pages)`);

  if (!execute) {
    console.log("[beholden] Dry run only. Stop the server, then add --execute to checkpoint and VACUUM.");
    process.exitCode = 0;
  } else {
    console.log("[beholden] Checkpointing WAL...");
    db.pragma("wal_checkpoint(TRUNCATE)");
    console.log("[beholden] Rewriting database with VACUUM...");
    db.exec("VACUUM");
    db.pragma("optimize");
    db.pragma("journal_size_limit = 16777216");
    console.log(`[beholden] Complete. Main file: ${formatMiB(fileSize(paths.dbPath))}; WAL: ${formatMiB(fileSize(`${paths.dbPath}-wal`))}`);
  }
} finally {
  db.close();
}
