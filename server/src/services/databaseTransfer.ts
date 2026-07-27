// server/src/services/databaseTransfer.ts
// Whole-database import: replaces every row in the live database with the
// contents of an uploaded SQLite file, in place, without closing or
// restarting the live connection.

import fs from "node:fs";
import path from "node:path";
import type { ServerContext } from "../server/context.js";
import { openDb } from "../lib/db.js";

export type DatabaseImportResult = {
  backupPath: string;
  tablesReplaced: number;
  rowsImported: number;
};

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

function listUserTables(db: ServerContext["db"]): string[] {
  return (db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>).map((row) => row.name);
}

/**
 * Validates an uploaded SQLite file by opening it standalone and running it
 * through the exact same migration pipeline the live database went through
 * (`openDb` is idempotent) — this upgrades older exports to the current
 * schema before anything touches the live database. Rejects the file if it
 * fails an integrity check or has no admin user (a strong signal it is not
 * actually a Beholden export, which would otherwise lock every admin out).
 */
function validateAndPrepareUpload(uploadedFilePath: string): void {
  let staged: ReturnType<typeof openDb>;
  try {
    staged = openDb(uploadedFilePath);
  } catch (cause) {
    throw httpError(400, `Uploaded file is not a readable SQLite database: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  try {
    const integrity = staged.pragma("integrity_check", { simple: true }) as string;
    if (integrity !== "ok") {
      throw httpError(400, `Uploaded database failed an integrity check: ${integrity}`);
    }
    const adminCount = staged.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get() as { n: number };
    if (!adminCount || adminCount.n < 1) {
      throw httpError(400, "Uploaded database has no admin user — refusing to import.");
    }
    staged.pragma("wal_checkpoint(TRUNCATE)");
  } finally {
    staged.close();
  }
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${uploadedFilePath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
}

/**
 * Replaces every row of every table in the live database with the rows from
 * `uploadedFilePath`, inside one transaction. A pre-import snapshot of the
 * live database is written first as a safety net.
 */
export function importDatabaseFile(ctx: ServerContext, uploadedFilePath: string): DatabaseImportResult {
  const { db } = ctx;

  validateAndPrepareUpload(uploadedFilePath);

  const backupDir = path.join(ctx.paths.dataDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `beholden-pre-import-${ctx.helpers.now()}.db`);
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

  const tables = listUserTables(db);
  let rowsImported = 0;

  db.exec(`ATTACH DATABASE '${uploadedFilePath.replace(/'/g, "''")}' AS imported`);
  // FK enforcement can only be toggled outside a transaction, and a
  // table-by-table DELETE+INSERT replace does not respect dependency order —
  // disable it for the duration of the swap. Restored in `finally` so a
  // failed import never leaves the live connection with FKs off.
  db.pragma("foreign_keys = OFF");
  try {
    const runImport = db.transaction(() => {
      for (const table of tables) {
        db.prepare(`DELETE FROM main.${table}`).run();
        const info = db.prepare(`INSERT INTO main.${table} SELECT * FROM imported.${table}`).run();
        rowsImported += info.changes;
      }
    });
    runImport();
  } finally {
    db.pragma("foreign_keys = ON");
    db.exec("DETACH DATABASE imported");
  }
  db.pragma("optimize");

  return { backupPath, tablesReplaced: tables.length, rowsImported };
}
