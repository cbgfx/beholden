// server/src/services/characters.ts
// Service-layer helpers for user-owned character operations.

import type Database from "better-sqlite3";
import type { BroadcastFn } from "../server/events.js";
import { rowToCharacterSheet, rowToEncounterActor, ENCOUNTER_ACTOR_COLS } from "../lib/db.js";
import { hydratePlayerCombatant } from "./combat.js";
import { toEncounterActorDto } from "../lib/apiActors.js";
import { DEFAULT_DEATH_SAVES, DEFAULT_OVERRIDES } from "../lib/defaults.js";
import type {
  StoredCampaignCharacter,
  StoredCampaignCharacterLiveState,
  StoredCampaignCharacterSheetState,
  StoredCharacterSheet,
  StoredCharacterSheetState,
  StoredConditionInstance,
  StoredOverrides,
} from "../server/userData.js";
import { applyConditionConsequences, detectEndedConcentration, shouldBreakConcentration } from "./combatTransitions.js";
import type { EndedConcentration } from "./combatTransitions.js";

export type Assignment = {
  campaign_id: string;
  player_id: string;
  campaign_name: string;
};

// MARK: - Sync Owned Player Name
export function syncOwnedPlayerName(
  db: Database.Database,
  userId: string,
  playerName: string,
  updatedAt: number,
): Array<{ id: string; campaign_id: string; character_id: string | null }> {
  const linkedPlayers = db.prepare(`
    SELECT id, campaign_id, character_id
    FROM player_rows
    WHERE user_id = ?
  `).all(userId) as Array<{ id: string; campaign_id: string; character_id: string | null }>;
  // The sheet only: a linked campaign player reads its name from there (lib/playerRowsView.ts).
  db.prepare("UPDATE user_characters SET player_name = ?, updated_at = ? WHERE user_id = ?")
    .run(playerName, updatedAt, userId);
  return linkedPlayers;
}

// MARK: - Get Assignments
export function getAssignments(db: Database.Database, charId: string): Assignment[] {
  return db
    .prepare(`
      SELECT p.campaign_id, p.id AS player_id, ca.name AS campaign_name
      FROM player_rows p
      JOIN campaigns ca ON ca.id = p.campaign_id
      WHERE p.character_id = ? AND ca.is_active = 1
    `)
    .all(charId) as Assignment[];
}

// MARK: - Get Assignments For Characters
export function getAssignmentsForCharacters(
  db: Database.Database,
  charIds: string[],
): Map<string, Assignment[]> {
  const byChar = new Map<string, Assignment[]>();
  if (charIds.length === 0) return byChar;
  const rows = db
    .prepare(`
      SELECT p.character_id, p.campaign_id, p.id AS player_id, ca.name AS campaign_name
      FROM player_rows p
      JOIN campaigns ca ON ca.id = p.campaign_id
      WHERE p.character_id IN (${charIds.map(() => "?").join(",")})
        AND ca.is_active = 1
    `)
    .all(...charIds) as Array<Assignment & { character_id: string }>;
  for (const { character_id, ...assignment } of rows) {
    const list = byChar.get(character_id);
    if (list) list.push(assignment);
    else byChar.set(character_id, [assignment]);
  }
  return byChar;
}

// MARK: - Assignments To Json
export function assignmentsToJson(assignments: Assignment[]) {
  return assignments.map((a) => ({
    id: `${a.campaign_id}:${a.player_id}`,
    campaignId: a.campaign_id,
    campaignName: a.campaign_name,
    playerId: a.player_id,
  }));
}

// MARK: - Get Assigned Players
export function getAssignedPlayers(
  db: Database.Database,
  charId: string,
): { player_id: string; campaign_id: string }[] {
  return db
    .prepare("SELECT id AS player_id, campaign_id FROM player_rows WHERE character_id = ?")
    .all(charId) as { player_id: string; campaign_id: string }[];
}

// MARK: - Get Linked Character Id For Player
export function getLinkedCharacterIdForPlayer(
  db: Database.Database,
  playerId: string,
): string | null {
  const row = db
    .prepare("SELECT character_id FROM player_rows WHERE id = ? LIMIT 1")
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

// MARK: - Build Character Sheet State
export function buildCharacterSheetState(char: StoredCharacterSheet): StoredCharacterSheetState {
  return {
    name: char.name,
    playerName: char.playerName,
    ruleset: char.ruleset,
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

// MARK: - Build Mirrored Player Snapshot
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

// MARK: - Build Campaign Character Live State
/**
 * The conditions and inspiration on a character's sheet - their one home, in or out of any
 * campaign (lib/playerRowsView.ts reads a linked player's from here).
 */
export function sheetOwnLiveState(char: Pick<StoredCharacterSheet, "live">): {
  conditions: StoredConditionInstance[];
  inspiration: boolean;
} {
  const conditions = Array.isArray(char.live?.conditions)
    ? char.live.conditions.filter((entry): entry is StoredConditionInstance =>
        Boolean(entry) && typeof entry === "object" && typeof (entry as { key?: unknown }).key === "string")
    : [];
  return { conditions, inspiration: char.live?.overrides?.inspiration === true };
}

export function buildCampaignCharacterLiveState(
  char: StoredCharacterSheet,
): StoredCampaignCharacterLiveState {
  // A linked row's live fields are never read (its sheet is the home); stored neutral.
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

// MARK: - Character Sheet Db Columns
export function characterSheetDbColumns(sheet: StoredCharacterSheetState) {
  return {
    name: sheet.name,
    playerName: sheet.playerName,
    ruleset: sheet.ruleset,
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

// MARK: - Campaign Sheet Db Columns
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

// MARK: - Campaign Live Db Columns
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
  const nextHpCurrent = patch.hpCurrent ?? current.hpCurrent;
  const healedFromZero = Number(current.hpCurrent) <= 0 && Number(nextHpCurrent) > 0;
  const deathSaves = healedFromZero ? { success: 0, fail: 0 } : patch.deathSaves ?? current.deathSaves;
  const overrides = patch.overrides
    ? { ...(current.overrides ?? DEFAULT_OVERRIDES), ...patch.overrides }
    : current.overrides ?? DEFAULT_OVERRIDES;
  return {
    hpCurrent: nextHpCurrent,
    overrides,
    conditions: patch.conditions ?? current.conditions ?? [],
    ...(deathSaves ? { deathSaves } : {}),
  };
}

// MARK: - Update Campaign Character Live
/** Applies a change to a player's live state (see buildCampaignCharacterLive) and writes it to its home. */
export function updateCampaignCharacterLive(
  db: Database.Database,
  playerId: string,
  current: Pick<StoredCampaignCharacter, "hpCurrent" | "overrides" | "conditions" | "deathSaves">,
  patch: Partial<StoredCampaignCharacterLiveState>,
  updatedAt: number,
) {
  writePlayerLiveState(db, playerId, buildCampaignCharacterLive(current, patch), updatedAt);
}

// MARK: - Player Live State (one home)
/**
 * Writes a player's live state - HP, death saves, temporary HP and bonuses, inspiration,
 * conditions - to its one home: the linked character sheet, or, for a hand-made player with no
 * sheet, the player row. Nothing else stores it; every read goes through `player_rows`
 * (lib/playerRowsView.ts), which reads each player from its home. So there is nothing to copy
 * between tables afterwards, and nothing to fall out of step.
 */
export function writePlayerLiveState(
  db: Database.Database,
  playerId: string,
  live: StoredCampaignCharacterLiveState,
  updatedAt: number,
): void {
  const characterId = getLinkedCharacterIdForPlayer(db, playerId);
  if (characterId && writeCharacterLiveState(db, characterId, live, updatedAt)) return;
  const liveCols = campaignLiveDbColumns(live);
  db.prepare(
    "UPDATE players SET hp_current=?, death_saves_success=?, death_saves_fail=?, live_json=?, updated_at=? WHERE id=?",
  ).run(liveCols.hpCurrent, liveCols.deathSavesSuccess, liveCols.deathSavesFail, liveCols.liveJson, updatedAt, playerId);
}

/**
 * Writes live state onto a character sheet: HP and death saves in their columns, bonuses (with
 * inspiration) and conditions in its `live_json` column (lib/sheetLiveColumns.ts). Returns false
 * when there is no such sheet.
 */
function writeCharacterLiveState(
  db: Database.Database,
  characterId: string,
  live: StoredCampaignCharacterLiveState,
  updatedAt: number,
): boolean {
  const overrides = live.overrides ?? DEFAULT_OVERRIDES;
  const result = db.prepare(`
    UPDATE user_characters
    SET hp_current = ?, death_saves_success = ?, death_saves_fail = ?, live_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    live.hpCurrent,
    live.deathSaves?.success ?? 0,
    live.deathSaves?.fail ?? 0,
    JSON.stringify({ overrides: { ...overrides, inspiration: overrides.inspiration === true }, conditions: live.conditions ?? [] }),
    updatedAt,
    characterId,
  );
  return result.changes > 0;
}

// MARK: - Insert Projected Player Row
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

/** A `live_json` column value, read. */
function parseLive(value: unknown): NonNullable<StoredCharacterSheet["live"]> {
  try { return (JSON.parse(String(value ?? "{}")) ?? {}) as NonNullable<StoredCharacterSheet["live"]>; } catch { return {}; }
}

// MARK: - Sync Assigned Player Rows
/**
 * After a sheet save: tells every campaign and fight the character is in to read it again. Nothing
 * is copied - the sheet is the one home of its profile and live state (lib/playerRowsView.ts).
 *
 * `hpChange` applies what a change of HP does to the character's conditions - once, on the sheet:
 * healing from 0 ends Unconscious, and dropping to 0 ends concentration (which also ends what that
 * concentration sustained in each fight, returned for the caller to sweep).
 */
export function syncAssignedPlayerRows(
  db: Database.Database,
  broadcast: BroadcastFn,
  charId: string,
  hpChange?: { previousHp: number; hpCurrent: number },
): Array<{ encounterId: string; ended: EndedConcentration }> {
  const endedConcentrations: Array<{ encounterId: string; ended: EndedConcentration }> = [];
  const players = getAssignedPlayers(db, charId);

  if (hpChange && hpChange.previousHp !== hpChange.hpCurrent) {
    const row = db.prepare("SELECT live_json FROM user_characters WHERE id = ?").get(charId) as { live_json: string | null } | undefined;
    if (row) {
      const current = sheetOwnLiveState({ live: parseLive(row.live_json) }).conditions;
      const effective = applyConditionConsequences({ previousHpCurrent: hpChange.previousHp, hpCurrent: hpChange.hpCurrent, conditions: current });
      const losesConcentration = shouldBreakConcentration({ hpCurrent: hpChange.hpCurrent, conditions: effective });
      const next = effective.filter((condition) => {
        if (losesConcentration && condition.key === "concentration") return false;
        if (hpChange.hpCurrent <= 0 && condition.key === "rage") return false;
        return true;
      });
      if (JSON.stringify(next) !== JSON.stringify(current) || losesConcentration) {
        db.prepare("UPDATE user_characters SET live_json = json_set(live_json, '$.conditions', json(?)) WHERE id = ?")
          .run(JSON.stringify(next), charId);
        if (losesConcentration) {
          db.prepare("UPDATE user_characters SET character_data_json = json_set(COALESCE(character_data_json, '{}'), '$.concentrationSpell', NULL) WHERE id = ?")
            .run(charId);
        }
      }
      if (losesConcentration) {
        for (const { player_id } of players) {
          const combatants = db.prepare(
            "SELECT id, encounter_id FROM combatants WHERE base_type = 'player' AND base_id = ?",
          ).all(player_id) as Array<{ id: string; encounter_id: string }>;
          for (const combatant of combatants) {
            const ended = detectEndedConcentration(combatant.id, current, next);
            if (ended) endedConcentrations.push({ encounterId: combatant.encounter_id, ended });
          }
        }
      }
    }
  }

  for (const { player_id, campaign_id } of players) {
    broadcast("players:delta", {
      campaignId: campaign_id,
      action: "upsert",
      playerId: player_id,
      characterId: charId,
    });
    broadcastPlayerCombatantChanges(db, broadcast, player_id);
  }
  return endedConcentrations;
}

// MARK: - Broadcast Player Combatant Changes
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

// MARK: - Get Character Sheet Overrides
/**
 * The sheet's bonuses (temporary HP, AC, HP maximum, ability bonuses, which of them are permanent),
 * from its `live_json` column. Inspiration is read separately (sheetOwnLiveState).
 */
function getCharacterSheetOverrides(
  char: Pick<StoredCharacterSheet, "live">,
): StoredOverrides | null {
  const raw = char.live?.overrides as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const numberOrDefault = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

  return {
    tempHp: Math.max(0, numberOrDefault(raw.tempHp, DEFAULT_OVERRIDES.tempHp)),
    acBonus: numberOrDefault(raw.acBonus, DEFAULT_OVERRIDES.acBonus),
    hpMaxBonus: numberOrDefault(raw.hpMaxBonus, DEFAULT_OVERRIDES.hpMaxBonus),
    ...(isRecord(raw.abilityScores) ? { abilityScores: raw.abilityScores as StoredOverrides["abilityScores"] } : {}),
    // Which bonuses a long rest keeps. Dropping this made every bonus look temporary.
    ...(isRecord(raw.permanent) ? { permanent: raw.permanent as StoredOverrides["permanent"] } : {}),
  };
}

/** Overlay live campaign-character state onto a character sheet, resolving caster names in conditions. */

// MARK: - Merge Live Stats
export function mergeLiveStats(
  db: Database.Database,
  char: ReturnType<typeof rowToCharacterSheet>,
  assignments: Assignment[],
) {
  // The sheet is the one home of the character's live state, in or out of any campaign, so there
  // is nothing to merge: bonuses, inspiration and conditions are the sheet's own.
  const sheetOverrides = getCharacterSheetOverrides(char);
  const own = sheetOwnLiveState(char);
  const overrides = { ...(sheetOverrides ?? DEFAULT_OVERRIDES), inspiration: own.inspiration };

  // Name whoever sustains a condition (Hexed by the Hag), from the fight they are in.
  const casterIds = [...new Set(
    own.conditions
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
    for (const row of combatantRows) casterNameById[row.id] = row.display_name;

    const unresolvedCasterIds = casterIds.filter((id) => !casterNameById[id]);
    if (unresolvedCasterIds.length > 0) {
      const playerRows = db
        .prepare(`SELECT id, character_name FROM player_rows WHERE id IN (${unresolvedCasterIds.map(() => "?").join(",")})`)
        .all(...unresolvedCasterIds) as { id: string; character_name: string | null }[];
      for (const row of playerRows) {
        casterNameById[row.id] = typeof row.character_name === "string" && row.character_name.trim() ? row.character_name.trim() : "Player";
      }
    }
  }

  // The DM's shared notes for this character live on its campaign row (notes system, not live state).
  const playerIds = assignments.map((a) => a.player_id);
  const notesRow = playerIds.length > 0
    ? db.prepare(`SELECT shared_notes FROM player_rows WHERE id IN (${playerIds.map(() => "?").join(",")}) ORDER BY updated_at DESC LIMIT 1`)
      .get(...playerIds) as { shared_notes: string | null } | undefined
    : undefined;

  return {
    ...char,
    ac: char.ac + overrides.acBonus,
    conditions: own.conditions.map((cond) => {
      const casterId = typeof cond.casterId === "string" ? cond.casterId : null;
      const resolvedCasterName = casterId ? casterNameById[casterId] : null;
      if (!resolvedCasterName) return cond;
      return { ...cond, casterName: resolvedCasterName, sourceName: resolvedCasterName };
    }),
    overrides,
    sharedNotes: notesRow?.shared_notes ?? char.sharedNotes,
  };
}
