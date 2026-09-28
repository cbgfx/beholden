// Treasure can belong to an encounter - the loot a monster was carrying. A fresh database declares
// `encounter_id REFERENCES encounters(id) ON DELETE CASCADE`, but every database made before that
// column existed got it from `ALTER TABLE ... ADD COLUMN encounter_id TEXT`, with no foreign key at
// all. So on an upgraded install, deleting an encounter left its loot behind pointing at nothing.
//
// SQLite cannot add a constraint to an existing column without rebuilding the table, so a trigger
// does the cascade instead. On a fresh database the foreign key already did the work and the
// trigger finds nothing left to delete.

import type Database from "better-sqlite3";

export function ensureTreasureFollowsEncounterDelete(db: Database.Database): void {
  // Anything already stranded is loot for a fight that no longer exists: exactly what the cascade
  // would have removed had it been there.
  db.exec(`
    DELETE FROM treasure
    WHERE encounter_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = treasure.encounter_id)
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS treasure_follows_encounter_delete
    AFTER DELETE ON encounters
    BEGIN
      DELETE FROM treasure WHERE encounter_id = OLD.id;
    END
  `);
}
