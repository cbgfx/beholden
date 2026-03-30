// server/src/services/characters.ts
// Service-layer helpers for user-owned character operations.

import type Database from "better-sqlite3";
import type { BroadcastFn } from "../server/events.js";
import { rowToUserCharacter } from "../lib/db.js";

export type Assignment = {
  id: string;
  campaign_id: string;
  player_id: string | null;
  campaign_name: string;
};

export function getAssignments(db: Database.Database, charId: string): Assignment[] {
  return db
    .prepare(`
      SELECT cc.id, cc.campaign_id, cc.player_id, ca.name AS campaign_name
      FROM character_campaigns cc
      JOIN campaigns ca ON ca.id = cc.campaign_id
      WHERE cc.character_id = ?
    `)
    .all(charId) as Assignment[];
}

export function assignmentsToJson(assignments: Assignment[]) {
  return assignments.map((a) => ({
    id: a.id,
    campaignId: a.campaign_id,
    campaignName: a.campaign_name,
    playerId: a.player_id,
  }));
}

export function getAssignedPlayers(
  db: Database.Database,
  charId: string,
): { player_id: string; campaign_id: string }[] {
  return db
    .prepare(
      "SELECT player_id, campaign_id FROM character_campaigns WHERE character_id = ? AND player_id IS NOT NULL",
    )
    .all(charId) as { player_id: string; campaign_id: string }[];
}

export function broadcastPlayerCombatantChanges(
  db: Database.Database,
  broadcast: BroadcastFn,
  playerId: string,
) {
  const encounterIds = (
    db
      .prepare(
        `SELECT DISTINCT encounter_id
         FROM combatants
         WHERE base_type = 'player' AND base_id = ?`,
      )
      .all(playerId) as { encounter_id: string }[]
  ).map((r) => r.encounter_id);

  for (const encounterId of encounterIds) {
    broadcast("encounter:combatantsChanged", { encounterId });
  }
}

/** Overlay live player-row stats onto a user_character, resolving caster names in conditions. */
export function mergeLiveStats(
  db: Database.Database,
  char: ReturnType<typeof rowToUserCharacter>,
  assignments: Assignment[],
) {
  const playerIds = assignments.map((a) => a.player_id).filter(Boolean) as string[];
  if (playerIds.length === 0) return char;

  const liveRow = db
    .prepare(
      `SELECT player_name, character_name, class, species, level,
              hp_current, hp_max, ac, speed,
              str, dex, con, int, wis, cha,
              color, image_url,
              conditions_json, overrides_json, death_saves_json, shared_notes
       FROM players
       WHERE id IN (${playerIds.map(() => "?").join(",")})
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(...playerIds) as {
    player_name: string; character_name: string; class: string; species: string; level: number;
    hp_current: number; hp_max: number; ac: number; speed: number | null;
    str: number | null; dex: number | null; con: number | null;
    int: number | null; wis: number | null; cha: number | null;
    color: string | null; image_url: string | null;
    conditions_json: string; overrides_json: string; death_saves_json: string | null;
    shared_notes: string | null;
  } | undefined;

  if (!liveRow) return char;

  const liveConditions = JSON.parse(liveRow.conditions_json || "[]") as Array<{
    key: string;
    casterId?: string | null;
    casterName?: string | null;
    sourceName?: string | null;
    [k: string]: unknown;
  }>;

  const casterIds = [...new Set(
    liveConditions
      .map((cond) => (typeof cond.casterId === "string" && cond.casterId.trim() ? cond.casterId.trim() : ""))
      .filter(Boolean),
  )];

  const casterNameById: Record<string, string> = {};
  if (casterIds.length > 0) {
    const combatantRows = db
      .prepare(
        `SELECT c.id,
                COALESCE(NULLIF(c.label, ''), NULLIF(p.character_name, ''), NULLIF(c.name, ''), NULLIF(c.base_type, ''), 'Combatant') AS display_name
         FROM combatants c
         LEFT JOIN players p ON c.base_type = 'player' AND p.id = c.base_id
         WHERE c.id IN (${casterIds.map(() => "?").join(",")})`,
      )
      .all(...casterIds) as { id: string; display_name: string }[];
    for (const row of combatantRows) {
      casterNameById[row.id] = row.display_name;
    }

    const unresolvedCasterIds = casterIds.filter((id) => !casterNameById[id]);
    if (unresolvedCasterIds.length > 0) {
      const playerRows = db
        .prepare(
          `SELECT id, character_name
           FROM players
           WHERE id IN (${unresolvedCasterIds.map(() => "?").join(",")})`,
        )
        .all(...unresolvedCasterIds) as { id: string; character_name: string }[];
      for (const row of playerRows) {
        casterNameById[row.id] = row.character_name;
      }
    }
  }

  return {
    ...char,
    playerName:  liveRow.player_name,
    name:        liveRow.character_name,
    className:   liveRow.class,
    species:     liveRow.species,
    level:       liveRow.level,
    hpCurrent:   liveRow.hp_current,
    hpMax:       liveRow.hp_max,
    ac:          liveRow.ac,
    speed:       liveRow.speed ?? char.speed,
    strScore:    liveRow.str ?? char.strScore,
    dexScore:    liveRow.dex ?? char.dexScore,
    conScore:    liveRow.con ?? char.conScore,
    intScore:    liveRow.int ?? char.intScore,
    wisScore:    liveRow.wis ?? char.wisScore,
    chaScore:    liveRow.cha ?? char.chaScore,
    color:       liveRow.color ?? char.color,
    imageUrl:    liveRow.image_url ?? char.imageUrl,
    conditions:  liveConditions.map((cond) => {
      const casterId = typeof cond.casterId === "string" ? cond.casterId : null;
      const resolvedCasterName = casterId ? casterNameById[casterId] : null;
      if (!resolvedCasterName) return cond;
      return { ...cond, casterName: resolvedCasterName, sourceName: resolvedCasterName };
    }),
    overrides: JSON.parse(liveRow.overrides_json || '{"tempHp":0,"acBonus":0,"hpMaxBonus":0}') as {
      tempHp: number; acBonus: number; hpMaxBonus: number;
    },
    deathSaves: liveRow.death_saves_json
      ? JSON.parse(liveRow.death_saves_json) as { success: number; fail: number }
      : char.deathSaves,
    sharedNotes: liveRow.shared_notes ?? char.sharedNotes,
  };
}
