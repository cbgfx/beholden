import { rowToCampaignCharacter, rowToEncounterActor } from "../../lib/db.js";
import { DEFAULT_OVERRIDES } from "../../lib/defaults.js";

/** Shared projection for list/detail reads; the join avoids per-row queries. */
export const MERGED_COMBATANT_SELECT = `
      SELECT c.*,
        p.id             AS p_id,
        p.campaign_id    AS p_campaign_id,
        p.user_id        AS p_user_id,
        p.character_id   AS p_character_id,
        p.player_name    AS p_player_name,
        p.character_name AS p_character_name,
        p.class_name     AS p_class_name,
        p.species        AS p_species,
        p.level          AS p_level,
        p.hp_max         AS p_hp_max,
        p.hp_current     AS p_hp_current,
        p.ac             AS p_ac,
        p.speed          AS p_speed,
        p.str            AS p_str,
        p.dex            AS p_dex,
        p.con            AS p_con,
        p.int            AS p_int,
        p.wis            AS p_wis,
        p.cha            AS p_cha,
        p.color          AS p_color,
        p.synced_ac      AS p_synced_ac,
        p.death_saves_success AS p_death_saves_success,
        p.death_saves_fail    AS p_death_saves_fail,
        p.live_json      AS p_live_json,
        p.image_url      AS p_image_url,
        p.image_updated_at AS p_image_updated_at,
        p.shared_notes   AS p_shared_notes,
        p.created_at     AS p_created_at,
        p.updated_at     AS p_updated_at
      FROM combatants c
      LEFT JOIN players p ON c.base_type = 'player' AND p.id = c.base_id
`;

export function rowToMergedCombatant(row: Record<string, unknown>) {
  const c = rowToEncounterActor(row);
  if (row.base_type !== "player" || row.p_id == null) return c;
  const player = rowToCampaignCharacter({
    id: row.p_id,
    campaign_id: row.p_campaign_id,
    user_id: row.p_user_id,
    character_id: row.p_character_id,
    player_name: row.p_player_name,
    character_name: row.p_character_name,
    class_name: row.p_class_name,
    species: row.p_species,
    level: row.p_level,
    hp_max: row.p_hp_max,
    hp_current: row.p_hp_current,
    ac: row.p_ac,
    speed: row.p_speed,
    str: row.p_str,
    dex: row.p_dex,
    con: row.p_con,
    int: row.p_int,
    wis: row.p_wis,
    cha: row.p_cha,
    color: row.p_color,
    synced_ac: row.p_synced_ac,
    death_saves_success: row.p_death_saves_success,
    death_saves_fail: row.p_death_saves_fail,
    live_json: row.p_live_json,
    image_url: row.p_image_url,
    image_updated_at: row.p_image_updated_at,
    shared_notes: row.p_shared_notes,
    created_at: row.p_created_at,
    updated_at: row.p_updated_at,
  });
  return {
    ...c,
    name: player.characterName,
    playerName: player.playerName,
    label: c.label || player.characterName,
    hpCurrent: player.hpCurrent,
    hpMax: player.hpMax,
    ac: player.ac,
    conditions: player.conditions ?? [],
    overrides: player.overrides ?? DEFAULT_OVERRIDES,
    ...(player.deathSaves ?? c.deathSaves ? { deathSaves: player.deathSaves ?? c.deathSaves } : {}),
  };
}
