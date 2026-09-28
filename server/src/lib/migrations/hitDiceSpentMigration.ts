import { foldLegacyHitDice } from "@beholden/shared/domain/hitDice";
import { hitDieMaximaFor } from "../../services/hitDieMaxima.js";
import type { Db } from "../db.js";

/**
 * One-time move of hit dice from "how many are left" (`hitDiceCurrent` and `hitDiceCurrentBySize`)
 * to "how many are spent" (`hitDiceSpent`), deleting the old fields. See shared/domain/hitDice.ts.
 * Needs the compendium for each class's die, so it runs after the compendium tables exist. A
 * character with no old fields is not written, so later runs change nothing.
 */
export function migrateHitDiceSpent(db: Db): void {
  const rows = db.prepare("SELECT id, ruleset, character_data_json AS json FROM user_characters")
    .all() as Array<{ id: string; ruleset: string | null; json: string | null }>;
  const update = db.prepare("UPDATE user_characters SET character_data_json = ? WHERE id = ?");
  db.transaction(() => {
    for (const row of rows) {
      let data: unknown;
      try { data = JSON.parse(row.json ?? "null"); } catch { continue; }
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      const record = data as Record<string, unknown>;
      if (!("hitDiceCurrent" in record) && !("hitDiceCurrentBySize" in record)) continue;
      const folded = foldLegacyHitDice(record, hitDieMaximaFor(db, record, row.ruleset ?? "5.5e"));
      if (folded) update.run(JSON.stringify(folded), row.id);
    }
  })();
}
