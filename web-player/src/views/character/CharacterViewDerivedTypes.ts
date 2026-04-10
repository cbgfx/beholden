import type {
  Character,
  ClassRestDetail,
  RaceFeatureDetail,
  BackgroundFeatureDetail,
  FeatFeatureDetail,
  LevelUpFeatDetail,
  InvocationFeatureDetail,
  ClassFeatFeatureDetail,
  SheetOverrides,
  EditableSheetOverrideField,
  PolymorphConditionData,
} from "@/views/character/CharacterViewHelpers";
import type { AbilKey, CharacterData, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import type { InventoryItem } from "@/views/character/CharacterInventory";

type NormalizeProficienciesResult = ReturnType<typeof import("@/views/character/CharacterViewHelpers").normalizeProficiencies>;
type ScoreExplanationsResult = ReturnType<typeof import("@/views/character/CharacterViewHelpers").buildAbilityScoreExplanations>;
type AppliedFeaturesResult = ReturnType<typeof import("@/domain/character/characterFeatures").buildAppliedCharacterFeatures>;
type ClassFeaturesListResult = ReturnType<typeof import("@/domain/character/characterFeatures").buildDisplayPlayerFeatures>;
type ParsedFeatureEffectsResult = ReturnType<typeof import("@/domain/character/parseFeatureEffects").parseFeatureEffects>;
type GrantedSpellDataResult = ReturnType<typeof import("@/domain/character/parseFeatureEffects").buildGrantedSpellDataFromEffects>;
type MovementModesResult = ReturnType<typeof import("@/domain/character/parseFeatureEffects").collectMovementModesFromEffects>;
type MonsterSpeedModes = ReturnType<typeof import("@beholden/shared/domain").parseMonsterSpeed>["modes"];

export type TransformedMonsterState = {
  monster: any | null;
  busy: boolean;
  error: string | null;
};

export type CharacterViewDerivedStateArgs = {
  char: Character;
  classDetail: ClassRestDetail | null;
  raceDetail: RaceFeatureDetail | null;
  backgroundDetail: BackgroundFeatureDetail | null;
  bgOriginFeatDetail: FeatFeatureDetail | null;
  raceFeatDetail: FeatFeatureDetail | null;
  classFeatDetails: ClassFeatFeatureDetail[];
  levelUpFeatDetails: LevelUpFeatDetail[];
  invocationDetails: InvocationFeatureDetail[];
  subclass: string | null;
  polymorphCondition: PolymorphConditionData | null;
  polymorphMonsterState: TransformedMonsterState;
};

export type CharacterViewDerivedState = {
  currentCharacterData: CharacterData;
  prof: NormalizeProficienciesResult;
  pb: number;
  hd: number | null;
  hitDieSize: number | null;
  hitDiceMax: number;
  hitDiceCurrent: number;
  inventory: InventoryItem[];
  baseScores: Record<AbilKey, number | null>;
  scores: Record<AbilKey, number | null>;
  scoreExplanations: ScoreExplanationsResult;
  appliedFeatures: AppliedFeaturesResult;
  classFeaturesList: ClassFeaturesListResult;
  parsedFeatureEffects: ParsedFeatureEffectsResult[];
  grantedSpellData: GrantedSpellDataResult;
  classResourcesWithSpellCasts: ResourceCounter[];
  polymorphName: string;
  rageActive: boolean;
  parsedDefenses: {
    resistances: string[];
    damageImmunities: string[];
    conditionImmunities: string[];
    vulnerabilities: string[];
  };
  usesFlexiblePreparedList: boolean;
  preparedSpellLimit: number;
  preparedSpells: string[];
  invocationSpellDamageBonuses: Record<string, number>;
  accentColor: string;
  overrides: SheetOverrides;
  featureHpMaxBonus: number;
  effectiveHpMax: number;
  xpEarned: number;
  xpNeeded: number;
  nonProficientArmorPenalty: boolean;
  hasDisadvantage: boolean;
  stealthDisadvantage: boolean;
  dexMod: number;
  conMod: number;
  hasJackOfAllTrades: boolean;
  effectiveAc: number;
  effectiveSpeed: number;
  movementModes: MovementModesResult;
  tempHp: number;
  hpPct: number;
  tempPct: number;
  passivePerc: number;
  passiveInv: number;
  initiativeBonus: number;
  transformedCombatStats: {
    effectiveAc: number;
    speed: number;
    movementModes: MonsterSpeedModes;
    initiativeBonus: number;
    pb: number;
    passivePerc: number;
    passiveInv: number;
    dexScore: number;
    strScore: number | null;
    className: string;
  } | null;
  saveBonuses: Partial<Record<AbilKey, number>>;
  abilityCheckAdvantages: Partial<Record<AbilKey, boolean>>;
  abilityCheckDisadvantages: Partial<Record<AbilKey, boolean>>;
  saveAdvantages: Partial<Record<AbilKey, boolean>>;
  saveDisadvantages: Partial<Record<AbilKey, boolean>>;
  skillAdvantages: Record<string, boolean>;
  skillDisadvantages: Record<string, boolean>;
  rageDamageBonus: number;
  unarmedRageDamageBonus: number;
  senses: string[];
  editableOverrideFields: EditableSheetOverrideField[];
  identityFields: [string, string][];
};
