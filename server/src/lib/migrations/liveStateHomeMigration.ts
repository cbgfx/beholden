import { rowToCampaignCharacter } from "../dbConverters.js";
import { CAMPAIGN_CHARACTER_COLS } from "../dbColumns.js";
import { DEFAULT_OVERRIDES } from "../defaults.js";
import type { Db } from "../db.js";

const MARKER = "migration:live-state-home-sheet";

/**
 * One-time move of a linked character's live state to its one home, the character sheet's
 * `live_json`, HP and death-save columns (see lib/playerRowsView.ts). Until now each campaign
 * player row kept its own copy and reads merged them: HP, conditions and death saves from the most
 * recently changed row, bonuses from the sheet, inspiration from the row. That merged result is
 * exactly what players and DMs saw, so it is what the sheet gets - nobody's numbers move. The rows'
 * copies are then cleared: nothing reads them.
 *
 * Runs after migrateSheetLiveColumns, so the sheet's own bonuses are already in its `live_json`.
 * Recorded in application_metadata, since after it runs a cleared row can no longer be told apart
 * from one that never had anything.
 */
export function migrateLiveStateToSheet(db: Db): void {
  if (db.prepare("SELECT 1 FROM application_metadata WHERE key = ?").get(MARKER)) return;
  const characters = db.prepare(`
    SELECT DISTINCT uc.id, uc.live_json AS live, uc.death_saves_success AS dss, uc.death_saves_fail AS dsf
    FROM user_characters uc JOIN players p ON p.character_id = uc.id
  `).all() as Array<{ id: string; live: string | null; dss: number | null; dsf: number | null }>;
  const latestRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE character_id = ? ORDER BY updated_at DESC LIMIT 1`);
  const writeSheet = db.prepare(`
    UPDATE user_characters SET hp_current = ?, death_saves_success = ?, death_saves_fail = ?, live_json = ? WHERE id = ?
  `);
  db.transaction(() => {
    for (const character of characters) {
      const row = latestRow.get(character.id) as Record<string, unknown> | undefined;
      if (!row) continue;
      let sheetLive: { overrides?: Record<string, unknown> } = {};
      try { sheetLive = JSON.parse(character.live ?? "{}") ?? {}; } catch { sheetLive = {}; }
      const sheetBonuses = sheetLive.overrides && typeof sheetLive.overrides === "object" ? { ...sheetLive.overrides } : null;
      if (sheetBonuses) delete sheetBonuses.inspiration;
      const live = rowToCampaignCharacter(row);
      const { inspiration, ...rowBonuses } = live.overrides ?? DEFAULT_OVERRIDES;
      const deathSaves = live.deathSaves
        ?? (character.dss != null || character.dsf != null ? { success: character.dss ?? 0, fail: character.dsf ?? 0 } : null);
      writeSheet.run(
        live.hpCurrent,
        deathSaves?.success ?? 0,
        deathSaves?.fail ?? 0,
        JSON.stringify({
          overrides: { ...rowBonuses, ...(sheetBonuses ?? {}), inspiration: inspiration === true },
          conditions: live.conditions ?? [],
        }),
        character.id,
      );
    }
    db.prepare("UPDATE players SET live_json = '{}', death_saves_success = NULL, death_saves_fail = NULL WHERE character_id IS NOT NULL").run();
    db.prepare("INSERT OR REPLACE INTO application_metadata (key, value) VALUES (?, ?)").run(MARKER, String(Date.now()));
  })();
}
