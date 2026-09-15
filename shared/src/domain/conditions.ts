export type SharedConditionDef = { key: string; name: string; needsCaster?: boolean };

export const SHARED_CONDITION_DEFS: SharedConditionDef[] = [
  { key: "blinded", name: "Blinded" },
  { key: "charmed", name: "Charmed" },
  { key: "deafened", name: "Deafened" },
  { key: "frightened", name: "Frightened" },
  { key: "grappled", name: "Grappled" },
  { key: "incapacitated", name: "Incapacitated" },
  { key: "invisible", name: "Invisible" },
  { key: "paralyzed", name: "Paralyzed" },
  { key: "petrified", name: "Petrified" },
  { key: "poisoned", name: "Poisoned" },
  { key: "prone", name: "Prone" },
  { key: "restrained", name: "Restrained" },
  { key: "slow", name: "Slow" },
  { key: "stunned", name: "Stunned" },
  { key: "unconscious", name: "Unconscious" },
  { key: "concentration", name: "Concentration" },
  { key: "disadvantage", name: "Disadvantage" },
  { key: "hexed", name: "Hexed", needsCaster: true },
  { key: "marked", name: "Marked", needsCaster: true },
  { key: "mage_armor", name: "Mage Armor" },
];

export function conditionLabel(key: string): string {
  if (key === "rage") return "Rage";
  return SHARED_CONDITION_DEFS.find((def) => def.key === key)?.name ?? key;
}

/** DC for a Concentration saving throw after taking `damage`. PHB rule: max(10, floor(damage / 2)). */
export function concentrationSaveDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

export const INCAPACITATING_CONDITION_KEYS = new Set([
  "incapacitated",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
]);

export function hasIncapacitatingCondition(
  conditions: Array<{ key?: unknown }> | null | undefined,
): boolean {
  return Boolean(conditions?.some((condition) =>
    INCAPACITATING_CONDITION_KEYS.has(String(condition.key ?? "").trim().toLowerCase())
  ));
}

// Shared by every player and server surface so the rule cannot drift between them. Incapacitated
// is intentionally absent: it ends Concentration and prevents actions, but does not set Speed 0.
// Rage's speed interaction is deliberately not folded in here; it is resolved from its feature.
export const ZERO_SPEED_CONDITION_KEYS = new Set([
  "grappled",
  "restrained",
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
]);

export function hasZeroSpeedCondition(
  conditions: Array<{ key?: unknown }> | null | undefined,
): boolean {
  return Boolean(conditions?.some((condition) =>
    ZERO_SPEED_CONDITION_KEYS.has(String(condition.key ?? "").trim().toLowerCase())
  ));
}

/** Speed reduction (in feet) applied by the Slow condition. */
export const SLOW_SPEED_PENALTY = 10;

export type RestType = "short" | "long";

/**
 * Conditions a Short Rest outlasts: the ones that run for a minute or less, end the moment someone
 * lets go, or depend on concentration nobody keeps up through an hour of rest.
 *
 * Strictly by the book a rest ends no condition at all -- only Exhaustion is named. These lists are
 * a table convenience built on duration: an hour outlasts anything measured in rounds, and eight
 * hours outlasts nearly every poison, charm and blindness effect in print.
 */
export const SHORT_REST_CLEARED_CONDITION_KEYS = new Set([
  "frightened",
  "grappled",
  "incapacitated",
  "paralyzed",
  "prone",
  "restrained",
  "slow",
  "stunned",
  "unconscious",
  "rage",
  "concentration",
  "hexed",
  "marked",
]);

/**
 * A Long Rest additionally outlasts the hour-to-eight-hour effects.
 *
 * Two keys are deliberately absent. "petrified" has no duration to expire -- only Greater
 * Restoration ends it, so no amount of sleep should. "polymorphed" is not a duration either: the
 * condition carries the AC, HP maximum and hit points the form replaced, so callers must unwind it
 * through resolvePolymorphRevert in ./actors rather than dropping it here, or the actor keeps the
 * form's numbers.
 */
export const LONG_REST_CLEARED_CONDITION_KEYS = new Set([
  ...SHORT_REST_CLEARED_CONDITION_KEYS,
  "blinded",
  "charmed",
  "deafened",
  "invisible",
  "poisoned",
  "disadvantage",
  "mage_armor",
]);

export function clearsOnRest(key: string, rest: RestType): boolean {
  const normalized = String(key ?? "").trim().toLowerCase();
  const cleared = rest === "long" ? LONG_REST_CLEARED_CONDITION_KEYS : SHORT_REST_CLEARED_CONDITION_KEYS;
  return cleared.has(normalized);
}

/**
 * The conditions that survive a rest. Anything the rest doesn't outlast is kept, including
 * "polymorphed" -- callers holding a polymorphed actor must revert it separately.
 */
export function conditionsAfterRest<T extends { key?: unknown }>(
  conditions: readonly T[] | null | undefined,
  rest: RestType,
): T[] {
  return (conditions ?? []).filter((condition) => !clearsOnRest(String(condition.key ?? ""), rest));
}

export function displayActorName(actor: { label?: unknown; name?: unknown; type?: unknown } | null | undefined): string {
  const label = String(actor?.label ?? "").trim();
  if (label) return label;
  const type = String(actor?.type ?? "").trim();
  return type ? type.toUpperCase() : "COMBATANT";
}
