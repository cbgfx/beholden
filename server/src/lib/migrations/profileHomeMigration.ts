import { conditionAdjustedSpeed } from "@beholden/shared/domain/conditions";
import type { Db } from "../db.js";

const MARKER = "migration:profile-home-sheet";

/**
 * One-time move of a linked player's profile to its one home, the character sheet (see
 * lib/playerRowsView.ts). Names, class, level, HP maximum, AC and ability scores already have their
 * value on the sheet. Two things did not:
 *
 * - Speed as the player's app works it out (items, feats) was only ever written to the campaign
 *   rows. It moves to the sheet (`derived_speed`), from the most recently changed row - unless a
 *   condition was holding that row's speed down, in which case the sheet's own speed stands.
 * - Portraits were copied onto every row. A copy is cleared, so the row shows the sheet's portrait;
 *   one the DM uploaded for the campaign (kept under /player-images/) stays as the campaign's own.
 */
export function migrateProfileToSheet(db: Db): void {
  if (db.prepare("SELECT 1 FROM application_metadata WHERE key = ?").get(MARKER)) return;
  const characters = db.prepare(`
    SELECT DISTINCT uc.id, uc.speed, uc.derived_speed AS derivedSpeed, uc.live_json AS live
    FROM user_characters uc JOIN players p ON p.character_id = uc.id
  `).all() as Array<{ id: string; speed: number; derivedSpeed: number | null; live: string | null }>;
  const latestRow = db.prepare("SELECT speed FROM players WHERE character_id = ? ORDER BY updated_at DESC LIMIT 1");
  const writeSpeed = db.prepare("UPDATE user_characters SET derived_speed = ? WHERE id = ?");
  db.transaction(() => {
    for (const character of characters) {
      if (character.derivedSpeed != null) continue;
      const rowSpeed = (latestRow.get(character.id) as { speed: number | null } | undefined)?.speed;
      if (rowSpeed == null || rowSpeed === character.speed) continue;
      let conditions: Array<{ key?: unknown }> = [];
      try { conditions = (JSON.parse(character.live ?? "{}") as { conditions?: Array<{ key?: unknown }> }).conditions ?? []; } catch { conditions = []; }
      if (conditionAdjustedSpeed(100, conditions) !== 100) continue;
      writeSpeed.run(rowSpeed, character.id);
    }
    db.prepare(`
      UPDATE players SET image_url = NULL, image_updated_at = NULL
      WHERE character_id IS NOT NULL AND image_url IS NOT NULL AND image_url NOT LIKE '/player-images/%'
    `).run();
    db.prepare("INSERT OR REPLACE INTO application_metadata (key, value) VALUES (?, ?)").run(MARKER, String(Date.now()));
  })();
}
