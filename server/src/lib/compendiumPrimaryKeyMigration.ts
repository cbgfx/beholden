import type { Db } from "./db.js";

/**
 * Migrates compendium_classes/races/backgrounds/feats from a single-column `id TEXT PRIMARY
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
    for (const table of pending) {
      db.exec(`CREATE TABLE ${table.name}_new (${table.columns})`);
      // `ruleset` was added to legacy tables with ALTER TABLE, which puts it last. Never rely
      // on physical column order while copying into the new composite-key table.
      db.exec(`INSERT INTO ${table.name}_new (${table.columnNames}) SELECT ${table.columnNames} FROM ${table.name}`);
      db.exec(`DROP TABLE ${table.name}`);
      db.exec(`ALTER TABLE ${table.name}_new RENAME TO ${table.name}`);
      db.exec(table.indexSql);
    }
  })();
}
