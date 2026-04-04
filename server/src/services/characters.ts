// server/src/services/characters.ts
// Service-layer helpers for user-owned character operations.

import type Database from "better-sqlite3";
import type { BroadcastFn } from "../server/events.js";
import { rowToCampaignCharacter, rowToCharacterSheet } from "../lib/db.js";
import { DEFAULT_DEATH_SAVES, DEFAULT_OVERRIDES } from "../lib/defaults.js";
import type {
  StoredCampaignCharacter,
  StoredCampaignCharacterLiveState,
  StoredCampaignCharacterSheetState,
  StoredCharacterSheet,
  StoredCharacterSheetState,
} from "../server/userData.js";

export type Assignment = {
  campaign_id: string;
  player_id: string;
  campaign_name: string;
};

export function getAssignments(db: Database.Database, charId: string): Assignment[] {
  return db
    .prepare(`
      SELECT p.campaign_id, p.id AS player_id, ca.name AS campaign_name
      FROM players p
      JOIN campaigns ca ON ca.id = p.campaign_id
      WHERE p.character_id = ?
    `)
    .all(charId) as Assignment[];
}

export function assignmentsToJson(assignments: Assignment[]) {
  return assignments.map((a) => ({
    id: `${a.campaign_id}:${a.player_id}`,
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
    .prepare("SELECT id AS player_id, campaign_id FROM players WHERE character_id = ?")
    .all(charId) as { player_id: string; campaign_id: string }[];
}

export function getLinkedCharacterIdForPlayer(
  db: Database.Database,
  playerId: string,
): string | null {
  const row = db
    .prepare("SELECT character_id FROM players WHERE id = ? LIMIT 1")
    .get(playerId) as { character_id: string | null } | undefined;
  return row?.character_id ?? null;
}

export interface MirroredPlayerSnapshot extends StoredCampaignCharacterSheetState {}

/**
 * Linked campaign characters are projections of canonical character sheets.
 *
 * Mirrored fields come from the sheet baseline and are synchronized into
 * players.sheet_json. Campaign-local mutable state lives in players.live_json.
 */

export function buildCharacterSheetState(char: StoredCharacterSheet): StoredCharacterSheetState {
  return {
    name: char.name,
    playerName: char.playerName,
    className: char.className,
    species: char.species,
    level: char.level,
    hpMax: char.hpMax,
    hpCurrent: char.hpCurrent,
    ac: char.ac,
    speed: char.speed,
    strScore: char.strScore,
    dexScore: char.dexScore,
    conScore: char.conScore,
    intScore: char.intScore,
    wisScore: char.wisScore,
    chaScore: char.chaScore,
    color: char.color,
    ...(char.deathSaves ? { deathSaves: char.deathSaves } : {}),
  };
}

export function buildMirroredPlayerSnapshot(char: StoredCharacterSheet): MirroredPlayerSnapshot {
  return {
    playerName: char.playerName,
    characterName: char.name,
    class: char.className,
    species: char.species,
    level: char.level,
    hpMax: char.hpMax,
    ac: char.ac,
    speed: char.speed,
    ...(char.strScore != null ? { str: char.strScore } : {}),
    ...(char.dexScore != null ? { dex: char.dexScore } : {}),
    ...(char.conScore != null ? { con: char.conScore } : {}),
    ...(char.intScore != null ? { int: char.intScore } : {}),
    ...(char.wisScore != null ? { wis: char.wisScore } : {}),
    ...(char.chaScore != null ? { cha: char.chaScore } : {}),
    color: char.color,
  };
}

export function buildCampaignCharacterLiveState(
  char: StoredCharacterSheet,
): StoredCampaignCharacterLiveState {
  return {
    hpCurrent: char.hpCurrent,
    overrides: { ...DEFAULT_OVERRIDES },
    conditions: [],
    deathSaves: char.deathSaves ?? { ...DEFAULT_DEATH_SAVES },
  };
}

export function serializeCharacterSheetState(sheet: StoredCharacterSheetState): string {
  return JSON.stringify(sheet);
}

export function serializeCampaignCharacterSheet(snapshot: MirroredPlayerSnapshot): string {
  return JSON.stringify(snapshot);
}

export function serializeCampaignCharacterLive(
  live: StoredCampaignCharacterLiveState,
): string {
  return JSON.stringify({
    hpCurrent: live.hpCurrent,
    overrides: live.overrides ?? DEFAULT_OVERRIDES,
    conditions: live.conditions ?? [],
    ...(live.deathSaves ? { deathSaves: live.deathSaves } : {}),
  });
}

export function buildCampaignCharacterLive(
  current: Pick<StoredCampaignCharacter, "hpCurrent" | "overrides" | "conditions" | "deathSaves">,
  patch: Partial<StoredCampaignCharacterLiveState>,
): StoredCampaignCharacterLiveState {
  const deathSaves = patch.deathSaves ?? current.deathSaves;
  return {
    hpCurrent: patch.hpCurrent ?? current.hpCurrent,
    overrides: patch.overrides ?? current.overrides ?? DEFAULT_OVERRIDES,
    conditions: patch.conditions ?? current.conditions ?? [],
    ...(deathSaves ? { deathSaves } : {}),
  };
}

export function updateCampaignCharacterLive(
  db: Database.Database,
  playerId: string,
  current: Pick<StoredCampaignCharacter, "hpCurrent" | "overrides" | "conditions" | "deathSaves">,
  patch: Partial<StoredCampaignCharacterLiveState>,
  updatedAt: number,
) {
  db.prepare("UPDATE players SET live_json=?, updated_at=? WHERE id=?")
    .run(
      serializeCampaignCharacterLive(buildCampaignCharacterLive(current, patch)),
      updatedAt,
      playerId,
    );
}

export function updateProjectedPlayerRow(
  db: Database.Database,
  playerId: string,
  snapshot: MirroredPlayerSnapshot,
  updatedAt: number,
  userId?: string,
) {
  db.prepare(`
    UPDATE players SET
      user_id=?,
      sheet_json=?,
      updated_at=?
    WHERE id=?
  `).run(
    userId ?? null,
    serializeCampaignCharacterSheet(snapshot),
    updatedAt,
    playerId,
  );
}

export function insertProjectedPlayerRow(
  db: Database.Database,
  {
    playerId,
    campaignId,
    characterId,
    snapshot,
    liveState,
    createdAt,
    updatedAt,
    userId,
  }: {
    playerId: string;
    campaignId: string;
    characterId?: string;
    snapshot: MirroredPlayerSnapshot;
    liveState: StoredCampaignCharacterLiveState;
    createdAt: number;
    updatedAt: number;
    userId?: string;
  },
) {
  db.prepare(`
    INSERT INTO players
      (id, campaign_id, user_id, character_id, sheet_json, live_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    playerId,
    campaignId,
    userId ?? null,
    characterId ?? null,
    serializeCampaignCharacterSheet(snapshot),
    serializeCampaignCharacterLive(liveState),
    createdAt,
    updatedAt,
  );
}

export function syncAssignedPlayerRows(
  db: Database.Database,
  broadcast: BroadcastFn,
  charId: string,
  snapshot: MirroredPlayerSnapshot,
  updatedAt: number,
  userId?: string,
) {
  for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
    updateProjectedPlayerRow(db, player_id, snapshot, updatedAt, userId);
    broadcast("players:changed", { campaignId: campaign_id });
    broadcastPlayerCombatantChanges(db, broadcast, player_id);
  }
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

/** Overlay live campaign-character stats onto a character sheet, resolving caster names in conditions. */
export function mergeLiveStats(
  db: Database.Database,
  char: ReturnType<typeof rowToCharacterSheet>,
  assignments: Assignment[],
) {
  const playerIds = assignments.map((a) => a.player_id);
  if (playerIds.length === 0) return char;

  const liveRow = db
    .prepare(
      `SELECT id, campaign_id, user_id, character_id, sheet_json, live_json, image_url, shared_notes, created_at, updated_at
       FROM players
       WHERE id IN (${playerIds.map(() => "?").join(",")})
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(...playerIds) as Record<string, unknown> | undefined;

  if (!liveRow) return char;
  const live = rowToCampaignCharacter(liveRow);
  const liveConditions = live.conditions ?? [];

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
                COALESCE(NULLIF(c.label, ''), NULLIF(c.name, ''), NULLIF(c.base_type, ''), 'Combatant') AS display_name
         FROM combatants c
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
          `SELECT id, sheet_json
           FROM players
           WHERE id IN (${unresolvedCasterIds.map(() => "?").join(",")})`,
        )
        .all(...unresolvedCasterIds) as { id: string; sheet_json: string }[];
      for (const row of playerRows) {
        const actor = rowToCampaignCharacter({
          id: row.id,
          campaign_id: "",
          user_id: null,
          character_id: null,
          sheet_json: row.sheet_json,
          live_json: "{}",
          image_url: null,
          shared_notes: "",
          created_at: 0,
          updated_at: 0,
        });
        casterNameById[row.id] = actor.characterName;
      }
    }
  }

  return {
    ...char,
    playerName: live.playerName,
    name: live.characterName,
    className: live.class,
    species: live.species,
    level: live.level,
    hpCurrent: live.hpCurrent,
    hpMax: live.hpMax,
    ac: live.ac,
    speed: live.speed ?? char.speed,
    strScore: live.str ?? char.strScore,
    dexScore: live.dex ?? char.dexScore,
    conScore: live.con ?? char.conScore,
    intScore: live.int ?? char.intScore,
    wisScore: live.wis ?? char.wisScore,
    chaScore: live.cha ?? char.chaScore,
    color: live.color ?? char.color,
    imageUrl: live.imageUrl ?? char.imageUrl,
    conditions: liveConditions.map((cond) => {
      const casterId = typeof cond.casterId === "string" ? cond.casterId : null;
      const resolvedCasterName = casterId ? casterNameById[casterId] : null;
      if (!resolvedCasterName) return cond;
      return { ...cond, casterName: resolvedCasterName, sourceName: resolvedCasterName };
    }),
    overrides: live.overrides ?? DEFAULT_OVERRIDES,
    deathSaves: live.deathSaves ?? char.deathSaves,
    sharedNotes: live.sharedNotes ?? char.sharedNotes,
  };
}
