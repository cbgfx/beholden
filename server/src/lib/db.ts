import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./dbSchema.js";
import {
  backfillActorColumns,
  backfillStructuredContentColumns,
} from "./dbMigrations.js";
import { syncCharacterDerivedColumns } from "./dbCharacterSync.js";
import { columnExists, runSchemaMigrations } from "./dbSchemaMigrations.js";

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

  // Import legacy JSON mirrors once, before the versioned cleanup removes them.
  const actorsMigrated = db.prepare("SELECT value FROM db_meta WHERE key = 'actors_migrated'").get();
  if (!actorsMigrated) {
    if (columnExists(db, "players", "sheet_json") && columnExists(db, "user_characters", "sheet_json")) {
      backfillActorColumns(db);
    }
    db.prepare("INSERT OR REPLACE INTO db_meta (key, value) VALUES ('actors_migrated', '1')").run();
  }

  const contentMigrated = db.prepare("SELECT value FROM db_meta WHERE key = 'content_migrated'").get();
  if (!contentMigrated) {
    if (
      columnExists(db, "notes", "note_json")
      && columnExists(db, "treasure", "entry_json")
      && columnExists(db, "party_inventory", "item_json")
    ) {
      backfillStructuredContentColumns(db);
    }
    db.prepare("INSERT OR REPLACE INTO db_meta (key, value) VALUES ('content_migrated', '1')").run();
  }

  runSchemaMigrations(db);

  // Linked campaign rows are projections of canonical character sheets.
  syncCharacterDerivedColumns(db);
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
]);

/** Returns max(sort)+1 for rows in a table matching a given column/value. */
export function nextSortFor(db: Db, table: string, col: string, val: string): number {
  if (!NEXT_SORT_ALLOWLIST.has(`${table}|${col}`)) {
    throw new Error(`nextSortFor: disallowed table/column pair: ${table}.${col}`);
  }
  const row = db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ${table} WHERE ${col} = ?`).get(val) as { n: number };
  return row.n;
}
