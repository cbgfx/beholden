import {
  SHARED_CONDITION_DEFS,
  conditionLabel as sharedConditionLabel,
  displayActorName,
  type SharedConditionDef,
  type SharedConditionInstance,
} from "@beholden/shared/domain";

export type ConditionDef = SharedConditionDef;

// Stored on combatants as `conditions?: ConditionInstance[]`.
export type ConditionInstance = SharedConditionInstance & {
  /** Combat round at which this condition expires (inclusive). null = no timer. */
  expiresAtRound?: number | null;
};

export const CONDITION_DEFS: ConditionDef[] = SHARED_CONDITION_DEFS;

export function conditionLabel(key: string): string {
  return sharedConditionLabel(key);
}

/** Build a quick lookup map for a roster of combatants. */
export function buildRosterById<T extends { id: string }>(roster: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const c of roster) out[c.id] = c;
  return out;
}

/** UI display name for a combatant. */
export function displayName(c: { label?: unknown; name?: unknown; type?: unknown } | null | undefined): string {
  return displayActorName(c);
}
