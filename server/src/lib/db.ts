import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./dbSchema.js";
import { syncCharacterDerivedColumns } from "./dbCharacterSync.js";
import { normalizeLegacyCompendiumEffectKinds } from "./compendiumLegacyKindMigration.js";
import { extractMonsterTreasureTraits } from "./monsterTreasureMigration.js";
import { ensureTreasureEncounterColumn } from "./treasureEncounterColumnMigration.js";
import { ensureUserLastLoginColumn } from "./userLastLoginColumnMigration.js";
import { ensureImageVersionColumns } from "./imageVersionColumnMigration.js";
import { displayNoteTitle } from "./dbConverters.js";

export type Db = Database.Database;

// Re-export columns and converters so existing import sites don't need to change.
export * from "./dbColumns.js";
export * from "./dbConverters.js";

export function openDb(dbPath: string): Db {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("journal_size_limit = 16777216");
  db.exec(SCHEMA_SQL);
  ensureTreasureEncounterColumn(db);
  ensureUserLastLoginColumn(db);
  ensureImageVersionColumns(db);
  db.function("note_display_title", { deterministic: true }, displayNoteTitle);

  // Linked campaign rows are projections of canonical character sheets.
  syncCharacterDerivedColumns(db);
  normalizeLegacyCompendiumEffectKinds(db);
  extractMonsterTreasureTraits(db);
  db.pragma("optimize");
  return db;
}

const NEXT_SORT_ALLOWLIST = new Set([
  "adventures|campaign_id",
  "encounters|adventure_id",
  "notes|campaign_id",
  "notes|adventure_id",
  "treasure|campaign_id",
  "treasure|adventure_id",
  "treasure|encounter_id",
]);

/** Returns max(sort)+1 for rows in a table matching a given column/value. */
export function nextSortFor(db: Db, table: string, col: string, val: string): number {
  if (!NEXT_SORT_ALLOWLIST.has(`${table}|${col}`)) {
    throw new Error(`nextSortFor: disallowed table/column pair: ${table}.${col}`);
  }
  const row = db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ${table} WHERE ${col} = ?`).get(val) as { n: number };
  return row.n;
}
