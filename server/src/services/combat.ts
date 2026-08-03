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
import { removeConditionsOwnedBy, type EndedConcentration } from "./combatTransitions.js";
import { toEncounterActorDto } from "../lib/apiActors.js";
import type { BroadcastFn } from "../server/events.js";

function serializeEncounterActorSnapshot(snapshot: StoredEncounterActorSnapshot): string {
  return JSON.stringify(snapshot);
}

function serializeEncounterActorLive(live: StoredEncounterActorLiveState): string {
  return JSON.stringify(live);
}

function buildEncounterActorSnapshot(
  actor: Pick<
    StoredEncounterActor,
    "name" | "label" | "friendly" | "color" | "hpMax" | "hpDetails" | "ac" | "acDetails" | "attackOverrides" | "description"
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
    ...(patch.description ?? actor.description
      ? { description: patch.description ?? actor.description }
      : {}),
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
    | "engagedWithPlayers"
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
    ...(patch.engagedWithPlayers ?? actor.engagedWithPlayers
      ? { engagedWithPlayers: true }
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

/** Initializes combat state on the encounter row if not already set. */
export function ensureCombat(db: Database.Database, encounterId: string): void {
  db.prepare(
    `UPDATE encounters SET combat_round = COALESCE(combat_round, 1), updated_at = ? WHERE id = ?`
  ).run(now(), encounterId);
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
    ac: player.ac,
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
): { campaignId: string; characterId: string | null } | null {
  if (combatant.baseType !== "player") return null;
  const pRow = db
    .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
    .get(combatant.baseId) as Record<string, unknown> | undefined;
  if (!pRow) return null;
  const player = rowToCampaignCharacter(pRow);
  const overrides = combatant.overrides ?? DEFAULT_OVERRIDES;
  const liveCols = campaignLiveDbColumns({
    hpCurrent: combatant.hpCurrent ?? player.hpCurrent,
    conditions: combatant.conditions ?? [],
    overrides,
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

  // Mirror the override change (tempHp/acBonus/hpMaxBonus/inspiration) back onto the linked
  // character sheet too. mergeLiveStats deliberately prefers a character's own sheetOverrides over
  // this campaign row when reading the character outside of this sync (so a long-abandoned
  // campaign assignment can't shadow edits made since from the sheet) — without this mirror, that
  // same preference would instead hide a DM's *current* combat edit behind an out-of-date sheet
  // copy the moment the player's own screen re-reads their character.
  if (player.characterId) {
    db.prepare(`
      UPDATE user_characters
      SET character_data_json = json_set(COALESCE(character_data_json, '{}'), '$.sheetOverrides', json(?)),
          updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(overrides), t, player.characterId);
  }

  return { campaignId: player.campaignId, characterId: player.characterId ?? null };
}

export type BinderNpcSyncResult = {
  mortalId: string;
  campaignIds: string[];
  encounterIds: string[];
};

/**
 * Binder-backed iNPCs are projections of one canonical NPC, like campaign
 * Player rows are projections of a character sheet. Persist shared mechanics
 * and HP once, then repair every linked campaign and encounter projection.
 */
export function syncCombatantToBinderNpc(
  db: Database.Database,
  combatant: StoredEncounterActor,
  t: number,
): BinderNpcSyncResult | null {
  if (combatant.baseType !== "inpc") return null;
  const link = db.prepare(`
    SELECT i.binder_mortal_id
    FROM inpcs i JOIN binder_npcs npc ON npc.mortal_id = i.binder_mortal_id
    WHERE i.id = ? AND i.binder_mortal_id IS NOT NULL
  `).get(combatant.baseId) as { binder_mortal_id: string } | undefined;
  if (!link) return null;

  const attackOverridesJson = combatant.attackOverrides == null
    ? null
    : JSON.stringify(combatant.attackOverrides);
  db.prepare(`
    UPDATE binder_npcs SET
      hp_max = ?, hp_current = ?, hp_details = ?, ac = ?, ac_details = ?,
      attack_overrides_json = ?, updated_at = ?
    WHERE mortal_id = ?
  `).run(
    combatant.hpMax, combatant.hpCurrent, combatant.hpDetails,
    combatant.ac, combatant.acDetails, attackOverridesJson, t, link.binder_mortal_id,
  );
  db.prepare(`
    UPDATE inpcs SET
      hp_max = ?, hp_current = ?, hp_details = ?, ac = ?, ac_details = ?, updated_at = ?
    WHERE binder_mortal_id = ?
  `).run(
    combatant.hpMax, combatant.hpCurrent, combatant.hpDetails,
    combatant.ac, combatant.acDetails, t, link.binder_mortal_id,
  );
  db.prepare(`
    UPDATE combatants SET
      snapshot_json = json_set(
        snapshot_json,
        '$.hpMax', ?, '$.hpDetails', ?, '$.ac', ?, '$.acDetails', ?,
        '$.attackOverrides', json(?)
      ),
      live_json = json_set(live_json, '$.hpCurrent', ?),
      updated_at = ?
    WHERE base_type = 'inpc'
      AND base_id IN (SELECT id FROM inpcs WHERE binder_mortal_id = ?)
  `).run(
    combatant.hpMax, combatant.hpDetails, combatant.ac, combatant.acDetails,
    JSON.stringify(combatant.attackOverrides ?? null), combatant.hpCurrent, t, link.binder_mortal_id,
  );
  const campaignIds = (db.prepare(
    "SELECT DISTINCT campaign_id FROM inpcs WHERE binder_mortal_id = ?",
  ).all(link.binder_mortal_id) as Array<{ campaign_id: string }>).map((row) => row.campaign_id);
  const encounterIds = (db.prepare(`
    SELECT DISTINCT c.encounter_id
    FROM combatants c JOIN inpcs i ON c.base_type = 'inpc' AND c.base_id = i.id
    WHERE i.binder_mortal_id = ?
  `).all(link.binder_mortal_id) as Array<{ encounter_id: string }>).map((row) => row.encounter_id);
  return { mortalId: link.binder_mortal_id, campaignIds, encounterIds };
}

/**
 * For player combatants, rehydrate mutable persistent fields from the canonical
 * players row so encounter-scoped updates never push stale snapshot values back.
 */
export function hydratePlayerCombatant(
  db: Database.Database,
  combatant: StoredEncounterActor
): StoredEncounterActor {
  if (combatant.baseType === "inpc") {
    const npc = db.prepare(`
      SELECT br.name, npc.hp_max, npc.hp_current, npc.hp_details, npc.ac,
             npc.ac_details, npc.attack_overrides_json
      FROM inpcs i
      JOIN binder_npcs npc ON npc.mortal_id = i.binder_mortal_id
      JOIN binder_records br ON br.id = npc.mortal_id
      WHERE i.id = ? AND i.binder_mortal_id IS NOT NULL
    `).get(combatant.baseId) as {
      name: string; hp_max: number | null; hp_current: number | null;
      hp_details: string | null; ac: number | null; ac_details: string | null;
      attack_overrides_json: string | null;
    } | undefined;
    if (!npc) return combatant;
    let attackOverrides = combatant.attackOverrides;
    if (npc.attack_overrides_json) {
      try { attackOverrides = JSON.parse(npc.attack_overrides_json); } catch { /* retain projection */ }
    } else if (npc.attack_overrides_json === null) {
      attackOverrides = null;
    }
    return {
      ...combatant,
      name: npc.name,
      hpMax: npc.hp_max ?? combatant.hpMax,
      hpCurrent: npc.hp_current ?? combatant.hpCurrent,
      hpDetails: npc.hp_details,
      ac: npc.ac ?? combatant.ac,
      acDetails: npc.ac_details,
      attackOverrides,
    };
  }
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
    ac: player.ac,
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

/**
 * When a caster's concentration ends, strips any conditions it was sustaining (per
 * removeConditionsOwnedBy's ownership rules) from every other combatant in the encounter,
 * persisting and broadcasting each changed row exactly like a normal combatant patch. Used by both
 * the DM combatant PUT route and the player-originated conditions PATCH route so ending
 * concentration has the same cross-combatant effect regardless of who triggered it.
 */
export function sweepDependentConditions(
  db: Database.Database,
  broadcast: BroadcastFn,
  encounterId: string,
  ended: EndedConcentration,
  t: number,
  excludeCombatantId?: string,
): void {
  for (const combatant of loadCombatants(db, encounterId)) {
    if (combatant.id === excludeCombatantId) continue;
    const hydrated = hydratePlayerCombatant(db, combatant);
    const conditions = removeConditionsOwnedBy(hydrated.conditions, ended);
    if (conditions.length === hydrated.conditions.length) continue;

    const next: StoredEncounterActor = { ...hydrated, conditions, updatedAt: t };
    updateEncounterActor(db, next, t);
    const synced = syncCombatantToPlayer(db, next, t);
    if (synced) {
      broadcast("players:delta", {
        campaignId: synced.campaignId,
        action: next.baseType === "player" ? "upsert" : "refresh",
        ...(next.baseType === "player" ? { playerId: next.baseId } : {}),
      });
    }
    broadcast("encounter:combatantsDelta", {
      encounterId,
      action: "upsert",
      combatantId: next.id,
      combatant: toEncounterActorDto(next),
    });
  }
}
