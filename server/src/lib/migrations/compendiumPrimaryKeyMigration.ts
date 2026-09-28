import type { Db } from "../db.js";

/**
 * Migrates ruleset-scoped compendium tables from a single-column `id TEXT PRIMARY
 * KEY` to a composite `PRIMARY KEY (id, ruleset)`. SQLite can't ALTER a primary key directly,
 * so each table is recreated (create-copy-drop-rename) inside a transaction. Idempotent: only
 * runs for a table whose `ruleset` column isn't already part of the primary key.
 */
export function ensureCompendiumCompositePrimaryKey(db: Db): void {
  const tables: Array<{
    name: string;
    columns: string;
    columnNames: string;
    indexSql: string;
  }> = [
    {
      name: "compendium_items",
      columns: "id TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e')), name TEXT NOT NULL, name_key TEXT, rarity TEXT, type TEXT, type_key TEXT, attunement INTEGER NOT NULL DEFAULT 0, magic INTEGER NOT NULL DEFAULT 0, data_json TEXT NOT NULL, PRIMARY KEY (id, ruleset)",
      columnNames: "id, ruleset, name, name_key, rarity, type, type_key, attunement, magic, data_json",
      indexSql: [
        "CREATE INDEX IF NOT EXISTS idx_compitem_name ON compendium_items(name COLLATE NOCASE)",
        "CREATE INDEX IF NOT EXISTS idx_compitem_name_key ON compendium_items(name_key)",
        "CREATE INDEX IF NOT EXISTS idx_compitem_filter ON compendium_items(ruleset, type_key, name COLLATE NOCASE)",
      ].join(";\n"),
    },
    {
      name: "compendium_monsters",
      columns: "id TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e')), name TEXT NOT NULL, name_key TEXT, cr TEXT, cr_numeric REAL, type_key TEXT, type_full TEXT, size TEXT, environment TEXT, data_json TEXT NOT NULL, content_hash TEXT, PRIMARY KEY (id, ruleset)",
      columnNames: "id, ruleset, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json, content_hash",
      indexSql: [
        "CREATE INDEX IF NOT EXISTS idx_compmonster_name ON compendium_monsters(name COLLATE NOCASE)",
        "CREATE INDEX IF NOT EXISTS idx_compendium_monsters_ruleset ON compendium_monsters(ruleset)",
      ].join(";\n"),
    },
    {
      name: "compendium_classes",
      columns: "id TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e')), name TEXT NOT NULL, name_key TEXT, hd INTEGER, data_json TEXT NOT NULL, PRIMARY KEY (id, ruleset)",
      columnNames: "id, ruleset, name, name_key, hd, data_json",
      indexSql: "CREATE INDEX IF NOT EXISTS idx_compclass_name ON compendium_classes(name COLLATE NOCASE)",
    },
    {
      name: "compendium_races",
      columns: "id TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e')), name TEXT NOT NULL, name_key TEXT, size TEXT, speed INTEGER, data_json TEXT NOT NULL, PRIMARY KEY (id, ruleset)",
      columnNames: "id, ruleset, name, name_key, size, speed, data_json",
      indexSql: "CREATE INDEX IF NOT EXISTS idx_comprace_name ON compendium_races(name COLLATE NOCASE)",
    },
    {
      name: "compendium_backgrounds",
      columns: "id TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e')), name TEXT NOT NULL, name_key TEXT, data_json TEXT NOT NULL, PRIMARY KEY (id, ruleset)",
      columnNames: "id, ruleset, name, name_key, data_json",
      indexSql: "CREATE INDEX IF NOT EXISTS idx_compbg_name ON compendium_backgrounds(name COLLATE NOCASE)",
    },
    {
      name: "compendium_feats",
      columns: "id TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e')), name TEXT NOT NULL, name_key TEXT, data_json TEXT NOT NULL, PRIMARY KEY (id, ruleset)",
      columnNames: "id, ruleset, name, name_key, data_json",
      indexSql: "CREATE INDEX IF NOT EXISTS idx_compfeat_name ON compendium_feats(name COLLATE NOCASE)",
    },
    {
      name: "compendium_spells",
      columns: "id TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e')), name TEXT NOT NULL, name_key TEXT, level INTEGER, school TEXT, ritual INTEGER NOT NULL DEFAULT 0, concentration INTEGER NOT NULL DEFAULT 0, components TEXT, classes TEXT, data_json TEXT NOT NULL, PRIMARY KEY (id, ruleset)",
      columnNames: "id, ruleset, name, name_key, level, school, ritual, concentration, components, classes, data_json",
      indexSql: [
        "CREATE INDEX IF NOT EXISTS idx_compspell_name ON compendium_spells(name COLLATE NOCASE)",
        "CREATE INDEX IF NOT EXISTS idx_compspell_name_key ON compendium_spells(name_key)",
        "CREATE INDEX IF NOT EXISTS idx_compspell_level ON compendium_spells(level)",
      ].join(";\n"),
    },
    {
      name: "compendium_class_talents",
      columns: "id TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e')), name TEXT NOT NULL, name_key TEXT, kind TEXT NOT NULL, data_json TEXT NOT NULL, PRIMARY KEY (id, ruleset)",
      columnNames: "id, ruleset, name, name_key, kind, data_json",
      indexSql: [
        "CREATE INDEX IF NOT EXISTS idx_compclasstalent_name ON compendium_class_talents(name COLLATE NOCASE)",
        "CREATE INDEX IF NOT EXISTS idx_compclasstalent_kind ON compendium_class_talents(kind)",
      ].join(";\n"),
    },
  ];

  const needsMigration = (tableName: string): boolean => {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string; pk: number }>;
    if (columns.length === 0) return false; // table doesn't exist yet -- CREATE TABLE IF NOT EXISTS in dbSchema.ts handles fresh DBs
    const rulesetColumn = columns.find((c) => c.name === "ruleset");
    return Boolean(rulesetColumn && rulesetColumn.pk === 0);
  };

  const pending = tables.filter((t) => needsMigration(t.name));
  if (pending.length === 0) return;

  db.transaction(() => {
    const migratesItems = pending.some((table) => table.name === "compendium_items");
    const binderItemColumns = db.prepare("PRAGMA table_info(binder_items)").all() as Array<{ name: string }>;
    const rebuildBinderItems = migratesItems && binderItemColumns.length > 0;
    if (rebuildBinderItems) {
      const hasRuleset = binderItemColumns.some((column) => column.name === "compendium_item_ruleset");
      db.exec(`
        CREATE TEMP TABLE binder_items_compendium_key_backup AS
        SELECT id, description, dm_notes, compendium_item_id,
          ${hasRuleset
            ? "compendium_item_ruleset"
            : "CASE WHEN compendium_item_id IS NULL THEN NULL ELSE (SELECT ruleset FROM compendium_items WHERE id = compendium_item_id) END"}
            AS compendium_item_ruleset,
          holder_mortal_id, location_record_id, created_at, updated_at
        FROM binder_items;
        DROP TABLE binder_items;
      `);
    }
    for (const table of pending) {
      db.exec(`CREATE TABLE ${table.name}_new (${table.columns})`);
      // `ruleset` was added to legacy tables with ALTER TABLE, which puts it last. Never rely
      // on physical column order while copying into the new composite-key table.
      db.exec(`INSERT INTO ${table.name}_new (${table.columnNames}) SELECT ${table.columnNames} FROM ${table.name}`);
      db.exec(`DROP TABLE ${table.name}`);
      db.exec(`ALTER TABLE ${table.name}_new RENAME TO ${table.name}`);
      db.exec(table.indexSql);
    }
    if (rebuildBinderItems) {
      db.exec(`
        CREATE TABLE binder_items (
          id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
          description TEXT,
          dm_notes TEXT,
          compendium_item_id TEXT,
          compendium_item_ruleset TEXT CHECK (compendium_item_ruleset IN ('5e', '5.5e')),
          holder_mortal_id TEXT REFERENCES mortals(id) ON DELETE SET NULL,
          location_record_id TEXT REFERENCES binder_records(id) ON DELETE SET NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (compendium_item_id, compendium_item_ruleset)
            REFERENCES compendium_items(id, ruleset) ON DELETE SET NULL
        );
        INSERT INTO binder_items (
          id, description, dm_notes, compendium_item_id, compendium_item_ruleset,
          holder_mortal_id, location_record_id, created_at, updated_at
        ) SELECT
          id, description, dm_notes, compendium_item_id, compendium_item_ruleset,
          holder_mortal_id, location_record_id, created_at, updated_at
        FROM binder_items_compendium_key_backup;
        DROP TABLE binder_items_compendium_key_backup;
      `);
    }
  })();
}
