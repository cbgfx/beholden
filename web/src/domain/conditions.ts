export type ConditionDef = { key: string; name: string; needsCaster?: boolean };

// Stored on combatants as `conditions?: ConditionInstance[]`.
export type ConditionInstance = {
  key: string;
  casterId?: string | null;
  /** Combat round at which this condition expires (inclusive). null = no timer. */
  expiresAtRound?: number | null;
};

export const CONDITION_DEFS: ConditionDef[] = [
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
  { key: "stunned", name: "Stunned" },
  { key: "unconscious", name: "Unconscious" },
  { key: "concentration", name: "Concentration" },
  { key: "hexed", name: "Hexed", needsCaster: true },
  { key: "marked", name: "Marked", needsCaster: true },
];

export function conditionLabel(key: string): string {
  return CONDITION_DEFS.find((d) => d.key === key)?.name ?? key;
}

/** Build a quick lookup map for a roster of combatants. */
export function buildRosterById<T extends { id: string }>(roster: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const c of roster) out[c.id] = c;
  return out;
}

/**
 * UI display name for a combatant.
 * Combatants are expected to carry a `label` (preferred); some legacy rows may have `name`.
 */
export function displayName(c: { label?: unknown; name?: unknown; type?: unknown } | null | undefined): string {
  const label = String(c?.label ?? "").trim();
  if (label) return label;
  const name = String(c?.name ?? "").trim();
  if (name) return name;
  const type = String(c?.type ?? "").trim();
  return type ? type.toUpperCase() : "COMBATANT";
}
