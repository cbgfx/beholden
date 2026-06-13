import type { PreparedSpellProgressionTable } from "./preparedSpellProgression.js";

export interface ParsedFeatModifier {
  category: string;
  text: string;
  target: string | null;
  value: number | null;
}

export interface ParsedFeatChoice {
  id: string;
  type: "proficiency" | "expertise" | "ability_score" | "spell" | "spell_list" | "weapon_mastery" | "damage_type";
  count: number;
  countFrom?: "proficiency_bonus";
  options: string[] | null;
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

export interface ParsedFeatGrants {
  skills: string[];
  tools: string[];
  languages: string[];
  armor: string[];
  weapons: string[];
  savingThrows: string[];
  spells: string[];
  cantrips: string[];
  abilityIncreases: Record<string, number>;
  bonuses: Array<{ target: string; value: number }>;
}

export interface ParsedFeatUse {
  count: number;
  countFrom?: "proficiency_bonus" | "ability_modifier";
  ability?: string | null;
  minimum?: number | null;
  recharge: "short_rest" | "long_rest" | "short_or_long_rest" | null;
  note: string;
}

export interface ParsedFeat {
  category: string | null;
  baseName: string;
  variant: string | null;
  prerequisite: string | null;
  repeatable: boolean;
  source: string | null;
  grants: ParsedFeatGrants;
  choices: ParsedFeatChoice[];
  uses: ParsedFeatUse[];
  preparedSpellProgression: PreparedSpellProgressionTable[];
  notes: string[];
  modifierDetails: ParsedFeatModifier[];
  spellcastingAbilityFromChoiceId?: string | null;
}
