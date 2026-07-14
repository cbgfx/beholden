// server/src/services/characters.ts
// Service-layer helpers for user-owned character operations.

import type Database from "better-sqlite3";
import type { BroadcastFn } from "../server/events.js";
import { rowToCampaignCharacter, rowToCharacterSheet, rowToEncounterActor, CAMPAIGN_CHARACTER_COLS, ENCOUNTER_ACTOR_COLS } from "../lib/db.js";
import { hydratePlayerCombatant } from "./combat.js";
import { toEncounterActorDto } from "../lib/apiActors.js";
import { DEFAULT_DEATH_SAVES, DEFAULT_OVERRIDES } from "../lib/defaults.js";
import type {
  StoredCampaignCharacter,
  StoredCampaignCharacterLiveState,
  StoredCampaignCharacterSheetState,
  StoredCharacterSheet,
  StoredCharacterSheetState,
  StoredOverrides,
} from "../server/userData.js";
import { applyConditionConsequences, shouldBreakConcentration } from "./combatTransitions.js";

export type Assignment = {
  campaign_id: string;
  player_id: string;
  campaign_name: string;
};

export function syncOwnedPlayerName(
  db: Database.Database,
  userId: string,
  playerName: string,
  updatedAt: number,
): Array<{ id: string; campaign_id: string; character_id: string | null }> {
  const linkedPlayers = db.prepare(`
    SELECT id, campaign_id, character_id
    FROM players
    WHERE user_id = ?
  `).all(userId) as Array<{ id: string; campaign_id: string; character_id: string | null }>;
  db.transaction(() => {
    db.prepare("UPDATE user_characters SET player_name = ?, updated_at = ? WHERE user_id = ?")
      .run(playerName, updatedAt, userId);
    db.prepare("UPDATE players SET player_name = ?, updated_at = ? WHERE user_id = ?")
      .run(playerName, updatedAt, userId);
  })();
  return linkedPlayers;
}

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
 * Mirrored scalar fields come from the sheet baseline. Campaign-local nested
 * mutable state lives in players.live_json.
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

export function buildMirroredPlayerSnapshot(
  char: StoredCharacterSheet,
  syncedAc?: number,
  syncedSpeed?: number,
  syncedHpMax?: number,
): MirroredPlayerSnapshot {
  const storedDerivedHpMax = Number(char.characterData?.derivedHpMax);
  const derivedHpMax = syncedHpMax
    ?? (Number.isFinite(storedDerivedHpMax) && storedDerivedHpMax >= 1 ? Math.floor(storedDerivedHpMax) : char.hpMax);
  return {
    playerName: char.playerName,
    characterName: char.name,
    class: char.className,
    species: char.species,
    level: char.level,
    hpMax: derivedHpMax,
    ac: char.ac,
    speed: syncedSpeed ?? char.speed,
    ...(char.strScore != null ? { str: char.strScore } : {}),
    ...(char.dexScore != null ? { dex: char.dexScore } : {}),
    ...(char.conScore != null ? { con: char.conScore } : {}),
    ...(char.intScore != null ? { int: char.intScore } : {}),
    ...(char.wisScore != null ? { wis: char.wisScore } : {}),
    ...(char.chaScore != null ? { cha: char.chaScore } : {}),
    color: char.color,
    ...(syncedAc != null && syncedAc > 0 ? { syncedAc } : {}),
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

function serializeCampaignCharacterLive(
  live: StoredCampaignCharacterLiveState,
): string {
  const compact: Record<string, unknown> = {};
  const overrides = live.overrides ?? DEFAULT_OVERRIDES;
  const hasAbilityScores = Boolean(overrides.abilityScores && Object.keys(overrides.abilityScores).length > 0);
  const hasNonDefaultOverrides =
    overrides.tempHp !== DEFAULT_OVERRIDES.tempHp ||
    overrides.acBonus !== DEFAULT_OVERRIDES.acBonus ||
    overrides.hpMaxBonus !== DEFAULT_OVERRIDES.hpMaxBonus ||
    overrides.inspiration !== DEFAULT_OVERRIDES.inspiration ||
    hasAbilityScores;
  if (hasNonDefaultOverrides) compact.overrides = overrides;
  if (Array.isArray(live.conditions) && live.conditions.length > 0) compact.conditions = live.conditions;
  return Object.keys(compact).length > 0 ? JSON.stringify(compact) : "{}";
}

export function characterSheetDbColumns(sheet: StoredCharacterSheetState) {
  return {
    name: sheet.name,
    playerName: sheet.playerName,
    className: sheet.className,
    species: sheet.species,
    level: sheet.level,
    hpMax: sheet.hpMax,
    hpCurrent: sheet.hpCurrent,
    ac: sheet.ac,
    speed: sheet.speed,
    strScore: sheet.strScore,
    dexScore: sheet.dexScore,
    conScore: sheet.conScore,
    intScore: sheet.intScore,
    wisScore: sheet.wisScore,
    chaScore: sheet.chaScore,
    color: sheet.color ?? null,
    deathSavesSuccess: sheet.deathSaves?.success ?? null,
    deathSavesFail: sheet.deathSaves?.fail ?? null,
  };
}

export function campaignSheetDbColumns(snapshot: MirroredPlayerSnapshot) {
  return {
    playerName: snapshot.playerName,
    characterName: snapshot.characterName,
    className: snapshot.class,
    species: snapshot.species,
    level: snapshot.level,
    hpMax: snapshot.hpMax,
    ac: snapshot.ac,
    speed: snapshot.speed ?? null,
    str: snapshot.str ?? null,
    dex: snapshot.dex ?? null,
    con: snapshot.con ?? null,
    int: snapshot.int ?? null,
    wis: snapshot.wis ?? null,
    cha: snapshot.cha ?? null,
    color: snapshot.color ?? null,
    syncedAc: snapshot.syncedAc != null && snapshot.syncedAc > 0 ? snapshot.syncedAc : null,
  };
}

export function campaignLiveDbColumns(live: StoredCampaignCharacterLiveState) {
  return {
    hpCurrent: live.hpCurrent,
    deathSavesSuccess: live.deathSaves?.success ?? null,
    deathSavesFail: live.deathSaves?.fail ?? null,
    liveJson: serializeCampaignCharacterLive(live),
  };
}

function buildCampaignCharacterLive(
  current: Pick<StoredCampaignCharacter, "hpCurrent" | "overrides" | "conditions" | "deathSaves">,
  patch: Partial<StoredCampaignCharacterLiveState>,
): StoredCampaignCharacterLiveState {
  const deathSaves = patch.deathSaves ?? current.deathSaves;
  const overrides = patch.overrides
    ? { ...(current.overrides ?? DEFAULT_OVERRIDES), ...patch.overrides }
    : current.overrides ?? DEFAULT_OVERRIDES;
  return {
    hpCurrent: patch.hpCurrent ?? current.hpCurrent,
    overrides,
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
  const live = buildCampaignCharacterLive(current, patch);
  const liveCols = campaignLiveDbColumns(live);
  db.prepare(
    "UPDATE players SET hp_current=?, death_saves_success=?, death_saves_fail=?, live_json=?, updated_at=? WHERE id=?",
  ).run(liveCols.hpCurrent, liveCols.deathSavesSuccess, liveCols.deathSavesFail, liveCols.liveJson, updatedAt, playerId);
}

export function updateProjectedPlayerRow(
  db: Database.Database,
  playerId: string,
  snapshot: MirroredPlayerSnapshot,
  updatedAt: number,
  userId?: string,
) {
  const sheetCols = campaignSheetDbColumns(snapshot);
  db.prepare(`
    UPDATE players SET
      user_id=?,
      player_name=?,
      character_name=?,
      class_name=?,
      species=?,
      level=?,
      hp_max=?,
      ac=?,
      speed=?,
      str=?,
      dex=?,
      con=?,
      int=?,
      wis=?,
      cha=?,
      color=?,
      synced_ac=?,
      updated_at=?
    WHERE id=?
  `).run(
    userId ?? null,
    sheetCols.playerName,
    sheetCols.characterName,
    sheetCols.className,
    sheetCols.species,
    sheetCols.level,
    sheetCols.hpMax,
    sheetCols.ac,
    sheetCols.speed,
    sheetCols.str,
    sheetCols.dex,
    sheetCols.con,
    sheetCols.int,
    sheetCols.wis,
    sheetCols.cha,
    sheetCols.color,
    sheetCols.syncedAc,
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
  const sheetCols = campaignSheetDbColumns(snapshot);
  const liveCols = campaignLiveDbColumns(liveState);
  db.prepare(`
    INSERT INTO players
      (id, campaign_id, user_id, character_id,
       player_name, character_name, class_name, species, level, hp_max, hp_current, ac, speed,
       str, dex, con, int, wis, cha, color, synced_ac, death_saves_success, death_saves_fail,
       live_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    playerId,
    campaignId,
    userId ?? null,
    characterId ?? null,
    sheetCols.playerName,
    sheetCols.characterName,
    sheetCols.className,
    sheetCols.species,
    sheetCols.level,
    sheetCols.hpMax,
    liveCols.hpCurrent,
    sheetCols.ac,
    sheetCols.speed,
    sheetCols.str,
    sheetCols.dex,
    sheetCols.con,
    sheetCols.int,
    sheetCols.wis,
    sheetCols.cha,
    sheetCols.color,
    sheetCols.syncedAc,
    liveCols.deathSavesSuccess,
    liveCols.deathSavesFail,
    liveCols.liveJson,
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
  livePatch?: Partial<StoredCampaignCharacterLiveState>,
) {
  for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
    updateProjectedPlayerRow(db, player_id, snapshot, updatedAt, userId);
    if (livePatch && Object.keys(livePatch).length > 0) {
      const row = db
        .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
        .get(player_id) as Record<string, unknown> | undefined;
      if (row) {
        const current = rowToCampaignCharacter(row);
        const effectiveHp = livePatch.hpCurrent ?? current.hpCurrent;
        const effectiveConditions = applyConditionConsequences({
          previousHpCurrent: current.hpCurrent,
          hpCurrent: effectiveHp,
          conditions: livePatch.conditions ?? current.conditions ?? [],
        });
        const losesConcentration = shouldBreakConcentration({ hpCurrent: effectiveHp, conditions: effectiveConditions });
        if (losesConcentration && effectiveConditions.some((condition) => condition.key === "concentration")) {
          db.prepare(`
            UPDATE user_characters
            SET character_data_json = json_set(COALESCE(character_data_json, '{}'), '$.concentrationSpell', NULL)
            WHERE id = ?
          `).run(charId);
        }
        updateCampaignCharacterLive(db, player_id, current, {
          ...livePatch,
          conditions: losesConcentration
            ? effectiveConditions.filter((condition) => condition.key !== "concentration")
            : effectiveConditions,
        }, updatedAt);
      }
    }
    syncPlayerCombatantSnapshots(db, player_id);
    broadcast("players:delta", {
      campaignId: campaign_id,
      action: "upsert",
      playerId: player_id,
      characterId: charId,
    });
    broadcastPlayerCombatantChanges(db, broadcast, player_id);
  }
}

export function syncPlayerCombatantSnapshots(
  db: Database.Database,
  playerId: string,
): void {
  db.prepare(`
    UPDATE combatants
    SET snapshot_json = json_set(
      snapshot_json,
      '$.name', (SELECT character_name FROM players WHERE id = ?),
      '$.hpMax', (SELECT hp_max FROM players WHERE id = ?),
      '$.ac', (SELECT ac FROM players WHERE id = ?)
    )
    WHERE base_type = 'player' AND base_id = ?
  `).run(playerId, playerId, playerId, playerId);
}

export function broadcastPlayerCombatantChanges(
  db: Database.Database,
  broadcast: BroadcastFn,
  playerId: string,
) {
  const rows = (
    db
      .prepare(
        `SELECT ${ENCOUNTER_ACTOR_COLS}
         FROM combatants
         WHERE base_type = 'player' AND base_id = ?`,
      )
      .all(playerId) as Record<string, unknown>[]
  );

  // Inline the full combatant DTO, matching the DM-originated PUT /combatants/:id broadcast shape
  // — an already-open DM combat view refreshes from this delta alone, without a follow-up GET.
  for (const row of rows) {
    const combatant = hydratePlayerCombatant(db, rowToEncounterActor(row));
    broadcast("encounter:combatantsDelta", {
      encounterId: combatant.encounterId,
      action: "upsert",
      combatantId: combatant.id,
      combatant: toEncounterActorDto(combatant),
    });
  }
}

export function getCharacterSheetOverrides(
  char: Pick<StoredCharacterSheet, "characterData">,
): StoredOverrides | null {
  const raw = char.characterData?.sheetOverrides;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const numberOrDefault = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;

  return {
    tempHp: Math.max(0, numberOrDefault(record.tempHp, DEFAULT_OVERRIDES.tempHp)),
    acBonus: numberOrDefault(record.acBonus, DEFAULT_OVERRIDES.acBonus),
    hpMaxBonus: numberOrDefault(record.hpMaxBonus, DEFAULT_OVERRIDES.hpMaxBonus),
    ...(typeof record.inspiration === "boolean" ? { inspiration: record.inspiration } : {}),
    ...(record.abilityScores && typeof record.abilityScores === "object" && !Array.isArray(record.abilityScores)
      ? { abilityScores: record.abilityScores as StoredOverrides["abilityScores"] }
      : {}),
  };
}

/** Overlay live campaign-character state onto a character sheet, resolving caster names in conditions. */
export function mergeLiveStats(
  db: Database.Database,
  char: ReturnType<typeof rowToCharacterSheet>,
  assignments: Assignment[],
) {
  const sheetOverrides = getCharacterSheetOverrides(char);
  const playerIds = assignments.map((a) => a.player_id);
  if (playerIds.length === 0) {
    return sheetOverrides
      ? { ...char, ac: char.ac + sheetOverrides.acBonus, overrides: sheetOverrides }
      : char;
  }

  const liveRow = db
    .prepare(
      `SELECT ${CAMPAIGN_CHARACTER_COLS}
       FROM players
       WHERE id IN (${playerIds.map(() => "?").join(",")})
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(...playerIds) as Record<string, unknown> | undefined;

  if (!liveRow) {
    return sheetOverrides
      ? { ...char, ac: char.ac + sheetOverrides.acBonus, overrides: sheetOverrides }
      : char;
  }
  const live = rowToCampaignCharacter(liveRow);
  const liveConditions = live.conditions ?? [];
  const liveOverrides = live.overrides ?? DEFAULT_OVERRIDES;
  // Sheet-level overrides win here on purpose: a character can be (or have been) assigned to a
  // campaign whose `players` row hasn't been touched in ages, and that stale snapshot shouldn't
  // shadow edits made since from the character's own sheet. This is safe *only* because DM combat
  // actions are required to mirror their override changes back into the sheet too (see
  // syncCombatantToPlayer) — that keeps sheetOverrides from ever being the stale side while a
  // campaign is actively being played, which is what actually matters here.
  const effectiveOverrides = sheetOverrides
    ? {
        ...liveOverrides,
        ...sheetOverrides,
        inspiration: liveOverrides.inspiration ?? sheetOverrides.inspiration ?? false,
      }
    : liveOverrides;

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
                COALESCE(
                  NULLIF(json_extract(c.snapshot_json, '$.label'), ''),
                  NULLIF(json_extract(c.snapshot_json, '$.name'), ''),
                  NULLIF(c.base_type, ''),
                  'Combatant'
                ) AS display_name
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
          `SELECT id, character_name
           FROM players
           WHERE id IN (${unresolvedCasterIds.map(() => "?").join(",")})`,
        )
        .all(...unresolvedCasterIds) as { id: string; character_name: string | null }[];
      for (const row of playerRows) {
        casterNameById[row.id] =
          typeof row.character_name === "string" && row.character_name.trim()
            ? row.character_name.trim()
            : "Player";
      }
    }
  }

  return {
    ...char,
    ac: char.ac + effectiveOverrides.acBonus,
    hpCurrent: live.hpCurrent,
    imageUrl: live.imageUrl ?? char.imageUrl,
    conditions: liveConditions.map((cond) => {
      const casterId = typeof cond.casterId === "string" ? cond.casterId : null;
      const resolvedCasterName = casterId ? casterNameById[casterId] : null;
      if (!resolvedCasterName) return cond;
      return { ...cond, casterName: resolvedCasterName, sourceName: resolvedCasterName };
    }),
    overrides: effectiveOverrides,
    deathSaves: live.deathSaves ?? char.deathSaves,
    sharedNotes: live.sharedNotes ?? char.sharedNotes,
  };
}
