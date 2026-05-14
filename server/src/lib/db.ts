import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./dbSchema.js";
import { backfillActorColumns, backfillStructuredContentColumns } from "./dbMigrations.js";

export type Db = Database.Database;

// Re-export columns and converters so existing import sites don't need to change.
export * from "./dbColumns.js";
export * from "./dbConverters.js";

export function openDb(dbPath: string): Db {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const tableExists = (table: string) =>
    Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
  const hasColumn = (table: string, column: string) =>
    tableExists(table) &&
    (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((r) => r.name === column);
  const needsActorReset =
    (tableExists("players") && (!hasColumn("players", "sheet_json") || !hasColumn("players", "live_json"))) ||
    (tableExists("user_characters") && !hasColumn("user_characters", "sheet_json")) ||
    (tableExists("combatants") && (!hasColumn("combatants", "snapshot_json") || !hasColumn("combatants", "live_json"))) ||
    tableExists("character_campaigns");
  const needsContentReset =
    (tableExists("notes") && !hasColumn("notes", "note_json")) ||
    (tableExists("treasure") && !hasColumn("treasure", "entry_json")) ||
    (tableExists("party_inventory") && !hasColumn("party_inventory", "item_json"));
  if (needsActorReset) {
    db.exec(`
      DROP TABLE IF EXISTS combatants;
      DROP TABLE IF EXISTS character_campaigns;
      DROP TABLE IF EXISTS players;
      DROP TABLE IF EXISTS user_characters;
    `);
  }
  if (needsContentReset) {
    db.exec(`
      DROP TABLE IF EXISTS notes;
      DROP TABLE IF EXISTS treasure;
      DROP TABLE IF EXISTS party_inventory;
    `);
  }
  db.exec(SCHEMA_SQL);
  // Additive migrations — safe to re-run, ignored if column already exists
  try { db.exec("ALTER TABLE compendium_items ADD COLUMN equippable INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE compendium_items ADD COLUMN weight REAL"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE compendium_items ADD COLUMN value REAL"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE compendium_items ADD COLUMN proficiency TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE bastions ADD COLUMN walled INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE bastions ADD COLUMN defenders_armed INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE bastions ADD COLUMN defenders_unarmed INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT 'Note'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE notes ADD COLUMN text TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN player_name TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN character_name TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN class_name TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN species TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN level INTEGER NOT NULL DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN hp_max INTEGER NOT NULL DEFAULT 10"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN hp_current INTEGER NOT NULL DEFAULT 10"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN ac INTEGER NOT NULL DEFAULT 10"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN speed INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN str INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN dex INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN con INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN int INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN wis INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN cha INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN color TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN synced_ac INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN death_saves_success INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN death_saves_fail INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN name TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN player_name TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN class_name TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN species TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN level INTEGER NOT NULL DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN hp_max INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN hp_current INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN ac INTEGER NOT NULL DEFAULT 10"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN speed INTEGER NOT NULL DEFAULT 30"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN str_score INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN dex_score INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN con_score INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN int_score INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN wis_score INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN cha_score INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN color TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN death_saves_success INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE user_characters ADD COLUMN death_saves_fail INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN source TEXT NOT NULL DEFAULT 'custom'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN item_id TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN name TEXT NOT NULL DEFAULT 'New Item'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN rarity TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN type TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN type_key TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN attunement INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN magic INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN text TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE treasure ADD COLUMN qty INTEGER NOT NULL DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN name TEXT NOT NULL DEFAULT 'New Item'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN weight REAL"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN notes TEXT NOT NULL DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN source TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN item_id TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN rarity TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN type TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE party_inventory ADD COLUMN description TEXT"); } catch { /* already exists */ }
  backfillActorColumns(db);
  backfillStructuredContentColumns(db);
  return db;
}

/** Returns max(sort)+1 for rows in a table matching a given column/value. */
export function nextSortFor(db: Db, table: string, col: string, val: string): number {
  const row = db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ${table} WHERE ${col} = ?`).get(val) as { n: number };
  return row.n;
}
