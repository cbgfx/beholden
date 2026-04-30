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
  player_name TEXT NOT NULL DEFAULT '',
  character_name TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  species TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  hp_max INTEGER NOT NULL DEFAULT 10,
  hp_current INTEGER NOT NULL DEFAULT 10,
  ac INTEGER NOT NULL DEFAULT 10,
  speed INTEGER,
  str INTEGER,
  dex INTEGER,
  con INTEGER,
  int INTEGER,
  wis INTEGER,
  cha INTEGER,
  color TEXT,
  synced_ac INTEGER,
  death_saves_success INTEGER,
  death_saves_fail INTEGER,
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
  title TEXT NOT NULL DEFAULT 'Note',
  text TEXT NOT NULL DEFAULT '',
  note_json TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS treasure (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  adventure_id TEXT,
  source TEXT NOT NULL DEFAULT 'custom',
  item_id TEXT,
  name TEXT NOT NULL DEFAULT 'New Item',
  rarity TEXT,
  type TEXT,
  type_key TEXT,
  attunement INTEGER NOT NULL DEFAULT 0,
  magic INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
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

CREATE TABLE IF NOT EXISTS compendium_deck_cards (
  id TEXT PRIMARY KEY,
  deck_name TEXT NOT NULL,
  deck_key TEXT NOT NULL,
  card_name TEXT NOT NULL,
  card_key TEXT,
  card_text TEXT,
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compendium_bastion_spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  squares INTEGER,
  label TEXT,
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compendium_bastion_orders (
  id TEXT PRIMARY KEY,
  order_name TEXT NOT NULL,
  order_key TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compendium_bastion_facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  minimum_level INTEGER NOT NULL DEFAULT 0,
  prerequisite TEXT,
  orders_json TEXT NOT NULL DEFAULT '[]',
  space TEXT,
  hirelings INTEGER,
  allow_multiple INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  data_json TEXT NOT NULL
);

-- Campaign-agnostic player-owned characters (not bound to a campaign).
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
  death_saves_success INTEGER,
  death_saves_fail INTEGER,
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
  name TEXT NOT NULL DEFAULT 'New Item',
  quantity INTEGER NOT NULL DEFAULT 1,
  weight REAL,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT,
  item_id TEXT,
  rarity TEXT,
  type TEXT,
  description TEXT,
  item_json TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bastions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  walled INTEGER NOT NULL DEFAULT 0,
  defenders_armed INTEGER NOT NULL DEFAULT 0,
  defenders_unarmed INTEGER NOT NULL DEFAULT 0,
  assigned_player_ids_json TEXT NOT NULL DEFAULT '[]',
  assigned_character_ids_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  maintain_order INTEGER NOT NULL DEFAULT 0,
  facilities_json TEXT NOT NULL DEFAULT '[]',
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
CREATE INDEX IF NOT EXISTS idx_compdeck_deck         ON compendium_deck_cards(deck_key, sort_index);
CREATE INDEX IF NOT EXISTS idx_compbastion_space_key ON compendium_bastion_spaces(name_key);
CREATE INDEX IF NOT EXISTS idx_compbastion_order_key ON compendium_bastion_orders(order_key);
CREATE INDEX IF NOT EXISTS idx_compbastion_fac_type  ON compendium_bastion_facilities(facility_type, minimum_level);
CREATE INDEX IF NOT EXISTS idx_compbastion_fac_name  ON compendium_bastion_facilities(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_uchars_user           ON user_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_party_inventory_campaign ON party_inventory(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bastions_campaign     ON bastions(campaign_id, updated_at);
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

function parseJsonObject(text: unknown): Record<string, unknown> | null {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toBoolInt(value: unknown): number {
  return value ? 1 : 0;
}

function toSafeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : fallback;
}

function toIntOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toDeathSaves(value: unknown): { success: number; fail: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const success = toIntOrNull(raw.success);
  const fail = toIntOrNull(raw.fail);
  if (success == null || fail == null) return null;
  return {
    success: Math.max(0, Math.min(3, success)),
    fail: Math.max(0, Math.min(3, fail)),
  };
}

function backfillActorColumns(db: Db) {
  const playerRows = db.prepare(`
    SELECT
      id,
      player_name, character_name, class_name, species, level, hp_max, hp_current, ac, speed,
      str, dex, con, int, wis, cha, color, synced_ac, death_saves_success, death_saves_fail,
      sheet_json, live_json
    FROM players
  `).all() as Array<Record<string, unknown>>;
  const updatePlayer = db.prepare(`
    UPDATE players
    SET
      player_name = ?, character_name = ?, class_name = ?, species = ?, level = ?,
      hp_max = ?, hp_current = ?, ac = ?, speed = ?,
      str = ?, dex = ?, con = ?, int = ?, wis = ?, cha = ?,
      color = ?, synced_ac = ?, death_saves_success = ?, death_saves_fail = ?,
      sheet_json = ?, live_json = ?
    WHERE id = ?
  `);

  for (const row of playerRows) {
    const sheetText = String(row.sheet_json ?? "").trim();
    const liveText = String(row.live_json ?? "").trim();
    if ((!sheetText || sheetText === "{}") && (!liveText || liveText === "{}")) continue;
    const sheet = parseJsonObject(row.sheet_json) ?? {};
    const live = parseJsonObject(row.live_json) ?? {};
    const deathSaves = toDeathSaves(live.deathSaves);

    const compactLive: Record<string, unknown> = {};
    if (live.overrides && typeof live.overrides === "object" && !Array.isArray(live.overrides)) {
      compactLive.overrides = live.overrides;
    }
    if (Array.isArray(live.conditions)) {
      compactLive.conditions = live.conditions;
    }

    updatePlayer.run(
      typeof sheet.playerName === "string" ? sheet.playerName : String(row.player_name ?? ""),
      typeof sheet.characterName === "string" ? sheet.characterName : String(row.character_name ?? ""),
      typeof sheet.class === "string" ? sheet.class : String(row.class_name ?? ""),
      typeof sheet.species === "string" ? sheet.species : String(row.species ?? ""),
      toIntOrNull(sheet.level) ?? toIntOrNull(row.level) ?? 1,
      toIntOrNull(sheet.hpMax) ?? toIntOrNull(row.hp_max) ?? 10,
      toIntOrNull(live.hpCurrent) ?? toIntOrNull(row.hp_current) ?? toIntOrNull(sheet.hpMax) ?? 10,
      toIntOrNull(sheet.ac) ?? toIntOrNull(row.ac) ?? 10,
      toIntOrNull(sheet.speed) ?? toIntOrNull(row.speed),
      toIntOrNull(sheet.str) ?? toIntOrNull(row.str),
      toIntOrNull(sheet.dex) ?? toIntOrNull(row.dex),
      toIntOrNull(sheet.con) ?? toIntOrNull(row.con),
      toIntOrNull(sheet.int) ?? toIntOrNull(row.int),
      toIntOrNull(sheet.wis) ?? toIntOrNull(row.wis),
      toIntOrNull(sheet.cha) ?? toIntOrNull(row.cha),
      toStringOrNull(sheet.color) ?? toStringOrNull(row.color),
      toIntOrNull(sheet.syncedAc) ?? toIntOrNull(row.synced_ac),
      deathSaves?.success ?? toIntOrNull(row.death_saves_success),
      deathSaves?.fail ?? toIntOrNull(row.death_saves_fail),
      "{}",
      Object.keys(compactLive).length > 0 ? JSON.stringify(compactLive) : "{}",
      row.id,
    );
  }

  const characterRows = db.prepare(`
    SELECT
      id,
      name, player_name, class_name, species, level, hp_max, hp_current, ac, speed,
      str_score, dex_score, con_score, int_score, wis_score, cha_score, color,
      death_saves_success, death_saves_fail,
      sheet_json
    FROM user_characters
  `).all() as Array<Record<string, unknown>>;
  const updateCharacter = db.prepare(`
    UPDATE user_characters
    SET
      name = ?, player_name = ?, class_name = ?, species = ?, level = ?,
      hp_max = ?, hp_current = ?, ac = ?, speed = ?,
      str_score = ?, dex_score = ?, con_score = ?, int_score = ?, wis_score = ?, cha_score = ?,
      color = ?, death_saves_success = ?, death_saves_fail = ?,
      sheet_json = ?
    WHERE id = ?
  `);

  for (const row of characterRows) {
    const sheetText = String(row.sheet_json ?? "").trim();
    if (!sheetText || sheetText === "{}") continue;
    const sheet = parseJsonObject(row.sheet_json) ?? {};
    const deathSaves = toDeathSaves(sheet.deathSaves);

    updateCharacter.run(
      typeof sheet.name === "string" ? sheet.name : String(row.name ?? ""),
      typeof sheet.playerName === "string" ? sheet.playerName : String(row.player_name ?? ""),
      typeof sheet.className === "string" ? sheet.className : String(row.class_name ?? ""),
      typeof sheet.species === "string" ? sheet.species : String(row.species ?? ""),
      toIntOrNull(sheet.level) ?? toIntOrNull(row.level) ?? 1,
      toIntOrNull(sheet.hpMax) ?? toIntOrNull(row.hp_max) ?? 0,
      toIntOrNull(sheet.hpCurrent) ?? toIntOrNull(row.hp_current) ?? 0,
      toIntOrNull(sheet.ac) ?? toIntOrNull(row.ac) ?? 10,
      toIntOrNull(sheet.speed) ?? toIntOrNull(row.speed) ?? 30,
      toIntOrNull(sheet.strScore) ?? toIntOrNull(row.str_score),
      toIntOrNull(sheet.dexScore) ?? toIntOrNull(row.dex_score),
      toIntOrNull(sheet.conScore) ?? toIntOrNull(row.con_score),
      toIntOrNull(sheet.intScore) ?? toIntOrNull(row.int_score),
      toIntOrNull(sheet.wisScore) ?? toIntOrNull(row.wis_score),
      toIntOrNull(sheet.chaScore) ?? toIntOrNull(row.cha_score),
      toStringOrNull(sheet.color) ?? toStringOrNull(row.color),
      deathSaves?.success ?? toIntOrNull(row.death_saves_success),
      deathSaves?.fail ?? toIntOrNull(row.death_saves_fail),
      "{}",
      row.id,
    );
  }
}

function backfillStructuredContentColumns(db: Db) {
  const notesRows = db.prepare("SELECT id, title, text, note_json FROM notes").all() as Array<{
    id: string;
    title: string;
    text: string;
    note_json: string;
  }>;
  const noteUpdate = db.prepare("UPDATE notes SET title = ?, text = ?, note_json = ? WHERE id = ?");
  for (const row of notesRows) {
    const jsonText = String(row.note_json ?? "").trim();
    if (!jsonText || jsonText === "{}") {
      const inferredTitle = inferNoteTitleFromText(row.text);
      if (row.title === "Note" && inferredTitle) {
        noteUpdate.run(inferredTitle, row.text ?? "", "{}", row.id);
      }
      continue;
    }
    const parsed = parseJsonObject(row.note_json);
    const text = typeof parsed?.text === "string" ? parsed.text : row.text ?? "";
    const title = typeof parsed?.title === "string" && parsed.title.trim()
      ? parsed.title
      : row.title === "Note"
        ? inferNoteTitleFromText(text) ?? row.title
        : row.title;
    noteUpdate.run(title, text, "{}", row.id);
  }

  const treasureRows = db.prepare("SELECT id, entry_json FROM treasure").all() as Array<{ id: string; entry_json: string }>;
  const treasureUpdate = db.prepare(
    "UPDATE treasure SET source = ?, item_id = ?, name = ?, rarity = ?, type = ?, type_key = ?, attunement = ?, magic = ?, text = ?, qty = ?, entry_json = ? WHERE id = ?",
  );
  for (const row of treasureRows) {
    const jsonText = String(row.entry_json ?? "").trim();
    if (!jsonText || jsonText === "{}") continue;
    const parsed = parseJsonObject(row.entry_json);
    const source = parsed?.source === "compendium" ? "compendium" : "custom";
    const itemId = typeof parsed?.itemId === "string" ? parsed.itemId : null;
    const name = typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name : "New Item";
    const rarity = typeof parsed?.rarity === "string" ? parsed.rarity : null;
    const type = typeof parsed?.type === "string" ? parsed.type : null;
    const typeKey = typeof parsed?.type_key === "string"
      ? parsed.type_key
      : typeof parsed?.typeKey === "string"
        ? parsed.typeKey
        : null;
    const attunement = toBoolInt(parsed?.attunement);
    const magic = toBoolInt(parsed?.magic);
    const text = typeof parsed?.text === "string" ? parsed.text : "";
    const qty = toSafeInt(parsed?.qty, 1);
    treasureUpdate.run(source, itemId, name, rarity, type, typeKey, attunement, magic, text, qty, "{}", row.id);
  }

  const partyRows = db.prepare("SELECT id, item_json FROM party_inventory").all() as Array<{ id: string; item_json: string }>;
  const partyUpdate = db.prepare(
    "UPDATE party_inventory SET name = ?, quantity = ?, weight = ?, notes = ?, source = ?, item_id = ?, rarity = ?, type = ?, description = ?, item_json = ? WHERE id = ?",
  );
  for (const row of partyRows) {
    const jsonText = String(row.item_json ?? "").trim();
    if (!jsonText || jsonText === "{}") continue;
    const parsed = parseJsonObject(row.item_json);
    const name = typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name : "New Item";
    const quantity = toSafeInt(parsed?.quantity, 1);
    const weight = typeof parsed?.weight === "number" ? parsed.weight : null;
    const notes = typeof parsed?.notes === "string" ? parsed.notes : "";
    const source = typeof parsed?.source === "string" ? parsed.source : null;
    const itemId = typeof parsed?.itemId === "string" ? parsed.itemId : null;
    const rarity = typeof parsed?.rarity === "string" ? parsed.rarity : null;
    const type = typeof parsed?.type === "string" ? parsed.type : null;
    const description = typeof parsed?.description === "string" ? parsed.description : null;
    partyUpdate.run(name, quantity, weight, notes, source, itemId, rarity, type, description, "{}", row.id);
  }
}

function inferNoteTitleFromText(text: unknown): string | null {
  if (typeof text !== "string" || !text.trim()) return null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const title = (heading?.[1] ?? line).trim();
    return title || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Utility: next sort value
// ---------------------------------------------------------------------------

/** Returns max(sort)+1 for rows in a table matching a given column/value. */
export function nextSortFor(db: Db, table: string, col: string, val: string): number {
  const row = db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ${table} WHERE ${col} = ?`).get(val) as { n: number };
  return row.n;
}
