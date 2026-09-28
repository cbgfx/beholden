import { foldLegacyPreparedSpells } from "@beholden/shared/domain/spellPreparation";
import type { Db } from "../db.js";

/**
 * One-time move of prepared spells onto the spell entries themselves (`prepared: true` in
 * `proficiencies.spells`), deleting the old name lists (`preparedSpells` and
 * `classSpellSelections[class].preparedSpells`). See shared/domain/spellPreparation.ts.
 *
 * Runs after the progression migration, which still produces the per-class lists for characters
 * older than it, so everything it produces is folded here too. A character whose data cannot be
 * read is left as it is; one with no old lists is not written at all, so the migration is a no-op
 * after its first run and on every database import afterwards.
 */
export function migratePreparedSpellFlags(db: Db): void {
  const rows = db.prepare("SELECT id, character_data_json AS json FROM user_characters")
    .all() as Array<{ id: string; json: string | null }>;
  const update = db.prepare("UPDATE user_characters SET character_data_json = ? WHERE id = ?");
  db.transaction(() => {
    for (const row of rows) {
      let data: unknown;
      try { data = JSON.parse(row.json ?? "null"); } catch { continue; }
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      const folded = foldLegacyPreparedSpells(data as Record<string, unknown>);
      if (folded) update.run(JSON.stringify(folded), row.id);
    }
  })();
}
