import type { Db } from "./db.js";

function campaignColumns(db: Db): Set<string> {
  const rows = db.prepare("PRAGMA table_info(campaigns)").all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

/** Additive Binder fields for databases that received the initial Binder schema. */
export function ensureBinderColumns(db: Db): void {
  const rows = db.prepare("PRAGMA table_info(binders)").all() as Array<{ name: string }>;
  const columns = new Set(rows.map((row) => row.name));
  if (!columns.has("color")) {
    db.exec("ALTER TABLE binders ADD COLUMN color TEXT NOT NULL DEFAULT '#38b6ff'");
  }

  const organizationRows = db.prepare("PRAGMA table_info(binder_organizations)").all() as Array<{ name: string }>;
  const organizationColumns = new Set(organizationRows.map((row) => row.name));
  if (!organizationColumns.has("leader_mortal_id")) {
    db.exec(`
      ALTER TABLE binder_organizations
      ADD COLUMN leader_mortal_id TEXT REFERENCES mortals(id) ON DELETE SET NULL
    `);
  }
  if (!organizationColumns.has("icon")) {
    db.exec("ALTER TABLE binder_organizations ADD COLUMN icon TEXT");
  }

  const positionColumns = new Set(
    (db.prepare("PRAGMA table_info(binder_positions)").all() as Array<{ name: string }>).map((row) => row.name),
  );
  if (!positionColumns.has("icon")) {
    db.exec("ALTER TABLE binder_positions ADD COLUMN icon TEXT");
  }

  const poiColumns = new Set(
    (db.prepare("PRAGMA table_info(binder_points_of_interest)").all() as Array<{ name: string }>).map((row) => row.name),
  );
  if (!poiColumns.has("icon")) {
    db.exec("ALTER TABLE binder_points_of_interest ADD COLUMN icon TEXT");
  }

  const locationColumns = new Set(
    (db.prepare("PRAGMA table_info(binder_locations)").all() as Array<{ name: string }>).map((row) => row.name),
  );
  if (!locationColumns.has("continent_id")) {
    db.exec("ALTER TABLE binder_locations ADD COLUMN continent_id TEXT REFERENCES binder_continents(id) ON DELETE RESTRICT");
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_binder_locations_continent
    ON binder_locations(continent_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_binder_organizations_leader
    ON binder_organizations(leader_mortal_id)
  `);

  const mortalColumns = new Set(
    (db.prepare("PRAGMA table_info(mortals)").all() as Array<{ name: string }>).map((row) => row.name),
  );
  if (!mortalColumns.has("image_url")) {
    db.exec("ALTER TABLE mortals ADD COLUMN image_url TEXT");
  }
  if (!mortalColumns.has("image_updated_at")) {
    db.exec("ALTER TABLE mortals ADD COLUMN image_updated_at INTEGER");
  }
  if (!mortalColumns.has("position_id")) {
    db.exec("ALTER TABLE mortals ADD COLUMN position_id TEXT REFERENCES binder_positions(id) ON DELETE SET NULL");
  }
  const deityColumns = new Set(
    (db.prepare("PRAGMA table_info(deities)").all() as Array<{ name: string }>).map((row) => row.name),
  );
  if (!deityColumns.has("image_url")) {
    db.exec("ALTER TABLE deities ADD COLUMN image_url TEXT");
  }
  if (!deityColumns.has("image_updated_at")) {
    db.exec("ALTER TABLE deities ADD COLUMN image_updated_at INTEGER");
  }
  db.exec(`
    UPDATE mortals
    SET life_status = CASE WHEN death_date_text IS NULL THEN 'alive' ELSE 'dead' END
    WHERE life_status IS NULL
       OR life_status NOT IN ('alive', 'dead')
       OR (death_date_text IS NULL AND life_status <> 'alive')
       OR (death_date_text IS NOT NULL AND life_status <> 'dead')
  `);

  const pcColumns = new Set(
    (db.prepare("PRAGMA table_info(binder_player_characters)").all() as Array<{ name: string }>).map((row) => row.name),
  );
  if (!pcColumns.has("player_id")) {
    db.exec("ALTER TABLE binder_player_characters ADD COLUMN player_id TEXT REFERENCES players(id) ON DELETE SET NULL");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_binder_pc_player
    ON binder_player_characters(player_id) WHERE player_id IS NOT NULL
  `);

  const membershipColumns = new Set(
    (db.prepare("PRAGMA table_info(organization_memberships)").all() as Array<{ name: string }>).map((row) => row.name),
  );
  if (!membershipColumns.has("is_primary")) {
    db.exec("ALTER TABLE organization_memberships ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0, 1))");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_org_membership_primary_mortal
    ON organization_memberships(mortal_id) WHERE is_primary = 1
  `);
}

const OPTIONAL_BINDER_TEXT_COLUMNS = [
  ["binders", "description"],
  ["binder_races", "description"],
  ["binder_positions", "description"],
  ["binder_continents", "description"],
  ["binder_countries", "description"],
  ["binder_locations", "description"],
  ["binder_points_of_interest", "description"],
  ["mortals", "description"],
  ["mortals", "backstory"],
  ["mortals", "dm_notes"],
  ["deities", "description"],
  ["deities", "dm_notes"],
  ["binder_organizations", "description"],
  ["binder_organizations", "dm_notes"],
  ["organization_memberships", "notes"],
  ["binder_events", "description"],
] as const;

function makeTextColumnNullable(db: Db, table: string, column: string): void {
  const info = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
    name: string;
    notnull: number;
    dflt_value: string | null;
  }>;
  const current = info.find((item) => item.name === column);
  if (!current || (current.notnull === 0 && current.dflt_value === null)) return;

  const temporary = `__binder_nullable_${column}`;
  db.exec(`
    ALTER TABLE "${table}" ADD COLUMN "${temporary}" TEXT;
    UPDATE "${table}" SET "${temporary}" = NULLIF(TRIM("${column}"), '');
    ALTER TABLE "${table}" DROP COLUMN "${column}";
    ALTER TABLE "${table}" RENAME COLUMN "${temporary}" TO "${column}";
  `);
}

/**
 * Correct the initial pre-CRUD Binder schema so optional values have one
 * representation: SQL NULL. The subtype row remains mandatory, while its
 * mechanical character-sheet link is independently optional.
 */
export function ensureBinderUnsetConventions(db: Db): void {
  for (const [table, column] of OPTIONAL_BINDER_TEXT_COLUMNS) {
    makeTextColumnNullable(db, table, column);
  }

  // These triggers reference both subtype tables. SQLite may rewrite their
  // bodies when one of those tables is renamed during an older migration,
  // leaving a reference to the subsequently-dropped temporary table.
  // openDb reapplies BINDER_SCHEMA_SQL after this migration.
  db.exec(`
    DROP TRIGGER IF EXISTS binder_npcs_require_npc_type;
    DROP TRIGGER IF EXISTS binder_player_characters_require_pc_type;
  `);

  const characterColumn = db.prepare("PRAGMA table_info(binder_player_characters)").all() as Array<{
    name: string;
    notnull: number;
  }>;
  const characterFk = db.prepare("PRAGMA foreign_key_list(binder_player_characters)").all() as Array<{
    from: string;
    on_delete: string;
  }>;
  const needsRebuild =
    characterColumn.find((item) => item.name === "character_id")?.notnull === 1
    || characterFk.find((item) => item.from === "character_id")?.on_delete.toUpperCase() !== "SET NULL";
  if (!needsRebuild) return;

  db.pragma("foreign_keys = OFF");
  db.pragma("legacy_alter_table = ON");
  try {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE binder_player_characters RENAME TO binder_player_characters_legacy;
        CREATE TABLE binder_player_characters (
          mortal_id TEXT PRIMARY KEY REFERENCES mortals(id) ON DELETE CASCADE,
          character_id TEXT UNIQUE REFERENCES user_characters(id) ON DELETE SET NULL,
          player_id TEXT UNIQUE REFERENCES players(id) ON DELETE SET NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        INSERT INTO binder_player_characters (mortal_id, character_id, player_id, created_at, updated_at)
        SELECT mortal_id, character_id, player_id, created_at, updated_at
        FROM binder_player_characters_legacy;
        DROP TABLE binder_player_characters_legacy;
      `);
    })();
  } finally {
    db.pragma("legacy_alter_table = OFF");
    db.pragma("foreign_keys = ON");
  }
}

/** Expand the narrow identity registry when a new approved typed table lands. */
export function ensureBinderRecordTypes(db: Db): void {
  const definition = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'binder_records'
  `).pluck().get() as string | undefined;
  if (definition?.includes("'domain'") && definition.includes("'location'") && definition.includes("'item'")) return;

  db.pragma("foreign_keys = OFF");
  db.pragma("legacy_alter_table = ON");
  try {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE binder_records RENAME TO binder_records_legacy;
        CREATE TABLE binder_records (
          id TEXT PRIMARY KEY,
          binder_id TEXT NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
          record_type TEXT NOT NULL CHECK(record_type IN (
            'mortal', 'deity', 'race', 'position', 'domain', 'organization',
            'continent', 'country', 'location', 'poi', 'item', 'event'
          )),
          name TEXT NOT NULL,
          name_key TEXT NOT NULL,
          visibility TEXT NOT NULL DEFAULT 'dm'
            CHECK(visibility IN ('dm', 'campaign', 'public')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(binder_id, id)
        );
        INSERT INTO binder_records (
          id, binder_id, record_type, name, name_key, visibility, created_at, updated_at
        )
        SELECT id, binder_id,
               CASE WHEN record_type = 'city' THEN 'location' ELSE record_type END,
               name, name_key, visibility, created_at, updated_at
        FROM binder_records_legacy;
        DROP TABLE binder_records_legacy;
      `);
    })();
  } finally {
    db.pragma("legacy_alter_table = OFF");
    db.pragma("foreign_keys = ON");
  }
}

/**
 * Canonically rename the pre-release Binder "city" storage to "location".
 * This migration preserves local/imported development data and removes the
 * legacy table and POI column rather than maintaining aliases indefinitely.
 */
export function ensureBinderLocationNaming(db: Db): void {
  const hasLegacyTable = Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'binder_cities'",
  ).get());
  const hasLocationTable = Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'binder_locations'",
  ).get());
  const hasPoiTable = Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'binder_points_of_interest'",
  ).get());
  const poiColumns = new Set(
    (hasPoiTable ? db.prepare("PRAGMA table_info(binder_points_of_interest)").all() as Array<{ name: string }> : []).map((row) => row.name),
  );
  if (!hasLegacyTable && !poiColumns.has("city_id")) return;

  db.pragma("foreign_keys = OFF");
  db.pragma("legacy_alter_table = ON");
  try {
    db.transaction(() => {
      if (hasLegacyTable && !hasLocationTable) {
        db.exec("ALTER TABLE binder_cities RENAME TO binder_locations");
      } else if (hasLegacyTable) {
        db.exec(`
          INSERT OR IGNORE INTO binder_locations (id, country_id, description, created_at, updated_at)
          SELECT id, country_id, description, created_at, updated_at FROM binder_cities
        `);
      }
      if (poiColumns.has("city_id")) {
        if (!hasLocationTable && hasLegacyTable) {
          db.exec("ALTER TABLE binder_points_of_interest RENAME COLUMN city_id TO location_id");
        } else {
          db.exec(`
          ALTER TABLE binder_points_of_interest RENAME TO binder_points_of_interest_legacy_city;
          CREATE TABLE binder_points_of_interest (
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
          INSERT INTO binder_points_of_interest (
            id, location_id, country_id, parent_poi_id, description, created_at, updated_at
          )
          SELECT id, city_id, country_id, parent_poi_id, description, created_at, updated_at
          FROM binder_points_of_interest_legacy_city;
          DROP TABLE binder_points_of_interest_legacy_city;
          `);
        }
      }
      if (hasLegacyTable && hasLocationTable) db.exec("DROP TABLE binder_cities");
    })();
  } finally {
    db.pragma("legacy_alter_table = OFF");
    db.pragma("foreign_keys = ON");
  }
}

/** Additive, idempotent Binder fields for databases created before Binder. */
export function ensureBinderCampaignColumns(db: Db): void {
  const columns = campaignColumns(db);
  if (!columns.has("binder_id")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN binder_id TEXT REFERENCES binders(id) ON DELETE SET NULL");
  }
  if (!columns.has("current_date_text")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN current_date_text TEXT");
  }
  if (!columns.has("current_date_sort")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN current_date_sort INTEGER");
  }
  if (!columns.has("campaign_story")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN campaign_story TEXT");
  }
  if (!columns.has("campaign_notes")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN campaign_notes TEXT");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_campaigns_binder ON campaigns(binder_id, updated_at DESC)");
}
