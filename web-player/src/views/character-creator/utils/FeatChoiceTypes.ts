export type FeatChoiceType =
  | "proficiency"
  | "expertise"
  | "ability_score"
  | "spell"
  | "spell_list"
  | "weapon_mastery"
  | "damage_type";

export interface ParsedFeatChoiceLike<TOption = string> {
  id: string;
  type: FeatChoiceType;
  count: number;
  countFrom?: "proficiency_bonus";
  options: TOption[] | null;
  anyOf?: string[];
  amount?: number | null;
  level?: number | null;
  linkedTo?: string | null;
  dependsOnChoiceId?: string | null;
  dependencyKind?: "spell_list" | "ability_score" | "replacement" | null;
  replacementFor?: string | null;
  distinct?: boolean;
  note?: string | null;
}

export interface ParsedFeatGrantsLike {
  skills: string[];
  tools: string[];
  languages: string[];
  armor: string[];
  weapons: string[];
  savingThrows: string[];
  spells: string[];
  cantrips: string[];
  abilityIncreases: Record<string, number>;
  bonuses?: Array<{ target: string; value: number }>;
}

export interface ParsedFeatLike<TChoice extends ParsedFeatChoiceLike<any> = ParsedFeatChoiceLike> {
  category?: string | null;
  baseName?: string;
  variant?: string | null;
  prerequisite?: string | null;
  repeatable?: boolean;
  source?: string | null;
  grants: ParsedFeatGrantsLike;
  choices: TChoice[];
  spellcastingAbilityFromChoiceId?: string | null;
}

export interface ParsedFeatDetailLike<TChoice extends ParsedFeatChoiceLike<any> = ParsedFeatChoiceLike> {
  id?: string;
  name: string;
  text?: string | null;
  parsed: ParsedFeatLike<TChoice>;
}
