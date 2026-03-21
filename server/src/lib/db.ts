// server/src/lib/db.ts
// Opens the SQLite database, runs schema DDL, and exports row-to-domain converters.

import Database from "better-sqlite3";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "./defaults.js";
import type {
  StoredCampaign,
  StoredAdventure,
  StoredEncounter,
  StoredPlayer,
  StoredINpc,
  StoredNote,
  StoredTreasure,
  StoredCondition,
  StoredCombatant,
  StoredCombatantBaseType,
  StoredCharacter,
  StoredUserCharacter,
} from "../server/userData.js";

export type Db = Database.Database;

// ---------------------------------------------------------------------------
// SQL column constants — single source of truth for SELECT column lists.
// Use as: db.prepare(`SELECT ${COLS} FROM table WHERE ...`)
// ---------------------------------------------------------------------------

export const ADVENTURE_COLS =
  "id, campaign_id, name, status, sort, created_at, updated_at";

export const ENCOUNTER_COLS =
  "id, campaign_id, adventure_id, name, status, sort, " +
  "combat_round, combat_active_combatant_id, created_at, updated_at";

export const PLAYER_COLS =
  "id, campaign_id, user_id, player_name, character_name, class, species, level, " +
  "hp_max, hp_current, ac, speed, str, dex, con, int, wis, cha, color, image_url, " +
  "overrides_json, conditions_json, death_saves_json, created_at, updated_at";

export const USER_CHARACTER_COLS =
  "id, user_id, name, player_name, class_name, species, level, " +
  "hp_max, hp_current, ac, speed, str_score, dex_score, con_score, " +
  "int_score, wis_score, cha_score, color, image_url, character_data_json, " +
  "death_saves_json, created_at, updated_at";

export const INPC_COLS =
  "id, campaign_id, monster_id, name, label, friendly, " +
  "hp_max, hp_current, hp_details, ac, ac_details, sort, created_at, updated_at";

export const NOTE_COLS =
  "id, campaign_id, adventure_id, title, text, sort, created_at, updated_at";

export const TREASURE_COLS =
  "id, campaign_id, adventure_id, source, item_id, name, rarity, type, type_key, " +
  "attunement, magic, text, qty, sort, created_at, updated_at";

export const CONDITION_COLS =
  "id, campaign_id, key, name, description, sort, created_at, updated_at";

export const CHARACTER_COLS =
  "id, user_id, campaign_id, name, class_name, species, level, " +
  "hp_max, hp_current, temp_hp, ac, speed, " +
  "str_score, dex_score, con_score, int_score, wis_score, cha_score, " +
  "notes, created_at, updated_at";

export const COMBATANT_COLS =
  "id, encounter_id, base_type, base_id, name, label, initiative, friendly, " +
  "color, hp_current, hp_max, hp_details, ac, ac_details, sort, used_reaction, " +
  "used_legendary_actions, used_legendary_resistances, overrides_json, " +
  "conditions_json, death_saves_json, used_spell_slots_json, " +
  "attack_overrides_json, created_at, updated_at";

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
  player_name TEXT NOT NULL,
  character_name TEXT NOT NULL,
  class TEXT NOT NULL,
  species TEXT NOT NULL,
  level INTEGER NOT NULL,
  hp_max INTEGER NOT NULL,
  hp_current INTEGER NOT NULL,
  ac INTEGER NOT NULL,
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

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_name TEXT NOT NULL DEFAULT '',
  species TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  hp_max INTEGER NOT NULL DEFAULT 1,
  hp_current INTEGER NOT NULL DEFAULT 1,
  temp_hp INTEGER NOT NULL DEFAULT 0,
  ac INTEGER NOT NULL DEFAULT 10,
  speed INTEGER NOT NULL DEFAULT 30,
  str_score INTEGER NOT NULL DEFAULT 10,
  dex_score INTEGER NOT NULL DEFAULT 10,
  con_score INTEGER NOT NULL DEFAULT 10,
  int_score INTEGER NOT NULL DEFAULT 10,
  wis_score INTEGER NOT NULL DEFAULT 10,
  cha_score INTEGER NOT NULL DEFAULT 10,
  notes TEXT NOT NULL DEFAULT '',
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
CREATE INDEX IF NOT EXISTS idx_characters_campaign   ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_membership_campaign   ON campaign_membership(campaign_id);
CREATE INDEX IF NOT EXISTS idx_membership_user       ON campaign_membership(user_id);
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
`;

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

export function openDb(dbPath: string): Db {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  runMigrations(db);
  return db;
}

function runMigrations(db: Db): void {
  // Add image_url to players if missing (existing databases).
  const playerCols = (db.pragma("table_info(players)") as { name: string }[]).map((c) => c.name);
  if (!playerCols.includes("image_url")) {
    db.exec("ALTER TABLE players ADD COLUMN image_url TEXT");
  }

  // Add new spell filter columns if missing (existing databases).
  const spellCols = (db.pragma("table_info(compendium_spells)") as { name: string }[]).map((c) => c.name);
  if (!spellCols.includes("ritual"))        db.exec("ALTER TABLE compendium_spells ADD COLUMN ritual INTEGER NOT NULL DEFAULT 0");
  if (!spellCols.includes("concentration")) db.exec("ALTER TABLE compendium_spells ADD COLUMN concentration INTEGER NOT NULL DEFAULT 0");
  if (!spellCols.includes("components"))    db.exec("ALTER TABLE compendium_spells ADD COLUMN components TEXT");
  if (!spellCols.includes("classes"))       db.exec("ALTER TABLE compendium_spells ADD COLUMN classes TEXT");

  // Add qty to treasure if missing (existing databases).
  const treasureCols = (db.pragma("table_info(treasure)") as { name: string }[]).map((c) => c.name);
  if (!treasureCols.includes("qty")) db.exec("ALTER TABLE treasure ADD COLUMN qty INTEGER NOT NULL DEFAULT 1");

  // Add used_legendary_resistances to combatants if missing (existing databases).
  const combatantCols = (db.pragma("table_info(combatants)") as { name: string }[]).map((c) => c.name);
  if (!combatantCols.includes("used_legendary_resistances")) {
    db.exec("ALTER TABLE combatants ADD COLUMN used_legendary_resistances INTEGER NOT NULL DEFAULT 0");
  }

  // Add username to users if missing (older databases used a different schema).
  const userCols = (db.pragma("table_info(users)") as { name: string }[]).map((c) => c.name);
  if (!userCols.includes("username")) {
    db.exec("ALTER TABLE users ADD COLUMN username TEXT");
    // Backfill: use existing name column if present, otherwise fall back to id
    if (userCols.includes("name")) {
      db.exec("UPDATE users SET username = name WHERE username IS NULL");
    } else {
      db.exec("UPDATE users SET username = id WHERE username IS NULL");
    }
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)");
  }

  // Add user_id to characters (new user auth system).
  const charCols = (db.pragma("table_info(characters)") as { name: string }[]).map((c) => c.name);
  if (!charCols.includes("user_id")) {
    db.exec("ALTER TABLE characters ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL");
    db.exec("CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id)");
  }

  // Add user_id and speed to players (character builder integration).
  const playerCols2 = (db.pragma("table_info(players)") as { name: string }[]).map((c) => c.name);
  if (!playerCols2.includes("user_id")) {
    db.exec("ALTER TABLE players ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL");
    db.exec("CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id)");
  }
  if (!playerCols2.includes("speed")) {
    db.exec("ALTER TABLE players ADD COLUMN speed INTEGER");
  }

  // Add image_url to user_characters (portrait upload).
  const ucharCols = (db.pragma("table_info(user_characters)") as { name: string }[]).map((c) => c.name);
  if (!ucharCols.includes("image_url")) {
    db.exec("ALTER TABLE user_characters ADD COLUMN image_url TEXT");
  }
  if (!ucharCols.includes("death_saves_json")) {
    db.exec("ALTER TABLE user_characters ADD COLUMN death_saves_json TEXT");
  }

  // Add death_saves_json to players if missing.
  const playerCols3 = (db.pragma("table_info(players)") as { name: string }[]).map((c) => c.name);
  if (!playerCols3.includes("death_saves_json")) {
    db.exec("ALTER TABLE players ADD COLUMN death_saves_json TEXT");
  }
}

// ---------------------------------------------------------------------------
// Row → domain converters
// ---------------------------------------------------------------------------

export function parseJson<T>(s: unknown, fallback: T): T {
  if (!s || typeof s !== "string") return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export function rowToUser(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCharacter(row: Record<string, unknown>): StoredCharacter {
  return {
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    campaignId: row.campaign_id as string,
    name: row.name as string,
    className: (row.class_name as string) ?? "",
    species: (row.species as string) ?? "",
    level: (row.level as number) ?? 1,
    hpMax: (row.hp_max as number) ?? 1,
    hpCurrent: (row.hp_current as number) ?? 1,
    tempHp: (row.temp_hp as number) ?? 0,
    ac: (row.ac as number) ?? 10,
    speed: (row.speed as number) ?? 30,
    strScore: (row.str_score as number) ?? 10,
    dexScore: (row.dex_score as number) ?? 10,
    conScore: (row.con_score as number) ?? 10,
    intScore: (row.int_score as number) ?? 10,
    wisScore: (row.wis_score as number) ?? 10,
    chaScore: (row.cha_score as number) ?? 10,
    notes: (row.notes as string) ?? "",
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCampaign(row: Record<string, unknown>): StoredCampaign {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToAdventure(row: Record<string, unknown>): StoredAdventure {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    name: row.name as string,
    status: row.status as string,
    sort: row.sort as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToEncounter(row: Record<string, unknown>): StoredEncounter {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: row.adventure_id as string,
    name: row.name as string,
    status: row.status as string,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    ...(row.combat_round != null
      ? { combat: { round: row.combat_round as number, activeCombatantId: (row.combat_active_combatant_id as string | null) ?? null } }
      : {}),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToPlayer(row: Record<string, unknown>): StoredPlayer {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    userId: (row.user_id as string | null) ?? null,
    playerName: row.player_name as string,
    characterName: row.character_name as string,
    class: row.class as string,
    species: row.species as string,
    level: row.level as number,
    hpMax: row.hp_max as number,
    hpCurrent: row.hp_current as number,
    ac: row.ac as number,
    ...(row.speed != null ? { speed: row.speed as number } : {}),
    ...(row.str != null ? { str: row.str as number } : {}),
    ...(row.dex != null ? { dex: row.dex as number } : {}),
    ...(row.con != null ? { con: row.con as number } : {}),
    ...(row.int != null ? { int: row.int as number } : {}),
    ...(row.wis != null ? { wis: row.wis as number } : {}),
    ...(row.cha != null ? { cha: row.cha as number } : {}),
    ...(row.color != null ? { color: row.color as string } : {}),
    imageUrl: (row.image_url as string | null) ?? null,
    overrides: parseJson(row.overrides_json, DEFAULT_OVERRIDES),
    conditions: parseJson(row.conditions_json, []),
    ...(row.death_saves_json
      ? { deathSaves: parseJson(row.death_saves_json, DEFAULT_DEATH_SAVES) }
      : {}),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToUserCharacter(row: Record<string, unknown>): StoredUserCharacter {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    playerName: (row.player_name as string) ?? "",
    className: (row.class_name as string) ?? "",
    species: (row.species as string) ?? "",
    level: (row.level as number) ?? 1,
    hpMax: (row.hp_max as number) ?? 0,
    hpCurrent: (row.hp_current as number) ?? 0,
    ac: (row.ac as number) ?? 10,
    speed: (row.speed as number) ?? 30,
    strScore: (row.str_score as number | null) ?? null,
    dexScore: (row.dex_score as number | null) ?? null,
    conScore: (row.con_score as number | null) ?? null,
    intScore: (row.int_score as number | null) ?? null,
    wisScore: (row.wis_score as number | null) ?? null,
    chaScore: (row.cha_score as number | null) ?? null,
    color: (row.color as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    characterData: parseJson(row.character_data_json, null),
    ...(row.death_saves_json
      ? { deathSaves: parseJson(row.death_saves_json, DEFAULT_DEATH_SAVES) }
      : {}),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToINpc(row: Record<string, unknown>): StoredINpc {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    monsterId: row.monster_id as string,
    name: row.name as string,
    label: (row.label as string | null) ?? null,
    friendly: Boolean(row.friendly),
    hpMax: row.hp_max as number,
    hpCurrent: row.hp_current as number,
    hpDetails: (row.hp_details as string | null) ?? null,
    ac: row.ac as number,
    acDetails: (row.ac_details as string | null) ?? null,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToNote(row: Record<string, unknown>): StoredNote {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: (row.adventure_id as string | null) ?? null,
    title: row.title as string,
    text: row.text as string,
    sort: row.sort as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToTreasure(row: Record<string, unknown>): StoredTreasure {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: (row.adventure_id as string | null) ?? null,
    source: row.source as "compendium" | "custom",
    itemId: (row.item_id as string | null) ?? null,
    name: row.name as string,
    rarity: (row.rarity as string | null) ?? null,
    type: (row.type as string | null) ?? null,
    type_key: (row.type_key as string | null) ?? null,
    attunement: Boolean(row.attunement),
    magic: Boolean(row.magic),
    text: (row.text as string) ?? "",
    qty: typeof row.qty === "number" ? row.qty : 1,
    sort: row.sort as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCondition(row: Record<string, unknown>): StoredCondition {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    key: row.key as string,
    name: row.name as string,
    ...(row.description != null ? { description: row.description as string } : {}),
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCombatant(row: Record<string, unknown>): StoredCombatant {
  return {
    id: row.id as string,
    encounterId: row.encounter_id as string,
    baseType: row.base_type as StoredCombatantBaseType,
    baseId: row.base_id as string,
    name: row.name as string,
    label: row.label as string,
    initiative: (row.initiative as number | null) ?? null,
    friendly: Boolean(row.friendly),
    color: (row.color as string) ?? "#cccccc",
    hpCurrent: (row.hp_current as number | null) ?? null,
    hpMax: (row.hp_max as number | null) ?? null,
    hpDetails: (row.hp_details as string | null) ?? null,
    ac: (row.ac as number | null) ?? null,
    acDetails: (row.ac_details as string | null) ?? null,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    usedReaction: Boolean(row.used_reaction),
    usedLegendaryActions: (row.used_legendary_actions as number) ?? 0,
    usedLegendaryResistances: (row.used_legendary_resistances as number) ?? 0,
    overrides: parseJson(row.overrides_json, DEFAULT_OVERRIDES),
    conditions: parseJson(row.conditions_json, []),
    ...(row.death_saves_json
      ? { deathSaves: parseJson(row.death_saves_json, DEFAULT_DEATH_SAVES) }
      : {}),
    ...(row.used_spell_slots_json
      ? { usedSpellSlots: parseJson(row.used_spell_slots_json, {} as Record<string, number>) }
      : {}),
    attackOverrides: row.attack_overrides_json
      ? parseJson(row.attack_overrides_json, null)
      : null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

// ---------------------------------------------------------------------------
// Utility: next sort value
// ---------------------------------------------------------------------------

/** Returns max(sort)+1 for rows in a table matching a given column/value. */
export function nextSortFor(db: Db, table: string, col: string, val: string): number {
  const row = db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ${table} WHERE ${col} = ?`).get(val) as { n: number };
  return row.n;
}
