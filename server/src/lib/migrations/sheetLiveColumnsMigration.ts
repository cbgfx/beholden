import { mergeLiveJson, takeSheetColumnKeys } from "../sheetLiveColumns.js";
import type { Db } from "../db.js";

/**
 * One-time move of the live state and app-worked stats out of each sheet's data blob into their
 * columns (see lib/sheetLiveColumns.ts). The blob keys are deleted; a sheet without them is not
 * written, so later runs change nothing. A sheet whose data cannot be read is left as it is.
 */
export function migrateSheetLiveColumns(db: Db): void {
  const rows = db.prepare("SELECT id, character_data_json AS json, live_json AS live, ac FROM user_characters")
    .all() as Array<{ id: string; json: string | null; live: string | null; ac: number }>;
  const update = db.prepare(`
    UPDATE user_characters
    SET character_data_json = ?, live_json = ?,
        derived_hp_max = COALESCE(?, derived_hp_max), derived_speed = COALESCE(?, derived_speed), ac = ?
    WHERE id = ?
  `);
  db.transaction(() => {
    for (const row of rows) {
      let data: unknown;
      try { data = JSON.parse(row.json ?? "null"); } catch { continue; }
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      const taken = takeSheetColumnKeys(data as Record<string, unknown>);
      if (!taken) continue;
      const { values } = taken;
      update.run(
        JSON.stringify(taken.data),
        values.live ? mergeLiveJson(row.live, values.live) : (row.live ?? "{}"),
        values.derivedHpMax ?? null,
        values.derivedSpeed ?? null,
        values.derivedAc ?? row.ac,
        row.id,
      );
    }
  })();
}
