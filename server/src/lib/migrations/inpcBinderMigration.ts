import type Database from "better-sqlite3";

export function ensureInpcBinderMortalLink(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(inpcs)").all() as Array<{ name: string; notnull: number }>;
  const monster = columns.find((column) => column.name === "monster_id");
  const foreignKeys = db.prepare("PRAGMA foreign_key_list(inpcs)").all() as Array<{ from: string; table: string }>;
  const hasMortalForeignKey = foreignKeys.some((key) => key.from === "binder_mortal_id" && key.table === "mortals");
  if (columns.some((column) => column.name === "binder_mortal_id") && monster?.notnull === 0 && hasMortalForeignKey) return;

  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    ALTER TABLE inpcs RENAME TO inpcs_legacy_binder_link;
    CREATE TABLE inpcs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      monster_id TEXT,
      binder_mortal_id TEXT REFERENCES mortals(id) ON DELETE SET NULL,
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
    INSERT INTO inpcs
      (id, campaign_id, monster_id, binder_mortal_id, name, label, friendly, hp_max, hp_current, hp_details, ac, ac_details, sort, created_at, updated_at)
    SELECT id, campaign_id, monster_id, NULL, name, label, friendly, hp_max, hp_current, hp_details, ac, ac_details, sort, created_at, updated_at
    FROM inpcs_legacy_binder_link;
    DROP TABLE inpcs_legacy_binder_link;
    CREATE INDEX IF NOT EXISTS idx_inpcs_campaign ON inpcs(campaign_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inpcs_campaign_binder_mortal
      ON inpcs(campaign_id, binder_mortal_id) WHERE binder_mortal_id IS NOT NULL;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}
