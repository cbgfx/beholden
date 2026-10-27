// server/src/services/longRest.ts
// A long rest applied to a character sheet on the server, for the DM's party-wide Full Rest.

import type Database from "better-sqlite3";
import type { SharedCombatOverrides } from "@beholden/shared/domain/actors";
import { characterDataAfterLongRest } from "@beholden/shared/domain/longRest";

function speciesGrantsHeroicInspiration(
  db: Database.Database,
  data: Record<string, unknown>,
  ruleset: string,
): boolean {
  const raceId = typeof data.raceId === "string" ? data.raceId : null;
  if (!raceId) return false;
  const row = db.prepare("SELECT data_json FROM compendium_races WHERE id = ? AND ruleset = ?")
    .get(raceId, ruleset) as { data_json: string } | undefined;
  if (!row) return false;
  try {
    const race = JSON.parse(row.data_json) as { traits?: Array<{ effects?: unknown[] }> };
    return (race.traits ?? []).some((trait) => (trait.effects ?? []).some((effect) => {
      if (!effect || typeof effect !== "object") return false;
      const value = effect as { type?: unknown; resourceKey?: unknown };
      return value.type === "resource_grant" && value.resourceKey === "heroic_inspiration";
    }));
  } catch {
    return false;
  }
}

/**
 * Rests a character sheet as the player's own Long Rest button would: the stored data through the
 * shared long-rest rules, HP to the rested value the campaign row got, death saves cleared, the
 * sheet's bonuses reduced to what survives the night, and the sheet's own conditions rested too.
 *
 * `rested` is the rested live state worked out by the caller (HP, bonuses, conditions). The
 * inspiration flag stays as it is; the bonus record never holds it.
 */
export function longRestCharacterSheet(
  db: Database.Database,
  characterId: string,
  rested: { hpCurrent: number; overrides: SharedCombatOverrides; conditions: unknown[] },
  t: number,
): void {
  const row = db.prepare("SELECT character_data_json AS json, live_json AS live, ruleset FROM user_characters WHERE id = ?")
    .get(characterId) as { json: string | null; live: string | null; ruleset: string } | undefined;
  if (!row) return;
  let data: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(row.json ?? "{}");
    if (parsed === null) data = {};
    else if (typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch { /* Preserve unreadable sheet data, but still restore HP and clear death saves. */ }

  // Everything a long rest restores in the data, and the rested live state in its column
  // (lib/sheetLiveColumns.ts), preserving inspiration or granting it when the character's species
  // has the structured heroic-inspiration resource (Human's Resourceful).
  let inspiration = false;
  try { inspiration = (JSON.parse(row.live ?? "{}") as { overrides?: { inspiration?: unknown } }).overrides?.inspiration === true; } catch { /* none */ }
  inspiration ||= data !== null && speciesGrantsHeroicInspiration(db, data, row.ruleset);
  const { inspiration: _ignored, ...bonuses } = rested.overrides;
  db.prepare(`
    UPDATE user_characters
    SET character_data_json = CASE WHEN ? THEN ? ELSE character_data_json END, live_json = ?, hp_current = ?, death_saves_success = 0, death_saves_fail = 0, updated_at = ?
    WHERE id = ?
  `).run(
    data === null ? 0 : 1,
    data === null ? null : JSON.stringify(characterDataAfterLongRest(data)),
    JSON.stringify({ overrides: { ...bonuses, inspiration }, conditions: rested.conditions }),
    rested.hpCurrent, t, characterId,
  );
}
