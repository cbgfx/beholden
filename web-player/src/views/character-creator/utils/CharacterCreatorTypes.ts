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
  primaryAbility?: string | { any?: string[]; all?: string[] } | null;
  spellLists?: Record<string, string>;
  numSkills: number;
  proficiency: string;
  slotsReset: string;
  preparedSpellChanges?: "short_rest" | "long_rest" | null;
  preparedSpellFormula?: { classLevelDivisor?: 1 | 2; rounding?: "down" | "up"; minimum?: number } | null;
  spellAbility?: string | null;
  spellcastingList?: string | null;
  wealth?: number | null;
  armor: string; weapons: string; tools: string;
  /** Structured proficiencies present for Grand classes. When present,
   *  tools.fixed/choices/notes supersede the flat `tools` string. */
  proficiencies?: {
    savingThrows: string[];
    skills: { choose: number; from: string[] };
    armor: string[];
    weapons: string[];
    tools: ClassToolProficiency;
  };
  description: string;
  choices?: Array<{
    id: string;
    name: string;
    options: Array<{ id: string; name: string; features: string[] }>;
  }>;
  equipmentOptions?: import("./CharacterCreatorClassCoreUtils").StructuredStartingEquipmentOption[];
  descriptions?: string[];
  autolevels: {
    level: number; scoreImprovement: boolean; spellsPrepared?: number | null;
    slots: number[] | null;
    features: { id?: string; name: string; text: string; optional: boolean; subclass?: string | null; effects?: unknown[]; noteTemplate?: { id: string; title: string; text: string } | null; choices?: Array<
      | { kind: "feat"; category: "F"; count?: number; replace?: true }
      | { kind: "weapon_mastery"; known: Record<string, number>; melee?: true }
      | { kind: "expertise"; known: Record<string, number>; from?: string[] }
      | { kind: "proficiency"; category: "skill" | "tool" | "language" | "saving_throw"; count: number; from?: string | string[]; ifProficient?: string }
      | { id: string; kind: "spell"; lists: string[]; count?: number; level?: number; maxLevel?: number; school?: string; mode: "known" | "prepared" | "spellbook"; replace?: true; perNewSlotLevel?: true; freeCast?: true; ifKnown?: string }
    >; scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
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
  check?: string | null;
  rolls?: Array<{ effect?: string | string[] | null }>;
  prerequisite?: import("@/views/character/CharacterSheetUtils").ClassTalentPrerequisite | null;
  repeatable?: boolean;
  effects?: unknown[];
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
  mastery?: string | null;
}

export interface RaceSummary { id: string; name: string; size: string | null; speed: number | null; }

export interface RaceDetail {
  id: string; name: string; size: string | null; speed: number | null;
  creatureType?: string | null;
  spellAbility?: string | null;
  /** Fixed 2014-race Ability Score Increase amounts, keyed by ability. Absent for 2024 species. */
  abilityScoreIncrease?: Record<string, number> | null;
  parsedChoices?: RaceChoices;
  traits: { name: string; text: string; category: string | null; modifier: string[]; scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>; preparedSpellProgression?: PreparedSpellProgressionTable[]; effects?: unknown[] }[];
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

interface StructuredBgProficiencies {
  skills: ProficiencyChoice;
  tools: ProficiencyChoice;
  languages: ProficiencyChoice;
  feats: Array<ParsedFeatDetailLike<ParsedFeatChoiceLike>>;
  featChoice: number;
  featChoiceFrom?: string[];
  abilityScores: string[];
  abilityScoreChoose: number;
}

export interface BgDetail {
  id: string; name: string; proficiency: string;
  proficiencies?: StructuredBgProficiencies;
  traits: { name: string; text: string; scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>; preparedSpellProgression?: PreparedSpellProgressionTable[]; effects?: unknown[] }[];
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
  schools?: string[];
  ritualOnly?: boolean;
  damageOnly?: boolean;
  attackOnly?: boolean;
  allowedSpellIds?: string[];
  grantsSpell?: boolean;
}

export interface ClassFeatChoice {
  featureName: string;
  featGroup: string;
  options: Array<{ id: string; name: string }>;
}
