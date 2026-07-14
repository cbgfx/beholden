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

export function displayActorName(actor: { label?: unknown; name?: unknown; type?: unknown } | null | undefined): string {
  const label = String(actor?.label ?? "").trim();
  if (label) return label;
  const type = String(actor?.type ?? "").trim();
  return type ? type.toUpperCase() : "COMBATANT";
}
