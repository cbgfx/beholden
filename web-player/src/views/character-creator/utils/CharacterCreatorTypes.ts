import type { RaceChoices } from "@/lib/characterRules";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { ParsedFeatChoiceLike, ParsedFeatDetailLike } from "./FeatChoiceTypes";
import type { StructuredStartingEquipmentOption } from "./CharacterCreatorClassCoreUtils";

export interface ClassSummary { id: string; name: string; hd: number | null; }

export interface ClassToolProficiency {
  fixed: string[];
  choices: Array<{ count: number; from: string[] }>;
  notes: string[];
}

export interface ClassDetail {
  id: string; name: string; hd: number | null;
  numSkills: number;
  proficiency: string;
  slotsReset: string;
  spellAbility?: string | null;
  wealth?: number | null;
  armor: string; weapons: string; tools: string;
  /** Structured proficiencies present for canonical v2 classes. When present,
   *  tools.fixed/choices/notes supersede the flat `tools` string. */
  proficiencies?: {
    savingThrows: string[];
    skills: { choose: number; from: string[] };
    armor: string[];
    weapons: string[];
    tools: ClassToolProficiency;
  };
  description: string;
  descriptions?: string[];
  autolevels: {
    level: number; scoreImprovement: boolean;
    slots: number[] | null;
    features: { name: string; text: string; optional: boolean; effects?: unknown[]; scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
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

export interface RaceSummary { id: string; name: string; size: string | null; speed: number | null; }

export interface RaceDetail {
  id: string; name: string; size: string | null; speed: number | null;
  spellAbility?: string | null;
  resist: string | null;
  vision: { type: string; range: number }[];
  parsedChoices?: RaceChoices;
  traits: { name: string; text: string; category: string | null; modifier: string[]; scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
}

export interface BgSummary { id: string; name: string; }

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
  id: string; name: string; proficiency: string;
  proficiencies?: StructuredBgProficiencies;
  traits: { name: string; text: string; scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
  equipment?: string;
  equipmentOptions?: StructuredStartingEquipmentOption[];
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
  linkedTo?: string | null;
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
