import type Database from "better-sqlite3";

/** Monster IDs are ruleset-scoped, so the legacy single-column foreign key is no longer valid. */
export function removeLegacyBinderNpcMonsterForeignKey(db: Database.Database): void {
  const foreignKeys = db.prepare("PRAGMA foreign_key_list(binder_npcs)").all() as Array<{ table: string; from: string }>;
  if (!foreignKeys.some((key) => key.table === "compendium_monsters" && key.from === "monster_id")) return;

  db.transaction(() => {
    db.exec(`
      DROP TRIGGER IF EXISTS binder_npcs_require_npc_type;
      DROP TRIGGER IF EXISTS binder_player_characters_require_pc_type;

      CREATE TABLE binder_npcs_new (
        mortal_id TEXT PRIMARY KEY REFERENCES mortals(id) ON DELETE CASCADE,
        monster_id TEXT,
        hp_max INTEGER,
        hp_current INTEGER,
        hp_details TEXT,
        ac INTEGER,
        ac_details TEXT,
        attack_overrides_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO binder_npcs_new
        (mortal_id, monster_id, hp_max, hp_current, hp_details, ac, ac_details, attack_overrides_json, created_at, updated_at)
      SELECT mortal_id, monster_id, hp_max, hp_current, hp_details, ac, ac_details, attack_overrides_json, created_at, updated_at
      FROM binder_npcs;
      DROP TABLE binder_npcs;
      ALTER TABLE binder_npcs_new RENAME TO binder_npcs;
    `);
  })();
}
