export type RequirementState = "loading" | "failed" | "incomplete" | "complete" | "not_applicable";

export type ProgressionRequirement = {
  id: string;
  state: RequirementState;
  message: string;
  step?: number;
};

export function requirementBlocks(requirement: ProgressionRequirement): boolean {
  return !["complete", "not_applicable"].includes(requirement.state);
}

/** Keep previously visible choices reachable until refreshed definitions resolve. */
export function retainPendingRequirements(previous: ProgressionRequirement[], current: ProgressionRequirement[]): ProgressionRequirement[] {
  if (!current.some((entry) => entry.state === "loading" || entry.state === "failed")) return current;
  const ids = new Set(current.map((entry) => entry.id));
  return [...current, ...previous.filter((entry) => !ids.has(entry.id) && !entry.id.startsWith("load:") && entry.state !== "not_applicable")
    .map((entry) => ({ ...entry, state: "loading" as const }))];
}

/** Unknown options are not an empty legal pool and cannot complete a requirement. */
export function evaluateChoiceRequirement(args: {
  id: string;
  message: string;
  selected: readonly string[];
  count: number;
  options?: readonly string[];
  loading?: boolean;
  failed?: boolean;
  applicable?: boolean;
  repeatable?: boolean;
  atMost?: boolean;
  step?: number;
}): ProgressionRequirement {
  let state: RequirementState;
  if (args.applicable === false) state = "not_applicable";
  else if (args.failed) state = "failed";
  else if (args.loading) state = "loading";
  else {
    const unique = args.repeatable || new Set(args.selected).size === args.selected.length;
    const members = args.selected.every((id) => id.trim() && (!args.options || args.options.includes(id)));
    const count = args.atMost ? args.selected.length <= args.count : args.selected.length === args.count;
    state = unique && members && count ? "complete" : "incomplete";
  }
  return { id: args.id, message: args.message, ...(args.step !== undefined ? { step: args.step } : {}), state };
}

export function validAsiAllocation(bonuses: Record<string, number>, scores?: Record<string, number>): boolean {
  return Object.values(bonuses).reduce((sum, value) => sum + value, 0) === 2
    && Object.entries(bonuses).every(([key, value]) =>
      ["str", "dex", "con", "int", "wis", "cha"].includes(key)
      && Number.isInteger(value) && value >= 0 && value <= 2
      && (!scores || value === 0 || (scores[key] ?? 10) + value <= 20));
}

export function scoresBeforeEachAsi(initial: Record<string, number>, levels: number[], selections: Array<{ level: number; type?: string; abilityBonuses?: Record<string, number> }>): Record<number, Record<string, number>> {
  const result: Record<number, Record<string, number>> = {};
  const scores = { ...initial };
  for (const level of [...levels].sort((a, b) => a - b)) {
    result[level] = { ...scores };
    const entry = selections.find((candidate) => candidate.level === level);
    if (entry?.type === "asi") for (const [key, value] of Object.entries(entry.abilityBonuses ?? {})) {
      scores[key] = Math.min(20, (scores[key] ?? 10) + value);
    }
  }
  return result;
}

/** Inputs are canonical spell keys from the preparation list, never known/spellbook entries. */
export function countOrdinaryPreparations(preparedKeys: readonly string[], alwaysPreparedKeys: ReadonlySet<string>): number {
  return new Set(preparedKeys.filter((key) => !alwaysPreparedKeys.has(key))).size;
}

export function evaluateSpellSelectionRequirement(args: {
  selected: readonly string[];
  capacity: number;
  managedOnSheet: boolean;
  applicable: boolean;
  loading?: boolean;
}): ProgressionRequirement {
  return evaluateChoiceRequirement({
    id: "class-spells", message: "Too many class spells selected.",
    selected: args.selected, count: args.capacity, atMost: true,
    applicable: args.applicable && !args.managedOnSheet,
    loading: Boolean(args.loading),
  });
}
