export type { ParsedFeatChoiceLike } from "@/views/character-creator/utils/FeatChoiceTypes";

export interface RaceChoices {
  hasChosenSize: boolean;
  skillChoice: { count: number; from: string[] | null } | null;
  toolChoice: { count: number; from: string[] | null } | null;
  languageChoice: { count: number; from: string[] | null } | null;
  hasFeatChoice: boolean;
  /** Present only when a species trait's spell(s) use a player-chosen governing ability (elf lineages, tiefling legacies). */
  spellcastingAbilityChoice: { options: string[] } | null;
  /** The player-choice portion of a 2014 race's Ability Score Increase. */
  abilityScoreChoice: { count: number; amount: number; from: string[] | null; flexible?: boolean } | null;
}
