import type { StoredConditionInstance, StoredEncounterActor } from "../server/userData.js";
import { hasIncapacitatingCondition } from "@beholden/shared/domain/conditions";

export function conditionsBreakConcentration(conditions: StoredConditionInstance[]): boolean {
  return hasIncapacitatingCondition(conditions);
}

export function shouldBreakConcentration(args: {
  hpCurrent: number | null | undefined;
  conditions: StoredConditionInstance[];
}): boolean {
  return Number(args.hpCurrent) <= 0 || conditionsBreakConcentration(args.conditions);
}

export function applyConditionConsequences(args: {
  previousHpCurrent?: number | null;
  hpCurrent: number | null | undefined;
  conditions: StoredConditionInstance[];
}): StoredConditionInstance[] {
  let conditions = args.conditions;
  const healedFromZero = Number(args.previousHpCurrent) <= 0 && Number(args.hpCurrent) > 0;
  if (healedFromZero && conditions.some((condition) => condition.key === "unconscious")) {
    conditions = conditions.filter((condition) => condition.key !== "unconscious");
  }
  if (
    conditions.some((condition) => condition.key === "unconscious")
    && !conditions.some((condition) => condition.key === "prone")
  ) {
    conditions = [...conditions, { key: "prone" }];
  }
  return conditions;
}

export function expireConditionsAtRound(
  conditions: StoredConditionInstance[],
  round: number,
): StoredConditionInstance[] {
  const currentRound = Math.max(1, Math.floor(Number(round) || 1));
  return conditions.filter((condition) => {
    if (condition.expiresAtRound == null) return true;
    const expiresAt = Number(condition.expiresAtRound);
    return !Number.isFinite(expiresAt) || expiresAt > currentRound;
  });
}

// ── Concentration ownership ───────────────────────────────────────────────
//
// A dependent condition (e.g. Hexed, Marked) can carry a `casterId` pointing at the combatant
// sustaining it. `concentrationId` is a second, optional layer on top of that: a stable id stamped
// onto a caster's own "concentration" condition for as long as it's active, so a dependent
// condition can (when it also carries the same id) be tied to that *specific* casting rather than
// just "this caster, whichever spell they're on now" — see removeConditionsOwnedBy for why that
// distinction matters.

export type EndedConcentration = { casterId: string; concentrationId: string | null };

function conditionConcentrationId(condition: StoredConditionInstance | undefined): string | null {
  const raw = condition?.concentrationId;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

/**
 * Stamps a stable `concentrationId` onto a combatant's own "concentration" condition the first
 * time it appears, so dependent conditions elsewhere can later be tied to this specific session.
 * Idempotent — a condition that already has one is left untouched, and legacy conditions with no
 * "concentration" entry at all are returned as-is.
 */
export function ensureConcentrationId(conditions: StoredConditionInstance[]): StoredConditionInstance[] {
  const idx = conditions.findIndex((condition) => condition.key === "concentration");
  if (idx === -1) return conditions;
  const existing = conditions[idx]!;
  if (conditionConcentrationId(existing)) return conditions;
  const next = conditions.slice();
  next[idx] = { ...existing, concentrationId: crypto.randomUUID() };
  return next;
}

/**
 * Detects whether `casterId`'s own "concentration" condition was present before and is gone after
 * — regardless of cause (HP loss, an incapacitating condition, a timed expiry, or simply being
 * removed by hand). Returns the ended session's id (if it had one) so dependents can be matched
 * precisely; returns null id for legacy/untagged concentration conditions, falling back to
 * caster-only matching in removeConditionsOwnedBy.
 */
export function detectEndedConcentration(
  casterId: string,
  previousConditions: StoredConditionInstance[],
  nextConditions: StoredConditionInstance[],
): EndedConcentration | null {
  const before = previousConditions.find((condition) => condition.key === "concentration");
  if (!before) return null;
  if (nextConditions.some((condition) => condition.key === "concentration")) return null;
  return { casterId, concentrationId: conditionConcentrationId(before) };
}

/**
 * Removes conditions owned by an ended concentration source from one combatant's condition list.
 * Conservative by construction:
 *  - A condition with no `casterId` at all is never touched — there's no ownership info to match.
 *  - A condition whose `casterId` doesn't match the ended caster is never touched (a different
 *    caster's Hexed/Marked/etc. survives untouched).
 *  - If BOTH the ended session and the condition carry a `concentrationId`, they must match — this
 *    lets a caster's later, unrelated concentration session coexist safely with a stale dependent
 *    that was (for whatever reason) never cleaned up from an earlier one.
 *  - Otherwise (same caster, but one or both sides lack a `concentrationId`), the condition is
 *    removed — the smallest backward-compatible default: a bare `casterId` match is already the
 *    ownership signal this feature is built on, so treating it as unambiguous here (rather than
 *    "unknown, preserve") is what makes the caster-only case from requirement 3 actually work.
 */
export function removeConditionsOwnedBy(
  conditions: StoredConditionInstance[],
  ended: EndedConcentration,
): StoredConditionInstance[] {
  return conditions.filter((condition) => {
    if (!condition.casterId || condition.casterId !== ended.casterId) return true;
    const conditionConcId = conditionConcentrationId(condition);
    if (ended.concentrationId && conditionConcId) return conditionConcId !== ended.concentrationId;
    return false;
  });
}

/**
 * Applies authoritative cross-field combat rules after a requested patch has
 * been merged into an encounter actor. Persistence, broadcasts, and response
 * DTOs must all use the returned actor.
 */
export function applyCombatantTransition(
  next: StoredEncounterActor,
  previous?: StoredEncounterActor,
): StoredEncounterActor {
  let conditions = applyConditionConsequences({
    ...(previous ? { previousHpCurrent: previous.hpCurrent } : {}),
    hpCurrent: next.hpCurrent,
    conditions: next.conditions,
  });
  if (shouldBreakConcentration({ hpCurrent: next.hpCurrent, conditions })) {
    conditions = conditions.filter((condition) => condition.key !== "concentration");
  }
  // Only stamp a concentrationId when concentration is genuinely new in this transition (the
  // known previous state didn't have it) — never retroactively rewrite an already-established or
  // legacy/pre-feature concentration condition just because a later, unrelated field changed. This
  // keeps applyCombatantTransition's no-op contract intact: a patch that changes nothing else must
  // still return the same reference. `previous === undefined` is treated as "unknown," not "new."
  const isNewConcentration = previous !== undefined
    && !previous.conditions.some((condition) => condition.key === "concentration");
  if (isNewConcentration) conditions = ensureConcentrationId(conditions);
  const incapacitated = conditionsBreakConcentration(conditions);
  const usedReaction = incapacitated ? true : next.usedReaction;
  if (conditions === next.conditions && usedReaction === next.usedReaction) return next;
  return {
    ...next,
    conditions,
    ...(usedReaction !== undefined ? { usedReaction } : {}),
  };
}
