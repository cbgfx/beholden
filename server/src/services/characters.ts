// server/src/services/characters.ts
// Service-layer helpers for user-owned character operations.

import type Database from "better-sqlite3";
import type { BroadcastFn } from "../server/events.js";
import { rowToCampaignCharacter, rowToCharacterSheet, CAMPAIGN_CHARACTER_COLS } from "../lib/db.js";
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

export function buildMirroredPlayerSnapshot(char: StoredCharacterSheet, syncedAc?: number): MirroredPlayerSnapshot {
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
    ...(syncedAc != null ? { syncedAc } : {}),
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
  void sheet;
  return "{}";
}

export function serializeCampaignCharacterSheet(snapshot: MirroredPlayerSnapshot): string {
  void snapshot;
  return "{}";
}

export function serializeCampaignCharacterLive(
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
    sheetJson: serializeCharacterSheetState(sheet),
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
    syncedAc: snapshot.syncedAc ?? null,
    sheetJson: serializeCampaignCharacterSheet(snapshot),
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
      sheet_json=?,
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
    sheetCols.sheetJson,
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
       sheet_json, live_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    sheetCols.sheetJson,
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
        updateCampaignCharacterLive(db, player_id, current, livePatch, updatedAt);
      }
    }
    broadcast("players:delta", {
      campaignId: campaign_id,
      action: "upsert",
      playerId: player_id,
      characterId: charId,
    });
    broadcastPlayerCombatantChanges(db, broadcast, player_id);
  }
}

export function broadcastPlayerCombatantChanges(
  db: Database.Database,
  broadcast: BroadcastFn,
  playerId: string,
) {
  const combatants = (
    db
      .prepare(
        `SELECT id, encounter_id
         FROM combatants
         WHERE base_type = 'player' AND base_id = ?`,
      )
      .all(playerId) as { id: string; encounter_id: string }[]
  );

  for (const { encounter_id, id } of combatants) {
    const encounterId = encounter_id;
    broadcast("encounter:combatantsDelta", {
      encounterId,
      action: "upsert",
      combatantId: id,
    });
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
      `SELECT ${CAMPAIGN_CHARACTER_COLS}
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
          `SELECT id, character_name, sheet_json
           FROM players
           WHERE id IN (${unresolvedCasterIds.map(() => "?").join(",")})`,
        )
        .all(...unresolvedCasterIds) as { id: string; character_name: string | null; sheet_json: string }[];
      for (const row of playerRows) {
        if (typeof row.character_name === "string" && row.character_name.trim()) {
          casterNameById[row.id] = row.character_name.trim();
          continue;
        }
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(row.sheet_json || "{}") as Record<string, unknown>;
        } catch {
          parsed = {};
        }
        const fallback = typeof parsed.characterName === "string" && parsed.characterName.trim()
          ? parsed.characterName.trim()
          : "Player";
        casterNameById[row.id] = fallback;
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
