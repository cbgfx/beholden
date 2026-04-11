import type { Ruleset, RaceChoices } from "@/lib/characterRules";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { ParsedFeatChoiceLike, ParsedFeatDetailLike } from "./FeatChoiceTypes";

export interface ClassSummary { id: string; name: string; hd: number | null; ruleset?: Ruleset | null }

export interface ClassDetail {
  id: string; name: string; hd: number | null; ruleset?: Ruleset | null;
  numSkills: number;
  proficiency: string;
  slotsReset: string;
  armor: string; weapons: string; tools: string;
  description: string;
  autolevels: {
    level: number; scoreImprovement: boolean;
    slots: number[] | null;
    features: { name: string; text: string; optional: boolean; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
    counters: { name: string; value: number; reset: string }[];
  }[];
}

export interface SpellSummary {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  classes: string | null;
  text: string | null;
}

export interface ItemSummary {
  id: string;
  name: string;
  type: string | null;
  typeKey?: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
}

export interface RaceSummary { id: string; name: string; size: string | null; speed: number | null; ruleset?: Ruleset | null }

export interface RaceDetail {
  id: string; name: string; size: string | null; speed: number | null; ruleset?: Ruleset | null;
  resist: string | null;
  vision: { type: string; range: number }[];
  parsedChoices?: RaceChoices;
  traits: { name: string; text: string; category: string | null; modifier: string[]; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
}

export interface BgSummary { id: string; name: string; ruleset?: Ruleset | null }

export interface ProficiencyChoice {
  fixed: string[];
  choose: number;
  from: string[] | null;
}

export interface LevelUpFeatSelection {
  level: number;
  featId?: string | null;
  type?: "asi" | "feat";
  abilityBonuses?: Record<string, number>;
}

export interface LevelUpFeatDetail {
  level: number;
  featId: string;
  feat: ParsedFeatDetailLike<ParsedFeatChoiceLike>;
}

export interface StructuredBgProficiencies {
  skills: ProficiencyChoice;
  tools: ProficiencyChoice;
  languages: ProficiencyChoice;
  feats: Array<ParsedFeatDetailLike<ParsedFeatChoiceLike>>;
  featChoice: number;
  abilityScores: string[];
  abilityScoreChoose: number;
}

export interface BgDetail {
  id: string; name: string; proficiency: string; ruleset?: Ruleset | null;
  proficiencies?: StructuredBgProficiencies;
  traits: { name: string; text: string; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
  equipment?: string;
}

export interface Campaign {
  id: string;
  name: string;
  updatedAt: number;
  playerCount: number;
  imageUrl: string | null;
}

export interface ClassFeatureEntry {
  id: string;
  name: string;
  text: string;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

export interface CreatorSpellListChoiceEntry {
  key: string;
  title: string;
  sourceLabel?: string | null;
  options: string[];
  count: number;
  note?: string | null;
}

export interface CreatorResolvedSpellChoiceEntry {
  key: string;
  title: string;
  sourceLabel?: string | null;
  count: number;
  level: number | null;
  note?: string | null;
  linkedTo?: string | null;
  listNames: string[];
}

export interface ClassFeatChoice {
  featureName: string;
  featGroup: string;
  options: Array<{ id: string; name: string }>;
}
