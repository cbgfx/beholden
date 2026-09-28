import type { Db } from "../db.js";
import { computeContentHashSync } from "@beholden/shared/domain/compendium/computeContentHashSync";
import { moveTreasureTraitToField } from "../../services/compendium/grandCompendium.monster.js";

/**
 * One-time conversion of stored monsters to the current treasure shape. Monsters used to store
 * their "Treasure" hoard hint as a trait holding the full DMG text; it now lives in the `treasure`
 * field as just the category text, and the schema rejects the old trait, so packs must already use
 * the field.
 *
 * Earlier versions ran this conversion on every start without updating `content_hash`. Those rows
 * already hold the converted text, but their hash still describes the pack entry from before
 * conversion. This refreshes the hash of every row it looks at, so a converted pack's upload
 * manifest matches what is stored instead of re-sending those monsters.
 *
 * Returns false if a row has unreadable JSON, so the migration ledger does not record it as done.
 */
export function extractMonsterTreasureTraits(db: Db): boolean {
  let complete = true;
  const rows = db
    .prepare("SELECT rowid, data_json, content_hash FROM compendium_monsters WHERE data_json LIKE '%reasure%'")
    .all() as Array<{ rowid: number; data_json: string; content_hash: string | null }>;
  // Monsters are keyed by id and ruleset together, so update by rowid rather than id.
  const update = db.prepare("UPDATE compendium_monsters SET data_json = ?, content_hash = ? WHERE rowid = ?");
  for (const row of rows) {
    let monster: Record<string, unknown>;
    try {
      monster = JSON.parse(row.data_json);
    } catch {
      complete = false;
      continue;
    }
    const changed = moveTreasureTraitToField(monster);
    const hash = computeContentHashSync(monster);
    if (changed || row.content_hash !== hash) update.run(JSON.stringify(monster), hash, row.rowid);
  }
  return complete;
}
