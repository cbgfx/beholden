export type { ParsedFeatChoiceLike } from "@/views/character-creator/utils/FeatChoiceTypes";

export type Ruleset = "5.5e";

export interface RuleTaggedRecord {
  ruleset?: Ruleset | null;
  name?: string | null;
}

export interface RaceChoices {
  hasChosenSize: boolean;
  skillChoice: { count: number; from: string[] | null } | null;
  toolChoice: { count: number; from: string[] | null } | null;
  languageChoice: { count: number; from: string[] | null } | null;
  hasFeatChoice: boolean;
}

export function wordOrNumberToInt(value: string): number | null {
  const lowered = value.trim().toLowerCase();
  const numeric = Number.parseInt(lowered, 10);
  if (Number.isFinite(numeric)) return numeric;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return words[lowered] ?? null;
}

export function matchesRuleset(value: RuleTaggedRecord, ruleset: Ruleset | null): boolean {
  if (!ruleset) return true;
  if (value.ruleset) return value.ruleset === "5.5e";
  return true;
}
