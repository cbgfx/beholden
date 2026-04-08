// server/src/lib/db.ts
// Opens the SQLite database, runs schema DDL, and re-exports columns + converters.

import Database from "better-sqlite3";

export type Db = Database.Database;

// Re-export columns and converters so existing import sites don't need to change.
export * from "./dbColumns.js";
export * from "./dbConverters.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  image_url TEXT,
  shared_notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS adventures (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  adventure_id TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  sort INTEGER,
  combat_round INTEGER,
  combat_active_combatant_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  character_id TEXT REFERENCES user_characters(id) ON DELETE SET NULL,
  sheet_json TEXT NOT NULL,
  live_json TEXT NOT NULL,
  image_url TEXT,
  shared_notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inpcs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  monster_id TEXT NOT NULL,
  name TEXT NOT NULL,
  label TEXT,
  friendly INTEGER NOT NULL DEFAULT 1,
  hp_max INTEGER NOT NULL,
  hp_current INTEGER NOT NULL,
  hp_details TEXT,
  ac INTEGER NOT NULL,
  ac_details TEXT,
  sort INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  adventure_id TEXT,
  note_json TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS treasure (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  adventure_id TEXT,
  entry_json TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conditions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS combats (
  encounter_id TEXT PRIMARY KEY REFERENCES encounters(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  active_index INTEGER NOT NULL DEFAULT 0,
  active_combatant_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS combatants (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  base_type TEXT NOT NULL,
  base_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  live_json TEXT NOT NULL,
  sort INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Compendium: full normalized data stored as a JSON blob per row.
-- Scalar columns allow efficient SQL filtering without JSON parsing.
CREATE TABLE IF NOT EXISTS compendium_monsters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT,
  cr TEXT,
  cr_numeric REAL,
  type_key TEXT,
  type_full TEXT,
  size TEXT,
  environment TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compendium_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT,
  rarity TEXT,
  type TEXT,
  type_key TEXT,
  attunement INTEGER NOT NULL DEFAULT 0,
  magic INTEGER NOT NULL DEFAULT 0,
  equippable INTEGER NOT NULL DEFAULT 0,
  weight REAL,
  value REAL,
  proficiency TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compendium_spells (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT,
  level INTEGER,
  school TEXT,
  ritual INTEGER NOT NULL DEFAULT 0,
  concentration INTEGER NOT NULL DEFAULT 0,
  components TEXT,
  classes TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compendium_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT,
  hd INTEGER,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compendium_races (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT,
  size TEXT,
  speed INTEGER,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compendium_backgrounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compendium_feats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT,
  data_json TEXT NOT NULL
);

-- Campaign-agnostic player-owned characters (not bound to a campaign).
CREATE TABLE IF NOT EXISTS user_characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sheet_json TEXT NOT NULL,
  image_url TEXT,
  character_data_json TEXT,
  shared_notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  passhash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_membership (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('dm', 'player')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS party_inventory (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  item_json TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_adventures_campaign   ON adventures(campaign_id);
CREATE INDEX IF NOT EXISTS idx_encounters_adventure  ON encounters(adventure_id);
CREATE INDEX IF NOT EXISTS idx_encounters_campaign   ON encounters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inpcs_campaign        ON inpcs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notes_campaign        ON notes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_treasure_campaign     ON treasure(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conditions_campaign   ON conditions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_combatants_encounter  ON combatants(encounter_id);
CREATE INDEX IF NOT EXISTS idx_membership_campaign   ON campaign_membership(campaign_id);
CREATE INDEX IF NOT EXISTS idx_membership_user       ON campaign_membership(user_id);
CREATE INDEX IF NOT EXISTS idx_players_user          ON players(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_campaign_character ON players(campaign_id, character_id) WHERE character_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compmon_name          ON compendium_monsters(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_compmon_typekey       ON compendium_monsters(type_key);
CREATE INDEX IF NOT EXISTS idx_compmon_size          ON compendium_monsters(size);
CREATE INDEX IF NOT EXISTS idx_compmon_cr            ON compendium_monsters(cr_numeric);
CREATE INDEX IF NOT EXISTS idx_compitem_name         ON compendium_items(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_compspell_name        ON compendium_spells(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_compspell_level       ON compendium_spells(level);
CREATE INDEX IF NOT EXISTS idx_compclass_name        ON compendium_classes(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_comprace_name         ON compendium_races(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_compbg_name           ON compendium_backgrounds(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_compfeat_name         ON compendium_feats(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_uchars_user           ON user_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_party_inventory_campaign ON party_inventory(campaign_id);
`;

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

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
  return db;
}

// ---------------------------------------------------------------------------
// Utility: next sort value
// ---------------------------------------------------------------------------

/** Returns max(sort)+1 for rows in a table matching a given column/value. */
export function nextSortFor(db: Db, table: string, col: string, val: string): number {
  const row = db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ${table} WHERE ${col} = ?`).get(val) as { n: number };
  return row.n;
}
