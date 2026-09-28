import type { Db } from "../db.js";

export const CANONICAL_PROGRESSION_VERSION = 3;

/**
 * Removes the beta-era primary-class spell mirrors after schema v2 has placed
 * every class selection under its stable class-entry id. Records awaiting an
 * explicit progression repair stay on v2 and retain their evidence.
 */
export function migrateCanonicalCharacterProgression(db: Db): void {
  const rows = db.prepare("SELECT id, character_data_json AS json FROM user_characters").all() as Array<{ id: string; json: string | null }>;
  const update = db.prepare("UPDATE user_characters SET character_data_json = ? WHERE id = ?");
  const migrate = db.transaction(() => {
    for (const row of rows) {
      let data: Record<string, unknown>;
      try { data = JSON.parse(row.json ?? "{}") as Record<string, unknown>; } catch { continue; }
      const version = Number(data.progressionSchemaVersion) || 0;
      if (version >= CANONICAL_PROGRESSION_VERSION || version < 2) continue;
      if (Array.isArray(data.progressionRepairIssues) && data.progressionRepairIssues.length > 0) continue;
      const next: Record<string, unknown> = { ...data, progressionSchemaVersion: CANONICAL_PROGRESSION_VERSION };
      delete next.chosenCantrips;
      delete next.chosenSpells;
      delete next.chosenInvocations;
      update.run(JSON.stringify(next), row.id);
    }
  });
  migrate();
}
