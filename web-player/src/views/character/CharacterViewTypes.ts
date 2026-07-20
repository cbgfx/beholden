import type { AbilKey, CharacterCampaign, CharacterData, ConditionInstance } from "@/views/character/CharacterSheetTypes";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { CreatorFeatureLike } from "@/views/character-creator/utils/CharacterCreatorClassCoreUtils";
import type { StructuredFeatMechanicsLike } from "@/domain/character/structuredFeatureEffects";
import type { SharedPolymorphCondition } from "@beholden/shared/domain";

/** Total XP required to reach each level (index = level). Index 0 unused. */
export const XP_TO_LEVEL = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 260000, 300000, 355000];

export const SHEET_COLOR_PRESETS = [
  "#38bdf8",
  "#22c55e",
  "#f59e0b",
  "#ff5d5d",
  "#8b5cf6",
  "#fb7185",
  "#f97316",
  "#d946ef",
  "#14b8a6",
  "#06b6d4",
  "#84cc16",
  "#eab308",
  "#6366f1",
  "#94a3b8",
  "#ff6b3d",
  "#d08ce9",
  "#b9c4cf",
  "#8a9b32",
  "#a96c4f",
  "#5bc0eb",
  "#d4b24c",
  "#68b38c",
  "#6f6f6a",
  "#cf4444",
  "#8f46d9",
  "#0b5fff",
];

export interface Character {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  syncedAc?: number;
  speed: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  characterData: CharacterData | null;
  campaigns: CharacterCampaign[];
  conditions?: ConditionInstance[];
  overrides?: {
    tempHp: number;
    acBonus: number;
    hpMaxBonus: number;
    inspiration?: boolean;
    abilityScores?: Partial<Record<AbilKey, number>>;
  };
  deathSaves?: { success: number; fail: number };
  sharedNotes?: string;
  campaignSharedNotes?: string;
}

export interface ClassCounterDef {
  name: string;
  value: number;
  reset: string;
  subclass?: string | null;
}

export interface ClassRestDetail {
  id: string;
  name: string;
  hd: number | null;
  armor?: string | null;
  weapons?: string | null;
  proficiencies?: {
    savingThrows?: string[];
    armor?: string[];
    weapons?: string[];
  } | null;
  spellAbility?: string | null;
  slotsReset?: string | null;
  autolevels: Array<{
    level: number;
    slots: number[] | null;
    counters: ClassCounterDef[];
    features?: Array<{
      id?: string;
      name: string;
      text: string;
      optional?: boolean;
      effects?: unknown[];
      choices?: CreatorFeatureLike["choices"];
      resolution?: "automatic" | "manual" | "mixed";
      resolutionNotes?: string[];
      scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>;
      preparedSpellProgression?: PreparedSpellProgressionTable[];
    }>;
  }>;
}

export interface LoreTraitDetail {
  name: string;
  text: string;
  scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
  /** Verbatim FeatureEffect-shaped facts from the compendium's own `effects` field — consumed directly, no parsing. */
  effects?: unknown[];
  resolution?: "automatic" | "manual" | "mixed";
  resolutionNotes?: string[];
}

export interface RaceFeatureDetail {
  id: string;
  name: string;
  size?: string | null;
  speed?: number | null;
  creatureType?: string | null;
  spellAbility?: string | null;
  traits: LoreTraitDetail[];
}

export interface BackgroundFeatureDetail {
  id: string;
  name: string;
  traits: LoreTraitDetail[];
}

export interface FeatFeatureDetail {
  id: string;
  name: string;
  text?: string | null;
  parsed?: StructuredFeatMechanicsLike;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

export interface LevelUpFeatDetail {
  level: number;
  featId: string;
  feat: FeatFeatureDetail;
}

export interface InvocationFeatureDetail {
  id: string;
  name: string;
  text: string;
  effects?: unknown[];
}

export interface ClassFeatFeatureDetail {
  featureName: string;
  feat: FeatFeatureDetail;
}

export interface SheetOverrides {
  tempHp: number;
  acBonus: number;
  hpMaxBonus: number;
  inspiration?: boolean;
  abilityScores?: Partial<Record<AbilKey, number>>;
}

export type PolymorphConditionData = SharedPolymorphCondition & ConditionInstance;

export type EditableSheetOverrideKey = "tempHp" | "acBonus" | "hpMaxBonus";

export interface EditableSheetOverrideField {
  key: EditableSheetOverrideKey;
  label: string;
  help: string;
}

export interface ResourceProgressionOverride {
  className: string;
  featureName: string;
  values: Array<{ level: number; value: number }>;
}
