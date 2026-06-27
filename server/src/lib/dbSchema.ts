export const SCHEMA_SQL = `
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

CREATE TABLE IF NOT EXISTS db_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
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
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE
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
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (adventure_id) REFERENCES adventures(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS initiative_prompts (
  combatant_id TEXT PRIMARY KEY REFERENCES combatants(id) ON DELETE CASCADE,
  encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES user_characters(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
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
  notes TEXT NOT NULL DEFAULT '',
  maintain_order INTEGER NOT NULL DEFAULT 0,
  facilities_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bastion_players (
  bastion_id TEXT NOT NULL REFERENCES bastions(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (bastion_id, player_id)
);

CREATE TABLE IF NOT EXISTS bastion_characters (
  bastion_id TEXT NOT NULL REFERENCES bastions(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES user_characters(id) ON DELETE CASCADE,
  PRIMARY KEY (bastion_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_adventures_campaign   ON adventures(campaign_id);
CREATE INDEX IF NOT EXISTS idx_encounters_adventure  ON encounters(adventure_id);
CREATE INDEX IF NOT EXISTS idx_encounters_campaign   ON encounters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inpcs_campaign        ON inpcs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notes_campaign        ON notes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notes_adventure       ON notes(adventure_id);
CREATE INDEX IF NOT EXISTS idx_treasure_campaign     ON treasure(campaign_id);
CREATE INDEX IF NOT EXISTS idx_treasure_adventure    ON treasure(adventure_id);
CREATE INDEX IF NOT EXISTS idx_conditions_campaign_key ON conditions(campaign_id, key);
CREATE INDEX IF NOT EXISTS idx_combatants_encounter  ON combatants(encounter_id);
CREATE INDEX IF NOT EXISTS idx_combatants_base       ON combatants(base_type, base_id);
CREATE INDEX IF NOT EXISTS idx_membership_user       ON campaign_membership(user_id);
CREATE INDEX IF NOT EXISTS idx_players_user          ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_campaign      ON players(campaign_id);
CREATE INDEX IF NOT EXISTS idx_players_character     ON players(character_id) WHERE character_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_initiative_prompts_character ON initiative_prompts(character_id, created_at);
CREATE INDEX IF NOT EXISTS idx_initiative_prompts_encounter ON initiative_prompts(encounter_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_campaign_character ON players(campaign_id, character_id) WHERE character_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compmon_name          ON compendium_monsters(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_compmon_typekey       ON compendium_monsters(type_key);
CREATE INDEX IF NOT EXISTS idx_compmon_size          ON compendium_monsters(size);
CREATE INDEX IF NOT EXISTS idx_compmon_cr            ON compendium_monsters(cr_numeric);
CREATE INDEX IF NOT EXISTS idx_compitem_name         ON compendium_items(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_compitem_name_key     ON compendium_items(name_key);
CREATE INDEX IF NOT EXISTS idx_compspell_name        ON compendium_spells(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_compspell_name_key    ON compendium_spells(name_key);
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
CREATE INDEX IF NOT EXISTS idx_bastion_players_player ON bastion_players(player_id);
CREATE INDEX IF NOT EXISTS idx_bastion_characters_character ON bastion_characters(character_id);
`;
