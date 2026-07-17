import type { ParsedFeatChoiceLike, ParsedFeatDetailLike } from "@/views/character-creator/utils/FeatChoiceTypes";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { CharacterClassEntry } from "@/views/character/CharacterSheetTypes";

export interface AutoLevel {
  level: number;
  scoreImprovement: boolean;
  slots: number[] | null;
  features: { name: string; text: string; optional: boolean; subclass?: string | null; effects?: unknown[]; noteTemplate?: { id: string; title: string; text: string } | null; choices?: import("@/views/character-creator/utils/CharacterCreatorClassCoreUtils").CreatorFeatureLike["choices"]; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
  counters: { name: string; value: number; reset: string }[];
}

export interface LevelUpClassDetail {
  id: string;
  name: string;
  hd: number | null;
  spellLists?: Record<string, string>;
  autolevels: AutoLevel[];
}

export interface LevelUpSpellSummary {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
  check?: string | string[] | null;
  rolls?: Array<{ effect?: string | string[] | null }>;
  prerequisite?: import("@/views/character/CharacterSheetUtils").ClassTalentPrerequisite | null;
  repeatable?: boolean;
}

export interface LevelUpFeatSummary {
  id: string;
  name: string;
  category?: string | null;
}

export type InvocationFeatChoiceEntry = import("@/domain/character/invocationFeatChoices").InvocationFeatChoiceEntry;

export type LevelUpFeatDetail = ParsedFeatDetailLike<ParsedFeatChoiceLike> & { id: string };

export interface LevelUpCharacter {
  id: string;
  name: string;
  className: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  characterData: {
    classes?: CharacterClassEntry[];
    xp?: number;
    chosenLevelUpFeats?: Array<{ level: number; featId?: string | null; type?: "asi" | "feat"; abilityBonuses?: Record<string, number> }>;
    chosenCantrips?: string[];
    chosenSpells?: string[];
    chosenInvocations?: string[];
    chosenFeatOptions?: Record<string, string[]>;
    chosenFeatureChoices?: Record<string, string[]>;
    proficiencies?: {
      spells?: Array<{ name: string; source: string }>;
      invocations?: Array<{ name: string; source: string }>;
      skills?: Array<{ name: string; source: string }>;
      expertise?: Array<{ name: string; source: string }>;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  } | null;
}

export type AsiMode = "asi" | "feat" | null;
export type HpChoice = "roll" | "average" | "manual" | null;

export interface LevelUpSpellListChoiceEntry {
  key: string;
  title: string;
  count: number;
  options: string[];
  sourceLabel?: string | null;
  note?: string | null;
}

export interface LevelUpResolvedSpellChoiceEntry {
  key: string;
  title: string;
  sourceLabel?: string | null;
  count: number;
  level: number | null;
  maxLevel?: number | null;
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
