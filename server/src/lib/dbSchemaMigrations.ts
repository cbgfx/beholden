import type { Db } from "./db.js";

export function tableExists(db: Db, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

export function columnExists(db: Db, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  return (db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`).all() as Array<{ name: string }>)
    .some((row) => row.name === column);
}

function hasCascadeForeignKey(db: Db, table: string, from: string, target: string): boolean {
  if (!tableExists(db, table)) return false;
  return (db.prepare(`PRAGMA foreign_key_list("${table.replace(/"/g, '""')}")`).all() as Array<{
    from: string;
    table: string;
    on_delete: string;
  }>).some((row) => row.from === from && row.table === target && row.on_delete.toUpperCase() === "CASCADE");
}

function rebuildNotes(db: Db): void {
  db.exec(`
    ALTER TABLE notes RENAME TO notes_schema_v0;
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      adventure_id TEXT REFERENCES adventures(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Note',
      text TEXT NOT NULL DEFAULT '',
      sort INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    INSERT INTO notes (id, campaign_id, adventure_id, title, text, sort, created_at, updated_at)
    SELECT
      n.id,
      n.campaign_id,
      n.adventure_id,
      n.title,
      n.text,
      n.sort,
      n.created_at,
      n.updated_at
    FROM notes_schema_v0 n
    LEFT JOIN adventures a ON a.id = n.adventure_id AND a.campaign_id = n.campaign_id
    WHERE n.adventure_id IS NULL OR a.id IS NOT NULL;
    DROP TABLE notes_schema_v0;
    CREATE INDEX idx_notes_campaign ON notes(campaign_id);
    CREATE INDEX idx_notes_adventure ON notes(adventure_id);
  `);
}

function rebuildTreasure(db: Db): void {
  db.exec(`
    ALTER TABLE treasure RENAME TO treasure_schema_v0;
    CREATE TABLE treasure (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      adventure_id TEXT REFERENCES adventures(id) ON DELETE CASCADE,
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
      updated_at INTEGER NOT NULL
    );
    INSERT INTO treasure (
      id, campaign_id, adventure_id, source, item_id, name, rarity, type, type_key,
      attunement, magic, text, qty, sort, created_at, updated_at
    )
    SELECT
      t.id,
      t.campaign_id,
      t.adventure_id,
      t.source,
      t.item_id,
      t.name,
      t.rarity,
      t.type,
      t.type_key,
      t.attunement,
      t.magic,
      t.text,
      t.qty,
      t.sort,
      t.created_at,
      t.updated_at
    FROM treasure_schema_v0 t
    LEFT JOIN adventures a ON a.id = t.adventure_id AND a.campaign_id = t.campaign_id
    WHERE t.adventure_id IS NULL OR a.id IS NOT NULL;
    DROP TABLE treasure_schema_v0;
    CREATE INDEX idx_treasure_campaign ON treasure(campaign_id);
    CREATE INDEX idx_treasure_adventure ON treasure(adventure_id);
  `);
}

function dropColumnIfPresent(db: Db, table: string, column: string): void {
  if (columnExists(db, table, column)) {
    db.exec(`ALTER TABLE "${table.replace(/"/g, '""')}" DROP COLUMN "${column.replace(/"/g, '""')}"`);
  }
}

function migrateToVersion1(db: Db): void {
  if (tableExists(db, "combats")) {
    db.exec(`
      UPDATE encounters
      SET
        combat_round = COALESCE(
          combat_round,
          (SELECT round FROM combats WHERE combats.encounter_id = encounters.id)
        ),
        combat_active_combatant_id = COALESCE(
          combat_active_combatant_id,
          (SELECT active_combatant_id FROM combats WHERE combats.encounter_id = encounters.id)
        )
      WHERE EXISTS (SELECT 1 FROM combats WHERE combats.encounter_id = encounters.id);
      DROP TABLE combats;
    `);
  }

  if (
    tableExists(db, "notes")
    && (columnExists(db, "notes", "note_json") || !hasCascadeForeignKey(db, "notes", "adventure_id", "adventures"))
  ) {
    rebuildNotes(db);
  }
  if (
    tableExists(db, "treasure")
    && (columnExists(db, "treasure", "entry_json") || !hasCascadeForeignKey(db, "treasure", "adventure_id", "adventures"))
  ) {
    rebuildTreasure(db);
  }

  dropColumnIfPresent(db, "players", "sheet_json");
  dropColumnIfPresent(db, "user_characters", "sheet_json");
  dropColumnIfPresent(db, "party_inventory", "item_json");

  if (tableExists(db, "characters")) db.exec("DROP TABLE characters");
  if (tableExists(db, "character_campaigns")) db.exec("DROP TABLE character_campaigns");

  db.exec(`
    DROP INDEX IF EXISTS idx_conditions_campaign;
    DROP INDEX IF EXISTS idx_membership_campaign;
    CREATE INDEX IF NOT EXISTS idx_compitem_name_key ON compendium_items(name_key);
    CREATE INDEX IF NOT EXISTS idx_compspell_name_key ON compendium_spells(name_key);
  `);
}

function migrateToVersion2(db: Db): void {
  if (columnExists(db, "bastions", "assigned_player_ids_json")) {
    db.exec(`
      INSERT OR IGNORE INTO bastion_players (bastion_id, player_id)
      SELECT b.id, p.id
      FROM bastions b, json_each(b.assigned_player_ids_json) assignment
      JOIN players p ON p.id = assignment.value;
    `);
  }
  if (columnExists(db, "bastions", "assigned_character_ids_json")) {
    db.exec(`
      INSERT OR IGNORE INTO bastion_characters (bastion_id, character_id)
      SELECT b.id, uc.id
      FROM bastions b, json_each(b.assigned_character_ids_json) assignment
      JOIN user_characters uc ON uc.id = assignment.value;
    `);
  }
  dropColumnIfPresent(db, "bastions", "assigned_player_ids_json");
  dropColumnIfPresent(db, "bastions", "assigned_character_ids_json");
}

function migrateToVersion3(db: Db): void {
  // Deduplicate any existing (campaign_id, key) pairs before enforcing uniqueness.
  // Keeps the row with the lowest rowid per pair (arbitrary but stable).
  db.exec(`
    DELETE FROM conditions
    WHERE rowid NOT IN (
      SELECT MIN(rowid) FROM conditions GROUP BY campaign_id, key
    );
    DROP INDEX IF EXISTS idx_conditions_campaign_key;
    CREATE UNIQUE INDEX idx_conditions_campaign_key ON conditions(campaign_id, key);
  `);
}

const MIGRATIONS = [migrateToVersion1, migrateToVersion2, migrateToVersion3];

export function runSchemaMigrations(db: Db): void {
  let version = Number(
    (db.prepare("SELECT value FROM db_meta WHERE key = 'schema_version'").get() as { value?: string } | undefined)?.value ?? 0,
  );

  while (version < MIGRATIONS.length) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`Missing schema migration for version ${version + 1}`);
    const nextVersion = version + 1;
    db.transaction(() => {
      migrate(db);
      db.prepare(`
        INSERT INTO db_meta (key, value) VALUES ('schema_version', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(String(nextVersion));
    })();
    version = nextVersion;
  }

  const violations = db.pragma("foreign_key_check") as Array<Record<string, unknown>>;
  if (violations.length > 0) {
    throw new Error(`Schema migration left ${violations.length} foreign-key violation(s)`);
  }
}
