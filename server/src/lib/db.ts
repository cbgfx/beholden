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
  player_name TEXT NOT NULL,
  character_name TEXT NOT NULL,
  class TEXT NOT NULL,
  species TEXT NOT NULL,
  level INTEGER NOT NULL,
  hp_max INTEGER NOT NULL,
  hp_current INTEGER NOT NULL,
  ac INTEGER NOT NULL,
  speed INTEGER,
  str INTEGER,
  dex INTEGER,
  con INTEGER,
  int INTEGER,
  wis INTEGER,
  cha INTEGER,
  color TEXT,
  image_url TEXT,
  overrides_json TEXT NOT NULL DEFAULT '{"tempHp":0,"acBonus":0,"hpMaxBonus":0}',
  conditions_json TEXT NOT NULL DEFAULT '[]',
  death_saves_json TEXT,
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
  title TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS treasure (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  adventure_id TEXT,
  source TEXT NOT NULL,
  item_id TEXT,
  name TEXT NOT NULL,
  rarity TEXT,
  type TEXT,
  type_key TEXT,
  attunement INTEGER NOT NULL DEFAULT 0,
  magic INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
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
  name TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  initiative INTEGER,
  friendly INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#cccccc',
  hp_current INTEGER,
  hp_max INTEGER,
  hp_details TEXT,
  ac INTEGER,
  ac_details TEXT,
  sort INTEGER,
  used_reaction INTEGER NOT NULL DEFAULT 0,
  used_legendary_actions INTEGER NOT NULL DEFAULT 0,
  used_legendary_resistances INTEGER NOT NULL DEFAULT 0,
  overrides_json TEXT NOT NULL DEFAULT '{"tempHp":0,"acBonus":0,"hpMaxBonus":0}',
  conditions_json TEXT NOT NULL DEFAULT '[]',
  death_saves_json TEXT,
  used_spell_slots_json TEXT,
  attack_overrides_json TEXT,
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
-- Assigned to campaigns via character_campaigns junction table.
CREATE TABLE IF NOT EXISTS user_characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  player_name TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  species TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  hp_max INTEGER NOT NULL DEFAULT 0,
  hp_current INTEGER NOT NULL DEFAULT 0,
  ac INTEGER NOT NULL DEFAULT 10,
  speed INTEGER NOT NULL DEFAULT 30,
  str_score INTEGER,
  dex_score INTEGER,
  con_score INTEGER,
  int_score INTEGER,
  wis_score INTEGER,
  cha_score INTEGER,
  color TEXT,
  image_url TEXT,
  character_data_json TEXT,
  death_saves_json TEXT,
  shared_notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS character_campaigns (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES user_characters(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id TEXT,
  UNIQUE(character_id, campaign_id)
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
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight REAL,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT,
  item_id TEXT,
  rarity TEXT,
  type TEXT,
  description TEXT,
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
CREATE INDEX IF NOT EXISTS idx_charcamps_char        ON character_campaigns(character_id);
CREATE INDEX IF NOT EXISTS idx_charcamps_campaign    ON character_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_party_inventory_campaign ON party_inventory(campaign_id);
`;

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

export function openDb(dbPath: string): Db {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  // Additive migrations — safe to re-run, ignored if column already exists
  try { db.exec("ALTER TABLE compendium_items ADD COLUMN equippable INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
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
