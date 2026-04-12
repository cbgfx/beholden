// server/src/services/combat.ts
import type Database from "better-sqlite3";
import { now, uid } from "../lib/runtime.js";
import { rowToEncounterActor, rowToCampaignCharacter, ENCOUNTER_ACTOR_COLS, CAMPAIGN_CHARACTER_COLS } from "../lib/db.js";
import type {
  StoredEncounterActor,
  StoredCampaignCharacter,
  StoredEncounterActorLiveState,
  StoredEncounterActorSnapshot,
} from "../server/userData.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import { campaignLiveDbColumns } from "./characters.js";

export function serializeEncounterActorSnapshot(snapshot: StoredEncounterActorSnapshot): string {
  return JSON.stringify(snapshot);
}

export function serializeEncounterActorLive(live: StoredEncounterActorLiveState): string {
  return JSON.stringify(live);
}

export function buildEncounterActorSnapshot(
  actor: Pick<
    StoredEncounterActor,
    "name" | "label" | "friendly" | "color" | "hpMax" | "hpDetails" | "ac" | "acDetails" | "attackOverrides"
  >,
  patch: Partial<StoredEncounterActorSnapshot> = {},
): StoredEncounterActorSnapshot {
  return {
    name: patch.name ?? actor.name,
    label: patch.label ?? actor.label,
    friendly: patch.friendly ?? actor.friendly,
    color: patch.color ?? actor.color,
    hpMax: patch.hpMax ?? actor.hpMax,
    hpDetails: patch.hpDetails !== undefined ? patch.hpDetails : actor.hpDetails,
    ac: patch.ac ?? actor.ac,
    acDetails: patch.acDetails !== undefined ? patch.acDetails : actor.acDetails,
    attackOverrides: patch.attackOverrides !== undefined ? patch.attackOverrides : actor.attackOverrides,
  };
}

export function buildEncounterActorLive(
  actor: Pick<
    StoredEncounterActor,
    | "initiative"
    | "hpCurrent"
    | "overrides"
    | "conditions"
    | "deathSaves"
    | "usedReaction"
    | "usedLegendaryActions"
    | "usedLegendaryResistances"
    | "usedSpellSlots"
  >,
  patch: Partial<StoredEncounterActorLiveState> = {},
): StoredEncounterActorLiveState {
  const deathSaves = patch.deathSaves ?? actor.deathSaves;
  return {
    initiative: patch.initiative !== undefined ? patch.initiative : actor.initiative,
    hpCurrent: patch.hpCurrent !== undefined ? patch.hpCurrent : actor.hpCurrent,
    overrides: patch.overrides ?? actor.overrides ?? DEFAULT_OVERRIDES,
    conditions: patch.conditions ?? actor.conditions ?? [],
    ...(deathSaves ? { deathSaves } : {}),
    usedReaction: patch.usedReaction ?? actor.usedReaction ?? false,
    usedLegendaryActions: patch.usedLegendaryActions ?? actor.usedLegendaryActions ?? 0,
    usedLegendaryResistances:
      patch.usedLegendaryResistances ?? actor.usedLegendaryResistances ?? 0,
    ...(patch.usedSpellSlots ?? actor.usedSpellSlots
      ? { usedSpellSlots: patch.usedSpellSlots ?? actor.usedSpellSlots ?? {} }
      : {}),
  };
}

export function updateEncounterActor(
  db: Database.Database,
  actor: StoredEncounterActor,
  updatedAt: number,
): void {
  db.prepare(`
    UPDATE combatants SET
      snapshot_json=?, live_json=?, updated_at=?
    WHERE id=? AND encounter_id=?
  `).run(
    serializeEncounterActorSnapshot(buildEncounterActorSnapshot(actor)),
    serializeEncounterActorLive(buildEncounterActorLive(actor)),
    updatedAt,
    actor.id,
    actor.encounterId,
  );
}

/** Ensures a combat record exists for the encounter; creates it if missing. */
export function ensureCombat(db: Database.Database, encounterId: string): void {
  const t = now();
  db.prepare(
    `INSERT OR IGNORE INTO combats (encounter_id, round, active_index, active_combatant_id, created_at, updated_at)
     VALUES (?, 1, 0, NULL, ?, ?)`
  ).run(encounterId, t, t);
}

export function nextLabelNumber(db: Database.Database, encounterId: string, baseName: string): number {
  ensureCombat(db, encounterId);
  const row = db.prepare(
    `SELECT COALESCE(MAX(CAST(SUBSTR(json_extract(snapshot_json, '$.label'), LENGTH(?)+2) AS INTEGER)), 0) + 1 AS n
     FROM combatants
     WHERE encounter_id = ? AND json_extract(snapshot_json, '$.label') LIKE ? || ' %'`
  ).get(baseName, encounterId, baseName) as { n: number };
  return row.n;
}

export function createPlayerCombatant({
  encounterId,
  player,
  t = now(),
}: {
  encounterId: string;
  player: StoredCampaignCharacter;
  t?: number;
}): StoredEncounterActor {
  return {
    id: uid(),
    encounterId,
    baseType: "player",
    baseId: player.id,
    name: player.characterName,
    label: player.characterName,
    initiative: null,
    friendly: true,
    color: "green",
    overrides: player.overrides ?? { ...DEFAULT_OVERRIDES },
    hpCurrent: player.hpCurrent,
    hpMax: player.hpMax,
    hpDetails: null,
    ac: player.syncedAc ?? player.ac,
    acDetails: null,
    attackOverrides: null,
    conditions: Array.isArray(player.conditions) ? player.conditions : [],
    deathSaves: player.deathSaves ?? { ...DEFAULT_DEATH_SAVES },
    createdAt: t,
    updatedAt: t,
  };
}

/** Insert a StoredEncounterActor into the combatants table. */
export function insertCombatant(db: Database.Database, c: StoredEncounterActor): void {
  db.prepare(
    `INSERT INTO combatants
       (id, encounter_id, base_type, base_id, snapshot_json, live_json, sort, created_at, updated_at)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    c.id, c.encounterId, c.baseType, c.baseId,
    serializeEncounterActorSnapshot(buildEncounterActorSnapshot(c)),
    serializeEncounterActorLive(buildEncounterActorLive(c)),
    c.sort ?? null,
    c.createdAt,
    c.updatedAt,
  );
}

/**
 * Write HP / conditions / overrides / death-saves from a player-type combatant
 * back to the players table. Returns the player's campaignId, or null if the
 * combatant is not a player type or the player row no longer exists.
 */
export function syncCombatantToPlayer(
  db: Database.Database,
  combatant: StoredEncounterActor,
  t: number
): string | null {
  if (combatant.baseType !== "player") return null;
  const pRow = db
    .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
    .get(combatant.baseId) as Record<string, unknown> | undefined;
  if (!pRow) return null;
  const player = rowToCampaignCharacter(pRow);
  const liveCols = campaignLiveDbColumns({
    hpCurrent: combatant.hpCurrent ?? player.hpCurrent,
    conditions: combatant.conditions ?? [],
    overrides: combatant.overrides ?? DEFAULT_OVERRIDES,
    ...((combatant.deathSaves ?? player.deathSaves)
      ? { deathSaves: combatant.deathSaves ?? player.deathSaves }
      : {}),
  });
  db.prepare(`
    UPDATE players SET
      hp_current=?, death_saves_success=?, death_saves_fail=?, live_json=?, updated_at=?
    WHERE id=?
  `).run(
    liveCols.hpCurrent,
    liveCols.deathSavesSuccess,
    liveCols.deathSavesFail,
    liveCols.liveJson,
    t,
    combatant.baseId
  );
  return player.campaignId;
}

/**
 * For player combatants, rehydrate mutable persistent fields from the canonical
 * players row so encounter-scoped updates never push stale snapshot values back.
 */
export function hydratePlayerCombatant(
  db: Database.Database,
  combatant: StoredEncounterActor
): StoredEncounterActor {
  if (combatant.baseType !== "player") return combatant;
  const pRow = db
    .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
    .get(combatant.baseId) as Record<string, unknown> | undefined;
  if (!pRow) return combatant;
  const player = rowToCampaignCharacter(pRow);
  return {
    ...combatant,
    name: player.characterName,
    label: combatant.label || player.characterName,
    hpCurrent: player.hpCurrent,
    hpMax: player.hpMax,
    ac: player.syncedAc ?? player.ac,
    conditions: player.conditions ?? [],
    overrides: player.overrides ?? combatant.overrides,
    ...((player.deathSaves ?? combatant.deathSaves) !== undefined
      ? { deathSaves: player.deathSaves ?? combatant.deathSaves }
      : {}),
  };
}

/** Load all combatants for an encounter, sorted by position. */
export function loadCombatants(db: Database.Database, encounterId: string): StoredEncounterActor[] {
  const rows = db.prepare(
    `SELECT ${ENCOUNTER_ACTOR_COLS} FROM combatants WHERE encounter_id = ? ORDER BY COALESCE(sort, 9999), created_at`
  ).all(encounterId) as Record<string, unknown>[];
  return rows.map(rowToEncounterActor);
}
