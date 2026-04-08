import type { ParsedFeatChoiceLike, ParsedFeatDetailLike } from "@/views/character-creator/utils/FeatChoiceTypes";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { CharacterClassEntry } from "@/views/character/CharacterSheetTypes";

export interface AutoLevel {
  level: number;
  scoreImprovement: boolean;
  slots: number[] | null;
  features: { name: string; text: string; optional: boolean; preparedSpellProgression?: PreparedSpellProgressionTable[] }[];
  counters: { name: string; value: number; reset: string }[];
}

export interface LevelUpClassDetail {
  id: string;
  name: string;
  hd: number | null;
  autolevels: AutoLevel[];
}

export interface LevelUpSpellSummary {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
}

export interface LevelUpFeatSummary {
  id: string;
  name: string;
}

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
    chosenLevelUpFeats?: Array<{ level: number; featId: string }>;
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
  note?: string | null;
  linkedTo?: string | null;
  listNames: string[];
  schools?: string[];
  ritualOnly?: boolean;
}
