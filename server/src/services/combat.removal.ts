// server/src/services/combat.removal.ts
//
// The one way a combatant leaves an encounter.
//
// A combatant is pointed at from three places the database cannot see: the encounter's turn pointer
// (`encounters.combat_active_combatant_id`), the conditions it is sustaining on other combatants
// (`casterId` inside their JSON - Hex, Hunter's Mark), and, in the other direction, its own
// `base_id`, which points at a player, a monster or an INPC through one column with no foreign key.
//
// Combatants used to be removed in three different routes - deleting a combatant, removing a player
// (or their character) from a campaign, deleting an INPC - and each remembered a different part of
// the cleanup. None of them ended the conditions the combatant was sustaining, so Hex and Hunter's
// Mark stayed on monsters after the caster was gone; only one handed on the turn; and two of the
// three left players standing in encounters after the player was deleted. Everything goes through
// here now, and the startup maintenance repairs what is already stranded.

import type Database from "better-sqlite3";
import { nextTurn, orderByInitiative, type TurnableCombatant } from "@beholden/shared/domain/combatTurnOrder";
import type { BroadcastFn } from "../server/events.js";
import { hydratePlayerCombatant, loadCombatants, sweepDependentConditions } from "./combat.js";

/** Who acts after `combatantId`, worked out while they are still in the order. */
function turnAfter(
  db: Database.Database,
  encounterId: string,
  combatantId: string,
  round: number,
): { round: number; activeId: string | null } {
  const ordered = orderByInitiative(
    loadCombatants(db, encounterId)
      .map((entry) => hydratePlayerCombatant(db, entry))
      .map((entry): TurnableCombatant => ({
        id: entry.id,
        initiative: entry.initiative ?? null,
        label: entry.label ?? "",
        name: entry.name ?? "",
        baseType: entry.baseType,
        hpCurrent: entry.hpCurrent ?? null,
      })),
  );
  const next = nextTurn(ordered, { round, activeId: combatantId });
  // With nobody else left to act, there is no turn to hand on.
  return next.activeId && next.activeId !== combatantId ? next : { round: next.round, activeId: null };
}

export type CombatantRemoval = {
  removed: boolean;
  /** Set when it was this combatant's turn, and the turn moved on to someone else (or to nobody). */
  turnHandedTo: { round: number; activeId: string | null } | null;
};

/**
 * Removes one combatant from its encounter, and everything that pointed at it:
 * - if it was their turn, the turn goes to whoever follows them in initiative;
 * - conditions they were sustaining on anyone else end, as they would when a caster's
 *   concentration does;
 * - clients watching the encounter are told.
 */
export function removeCombatant(
  db: Database.Database,
  broadcast: BroadcastFn,
  encounterId: string,
  combatantId: string,
  t: number,
): CombatantRemoval {
  const exists = db.prepare("SELECT 1 FROM combatants WHERE id = ? AND encounter_id = ?").get(combatantId, encounterId);
  if (!exists) return { removed: false, turnHandedTo: null };

  const encounter = db
    .prepare("SELECT combat_round, combat_active_combatant_id FROM encounters WHERE id = ?")
    .get(encounterId) as { combat_round: number | null; combat_active_combatant_id: string | null } | undefined;
  const turnHandedTo = encounter?.combat_active_combatant_id === combatantId
    ? turnAfter(db, encounterId, combatantId, encounter?.combat_round ?? 1)
    : null;

  db.transaction(() => {
    // Everything they were concentrating on for someone else ends with them.
    sweepDependentConditions(db, broadcast, encounterId, { casterId: combatantId, concentrationId: null }, t, combatantId);
    db.prepare("DELETE FROM combatants WHERE id = ? AND encounter_id = ?").run(combatantId, encounterId);
    if (turnHandedTo) {
      db.prepare("UPDATE encounters SET combat_round = ?, combat_active_combatant_id = ?, updated_at = ? WHERE id = ?")
        .run(turnHandedTo.round, turnHandedTo.activeId, t, encounterId);
    }
  })();

  broadcast("encounter:combatantsDelta", { encounterId, action: "delete", combatantId });
  if (turnHandedTo) broadcast("encounter:combatStateChanged", { encounterId });
  return { removed: true, turnHandedTo };
}

/** Removes every combatant built from `base_type`/`base_id`, across all encounters. */
function removeCombatantsOf(
  db: Database.Database,
  broadcast: BroadcastFn,
  baseType: "player" | "inpc",
  baseId: string,
  t: number,
): number {
  const rows = db
    .prepare("SELECT id, encounter_id FROM combatants WHERE base_type = ? AND base_id = ?")
    .all(baseType, baseId) as { id: string; encounter_id: string }[];
  let removed = 0;
  for (const row of rows) {
    if (removeCombatant(db, broadcast, row.encounter_id, row.id, t).removed) removed += 1;
  }
  return removed;
}

/** A player who is gone from the campaign cannot stand in its encounters. */
export function removePlayerCombatants(db: Database.Database, broadcast: BroadcastFn, playerId: string, t = Date.now()): number {
  return removeCombatantsOf(db, broadcast, "player", playerId, t);
}

/** Nor can an INPC who has been deleted. */
export function removeInpcCombatants(db: Database.Database, broadcast: BroadcastFn, inpcId: string, t = Date.now()): number {
  return removeCombatantsOf(db, broadcast, "inpc", inpcId, t);
}

// --- repairing what is already stranded ------------------------------------------------------

export type CombatIntegrityReport = {
  /** Combatants whose player or INPC is gone. */
  orphanedCombatants: number;
  /** Conditions naming a caster who is no longer in the encounter. */
  strandedCasterConditions: number;
  /** Encounters whose turn points at a combatant that is not in them. */
  danglingTurnPointers: number;
};

/**
 * Finds - and, with `repair`, fixes - every combat reference that points at nothing.
 *
 * Monster combatants are deliberately not on this list: a combatant carries its own snapshot of the
 * monster, so one whose compendium entry has been deleted (or is mid-reimport) is still a perfectly
 * good combatant. Removing it would empty encounters every time the compendium was replaced.
 */
export function checkCombatIntegrity(
  db: Database.Database,
  broadcast: BroadcastFn,
  options: { repair: boolean; t?: number } = { repair: false },
): CombatIntegrityReport {
  const t = options.t ?? Date.now();

  const orphans = db.prepare(`
    SELECT c.id, c.encounter_id AS encounterId
    FROM combatants c
    -- The stored rows, not the read-through view: this only asks whether the player still exists,
    -- and the report also runs on a database no server has opened yet (npm run db:maintenance on a
    -- restored backup), where the view has not been created.
    WHERE (c.base_type = 'player' AND NOT EXISTS (SELECT 1 FROM players p WHERE p.id = c.base_id))
       OR (c.base_type = 'inpc' AND NOT EXISTS (SELECT 1 FROM inpcs i WHERE i.id = c.base_id))
  `).all() as { id: string; encounterId: string }[];

  // Removing those combatants strands whatever they were sustaining on others, so when repairing
  // they go first and everything below is read from what is left. One pass then settles it; the
  // sweep used to read the roster as it was and leave those conditions for the next run.
  if (options.repair) for (const orphan of orphans) removeCombatant(db, broadcast, orphan.encounterId, orphan.id, t);

  // Conditions are JSON, so this is read in code rather than SQL.
  const stranded: Array<{ id: string; encounterId: string; live: Record<string, unknown>; keep: unknown[] }> = [];
  const rows = db.prepare("SELECT id, encounter_id AS encounterId, live_json AS liveJson FROM combatants").all() as
    { id: string; encounterId: string; liveJson: string | null }[];
  const inEncounter = db.prepare("SELECT 1 FROM combatants WHERE id = ? AND encounter_id = ?");
  let strandedCount = 0;
  for (const row of rows) {
    let live: Record<string, unknown>;
    try { live = JSON.parse(row.liveJson ?? "{}") as Record<string, unknown>; } catch { continue; }
    const conditions = Array.isArray(live.conditions) ? live.conditions as Array<{ casterId?: unknown }> : [];
    const keep = conditions.filter((condition) => {
      const casterId = typeof condition?.casterId === "string" ? condition.casterId : null;
      return !casterId || Boolean(inEncounter.get(casterId, row.encounterId));
    });
    if (keep.length !== conditions.length) {
      strandedCount += conditions.length - keep.length;
      stranded.push({ id: row.id, encounterId: row.encounterId, live, keep });
    }
  }

  const danglingTurns = db.prepare(`
    SELECT e.id FROM encounters e
    WHERE e.combat_active_combatant_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM combatants c WHERE c.id = e.combat_active_combatant_id AND c.encounter_id = e.id)
  `).all() as { id: string }[];

  const report: CombatIntegrityReport = {
    orphanedCombatants: orphans.length,
    strandedCasterConditions: strandedCount,
    danglingTurnPointers: danglingTurns.length,
  };
  if (!options.repair) return report;

  const writeLive = db.prepare("UPDATE combatants SET live_json = ?, updated_at = ? WHERE id = ?");
  for (const entry of stranded) {
    writeLive.run(JSON.stringify({ ...entry.live, conditions: entry.keep }), t, entry.id);
    broadcast("encounter:combatantsDelta", { encounterId: entry.encounterId, action: "refresh" });
  }

  // Nobody to hand the turn to any more: clear it, and the DM app starts from the top of the order.
  const clearTurn = db.prepare("UPDATE encounters SET combat_active_combatant_id = NULL, updated_at = ? WHERE id = ?");
  for (const encounter of danglingTurns) {
    clearTurn.run(t, encounter.id);
    broadcast("encounter:combatStateChanged", { encounterId: encounter.id });
  }
  return report;
}
