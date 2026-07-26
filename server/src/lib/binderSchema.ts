/**
 * Binder schema.
 *
 * Binder uses a narrow binder_records identity registry for cross-type routing,
 * search, visibility, events, and stable mentions. Type-specific data remains
 * in dedicated tables.
 */
export const BINDER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS binders (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#38b6ff',
  description TEXT,
  current_date_text TEXT,
  current_date_sort INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_records (
  id TEXT PRIMARY KEY,
  binder_id TEXT NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK(record_type IN (
    'mortal',
    'deity',
    'race',
    'position',
    'domain',
    'organization',
    'continent',
    'country',
    'location',
    'poi',
    'event'
  )),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'dm'
    CHECK(visibility IN ('dm', 'campaign', 'public')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(binder_id, id)
);

CREATE TABLE IF NOT EXISTS binder_record_aliases (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES binder_records(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_key TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE(record_id, alias_key)
);

CREATE TABLE IF NOT EXISTS binder_races (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_positions (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_domains (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_continents (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_countries (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  continent_id TEXT REFERENCES binder_continents(id) ON DELETE RESTRICT,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_locations (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  country_id TEXT REFERENCES binder_countries(id) ON DELETE RESTRICT,
  continent_id TEXT REFERENCES binder_continents(id) ON DELETE RESTRICT,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_points_of_interest (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES binder_locations(id) ON DELETE RESTRICT,
  country_id TEXT REFERENCES binder_countries(id) ON DELETE RESTRICT,
  parent_poi_id TEXT REFERENCES binder_points_of_interest(id) ON DELETE RESTRICT,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (CASE WHEN location_id IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN country_id IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN parent_poi_id IS NULL THEN 0 ELSE 1 END) <= 1
  ),
  CHECK (parent_poi_id IS NULL OR parent_poi_id <> id)
);

CREATE TABLE IF NOT EXISTS mortals (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  race_id TEXT REFERENCES binder_races(id) ON DELETE SET NULL,
  gender TEXT,
  life_status TEXT,
  birth_date_text TEXT,
  birth_date_sort INTEGER,
  death_date_text TEXT,
  death_date_sort INTEGER,
  description TEXT,
  backstory TEXT,
  dm_notes TEXT,
  image_url TEXT,
  image_updated_at INTEGER,
  residence_record_id TEXT REFERENCES binder_records(id) ON DELETE SET NULL,
  position_id TEXT REFERENCES binder_positions(id) ON DELETE SET NULL,
  mortal_type TEXT NOT NULL CHECK(mortal_type IN ('npc', 'player_character')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_npcs (
  mortal_id TEXT PRIMARY KEY REFERENCES mortals(id) ON DELETE CASCADE,
  monster_id TEXT REFERENCES compendium_monsters(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_player_characters (
  mortal_id TEXT PRIMARY KEY REFERENCES mortals(id) ON DELETE CASCADE,
  character_id TEXT UNIQUE REFERENCES user_characters(id) ON DELETE SET NULL,
  player_id TEXT UNIQUE REFERENCES players(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS binder_npcs_require_npc_type
BEFORE INSERT ON binder_npcs
BEGIN
  SELECT CASE
    WHEN (SELECT mortal_type FROM mortals WHERE id = NEW.mortal_id) <> 'npc'
    THEN RAISE(ABORT, 'Binder Mortal is not typed as an NPC')
  END;
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM binder_player_characters WHERE mortal_id = NEW.mortal_id)
    THEN RAISE(ABORT, 'Binder Mortal already has a Player Character subtype')
  END;
END;

CREATE TRIGGER IF NOT EXISTS binder_player_characters_require_pc_type
BEFORE INSERT ON binder_player_characters
BEGIN
  SELECT CASE
    WHEN (SELECT mortal_type FROM mortals WHERE id = NEW.mortal_id) <> 'player_character'
    THEN RAISE(ABORT, 'Binder Mortal is not typed as a Player Character')
  END;
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM binder_npcs WHERE mortal_id = NEW.mortal_id)
    THEN RAISE(ABORT, 'Binder Mortal already has an NPC subtype')
  END;
END;

CREATE TABLE IF NOT EXISTS deities (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  rank TEXT,
  description TEXT,
  dm_notes TEXT,
  image_url TEXT,
  image_updated_at INTEGER,
  primary_location_record_id TEXT REFERENCES binder_records(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS deity_domains (
  deity_id TEXT NOT NULL REFERENCES deities(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES binder_domains(id) ON DELETE CASCADE,
  PRIMARY KEY (deity_id, domain_id)
);

CREATE TABLE IF NOT EXISTS binder_organizations (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  description TEXT,
  dm_notes TEXT,
  leader_mortal_id TEXT REFERENCES mortals(id) ON DELETE SET NULL,
  headquarters_record_id TEXT REFERENCES binder_records(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES binder_organizations(id) ON DELETE CASCADE,
  mortal_id TEXT NOT NULL REFERENCES mortals(id) ON DELETE CASCADE,
  position_id TEXT REFERENCES binder_positions(id) ON DELETE SET NULL,
  role_label TEXT,
  start_date_text TEXT,
  start_date_sort INTEGER,
  end_date_text TEXT,
  end_date_sort INTEGER,
  notes TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_membership_exact
  ON organization_memberships(
    organization_id,
    mortal_id,
    IFNULL(position_id, ''),
    IFNULL(start_date_text, '')
  );

CREATE TABLE IF NOT EXISTS binder_events (
  id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
  description TEXT,
  date_text TEXT,
  date_sort INTEGER,
  end_date_text TEXT,
  end_date_sort INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_event_tags (
  id TEXT PRIMARY KEY,
  binder_id TEXT NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(binder_id, name_key)
);

CREATE TABLE IF NOT EXISTS binder_event_tag_links (
  event_id TEXT NOT NULL REFERENCES binder_events(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES binder_event_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, tag_id)
);

CREATE TABLE IF NOT EXISTS binder_event_records (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES binder_events(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL REFERENCES binder_records(id) ON DELETE CASCADE,
  role TEXT,
  description TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_binder_event_record_role
  ON binder_event_records(event_id, record_id, IFNULL(role, ''));

CREATE TABLE IF NOT EXISTS binder_event_campaigns (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES binder_events(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  role TEXT,
  description TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_binder_event_campaign_role
  ON binder_event_campaigns(event_id, campaign_id, IFNULL(role, ''));

-- Stable mention identity is embedded in existing text storage as a
-- data-binder-record-id token. This table indexes those tokens for integrity,
-- rename routing, and import reporting without becoming a second content store.
CREATE TABLE IF NOT EXISTS binder_record_mentions (
  id TEXT PRIMARY KEY,
  source_record_id TEXT NOT NULL REFERENCES binder_records(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_record_id TEXT REFERENCES binder_records(id) ON DELETE SET NULL,
  target_external_id TEXT,
  label TEXT NOT NULL,
  occurrence_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(source_record_id, source_field, occurrence_key)
);

CREATE TABLE IF NOT EXISTS binder_import_runs (
  id TEXT PRIMARY KEY,
  binder_id TEXT NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK(source IN ('notion_zip')),
  source_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('preview', 'importing', 'completed', 'failed', 'rolled_back')),
  dry_run INTEGER NOT NULL DEFAULT 1 CHECK(dry_run IN (0, 1)),
  started_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binder_external_ids (
  id TEXT PRIMARY KEY,
  binder_id TEXT NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  record_id TEXT REFERENCES binder_records(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  import_run_id TEXT NOT NULL REFERENCES binder_import_runs(id) ON DELETE CASCADE,
  CHECK (
    (record_id IS NOT NULL AND campaign_id IS NULL) OR
    (record_id IS NULL AND campaign_id IS NOT NULL)
  ),
  UNIQUE(binder_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_binders_owner_updated
  ON binders(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_binders_name
  ON binders(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_binder_records_type_name
  ON binder_records(binder_id, record_type, name_key, id);
CREATE INDEX IF NOT EXISTS idx_binder_records_updated
  ON binder_records(binder_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_binder_records_visibility
  ON binder_records(binder_id, visibility, record_type);
CREATE INDEX IF NOT EXISTS idx_binder_alias_lookup
  ON binder_record_aliases(alias_key, record_id);
CREATE INDEX IF NOT EXISTS idx_binder_countries_continent
  ON binder_countries(continent_id);
CREATE INDEX IF NOT EXISTS idx_binder_locations_country
  ON binder_locations(country_id);
CREATE INDEX IF NOT EXISTS idx_binder_locations_continent
  ON binder_locations(continent_id);
CREATE INDEX IF NOT EXISTS idx_binder_poi_location
  ON binder_points_of_interest(location_id);
CREATE INDEX IF NOT EXISTS idx_binder_poi_country
  ON binder_points_of_interest(country_id);
CREATE INDEX IF NOT EXISTS idx_binder_poi_parent
  ON binder_points_of_interest(parent_poi_id);
CREATE INDEX IF NOT EXISTS idx_mortals_race
  ON mortals(race_id);
CREATE INDEX IF NOT EXISTS idx_mortals_residence
  ON mortals(residence_record_id);
CREATE INDEX IF NOT EXISTS idx_mortals_birth
  ON mortals(birth_date_sort);
CREATE INDEX IF NOT EXISTS idx_org_membership_org_current
  ON organization_memberships(organization_id, end_date_sort, position_id);
CREATE INDEX IF NOT EXISTS idx_org_membership_mortal
  ON organization_memberships(mortal_id, start_date_sort);
CREATE INDEX IF NOT EXISTS idx_org_membership_position
  ON organization_memberships(position_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_binder_events_date
  ON binder_events(date_sort, id);
CREATE INDEX IF NOT EXISTS idx_binder_event_tags_name
  ON binder_event_tags(binder_id, name_key);
CREATE INDEX IF NOT EXISTS idx_binder_event_tag_links_tag
  ON binder_event_tag_links(tag_id, event_id);
CREATE INDEX IF NOT EXISTS idx_binder_event_records_record
  ON binder_event_records(record_id, event_id);
CREATE INDEX IF NOT EXISTS idx_binder_event_records_event
  ON binder_event_records(event_id, sort);
CREATE INDEX IF NOT EXISTS idx_binder_event_campaigns_campaign
  ON binder_event_campaigns(campaign_id, event_id);
CREATE INDEX IF NOT EXISTS idx_binder_mentions_target
  ON binder_record_mentions(target_record_id);
CREATE INDEX IF NOT EXISTS idx_binder_import_fingerprint
  ON binder_import_runs(binder_id, source, source_fingerprint, status);
`;
