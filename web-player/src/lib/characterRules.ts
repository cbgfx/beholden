export type { ParsedFeatChoiceLike } from "@/views/character-creator/utils/FeatChoiceTypes";

export interface RaceChoices {
  hasChosenSize: boolean;
  skillChoice: { count: number; from: string[] | null } | null;
  toolChoice: { count: number; from: string[] | null } | null;
  languageChoice: { count: number; from: string[] | null } | null;
  hasFeatChoice: boolean;
  /** Present only when a species trait's spell(s) use a player-chosen governing ability (elf lineages, tiefling legacies). */
  spellcastingAbilityChoice: { options: string[] } | null;
}

export function wordOrNumberToInt(value: string): number | null {
  const lowered = value.trim().toLowerCase();
  const numeric = Number.parseInt(lowered, 10);
  if (Number.isFinite(numeric)) return numeric;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return words[lowered] ?? null;
}
