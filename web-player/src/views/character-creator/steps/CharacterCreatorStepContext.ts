import type React from "react";
import type {
  BgDetail,
  BgSummary,
  Campaign,
  ClassDetail,
  ClassSummary,
  CreatorResolvedSpellChoiceEntry,
  CreatorSpellListChoiceEntry,
  ItemSummary,
  LevelUpFeatDetail,
  ProficiencyChoice,
  RaceDetail,
  RaceSummary,
  SpellSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { ParsedFeatDetailLike as BackgroundFeat } from "@/views/character-creator/utils/FeatChoiceTypes";
import type { SharedSpellSummary } from "@/views/character-creator/utils/SpellChoiceUtils";
import type { SelectedFeatSpellcastingAbilityChoiceEntry } from "@/views/character-creator/utils/FeatSpellcastingUtils";
import type { FormState, Step } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { GrowthChoiceDefinition } from "@/views/character-creator/utils/GrowthChoiceUtils";
import type { PreparedSpellProgressionChoiceDefinition } from "@/views/character-creator/utils/CharacterCreatorSpellStepUtils";
import type { Step5ChoiceState } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import { getStep5ChoiceState } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import type { useCreatorProficiencyChoices } from "@/views/character-creator/useCreatorProficiencyChoices";

type CreatorProficiencyChoices = ReturnType<typeof useCreatorProficiencyChoices>;

export type StepRenderResult = { main: React.ReactNode; side: React.ReactNode };

export type CharacterCreatorStepRenderContext = {
  step: Step;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
  setField: (key: keyof FormState, value: FormState[keyof FormState]) => void;
  handleSubmit: () => Promise<void>;
  sideSummary: React.ReactNode;
  classDetail: ClassDetail | null;
  effectiveHitDie: number;
  classes: ClassSummary[];
  classSearch: string;
  setClassSearch: React.Dispatch<React.SetStateAction<string>>;
  races: RaceSummary[];
  raceSearch: string;
  setRaceSearch: React.Dispatch<React.SetStateAction<string>>;
  raceDetail: RaceDetail | null;
  featSummaries: { id: string; name: string; category?: string | null }[];
  raceFeatSearch: string;
  setRaceFeatSearch: React.Dispatch<React.SetStateAction<string>>;
  raceFeatDetail: BackgroundFeat | null;
  bgs: BgSummary[];
  bgSearch: string;
  setBgSearch: React.Dispatch<React.SetStateAction<string>>;
  bgDetail: BgDetail | null;
  bgOriginFeatSearch: string;
  setBgOriginFeatSearch: React.Dispatch<React.SetStateAction<string>>;
  bgOriginFeatDetail: BackgroundFeat | null;
  levelUpFeatDetails: LevelUpFeatDetail[];
  classFeatDetails: Record<string, BackgroundFeat>;
  classCantrips: SpellSummary[];
  classSpells: SpellSummary[];
  classInvocations: SpellSummary[];
  invocationFeatChoices: import("@/domain/character/invocationFeatChoices").InvocationFeatChoiceEntry[];
  invocationGrantedFeatChoices: ReturnType<typeof import("@/views/shared/useInvocationGrantedFeatChoices").useInvocationGrantedFeatChoices>;
  featSpellChoiceOptions: Record<string, SharedSpellSummary[]>;
  growthOptionEntriesByKey: Record<string, Array<{ id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean }>>;
  items: ItemSummary[];
  campaigns: Campaign[];
  error: string | null;
  busy: boolean;
  isEditing: boolean;
  getStep5ChoiceState: typeof getStep5ChoiceState;
  step5SkillList: string[];
  step5NumSkills: number;
  step5BgLangChoice: { fixed: string[]; choose: number; from: string[] | null };
  step5CoreLanguageChoice: ProficiencyChoice | null;
  step5ClassFeatChoices: CreatorProficiencyChoices["step5ClassFeatChoices"];
  step5ClassLanguageChoice: ProficiencyChoice | null;
  step5ClassExpertiseChoices: CreatorProficiencyChoices["step5ClassExpertiseChoices"];
  step5ClassToolProficiency: { fixed: string[]; choices: Array<{ count: number; from: string[] }>; notes: string[] } | null;
  step5WeaponMasteryChoice: { count: number; source: string } | null;
  step5WeaponOptions: string[];
  step5ChoiceState: Step5ChoiceState;
  step6SpellListChoices: CreatorSpellListChoiceEntry[];
  step6ResolvedSpellChoices: CreatorResolvedSpellChoiceEntry[];
  selectedFeatSpellcastingAbilityChoices: SelectedFeatSpellcastingAbilityChoiceEntry[];
  selectedClassFeatureProficiencyChoices: Array<{ id: string; choiceId?: string | null; source: { name: string }; choice?: { optionCategory?: string; options?: string[]; count: { kind: string; value: number } } }>;
  selectedFeatGrantedAbilityBonuses: Record<string, number>;
  selectedFeatAbilityBonuses: Record<string, number>;
  levelUpFeatLevels: number[];
  availableLevelUpFeats: { id: string; name: string }[];
  levelUpFeatConflict: string | null;
  getClassFeatChoiceLabel: (featGroup: string) => string;
  getClassFeatOptionLabel: (optionName: string, featGroup: string) => string;
  eligibleInvocationIds: Set<string>;
  growthChoiceDefinitions: GrowthChoiceDefinition[];
  preparedSpellProgressionChoiceDefinitions: PreparedSpellProgressionChoiceDefinition[];
  getGrowthChoiceSelectedAbility: (choices: Record<string, string[]>, definition: GrowthChoiceDefinition) => string | null;
  portraitInputRef: React.RefObject<HTMLInputElement | null>;
  portraitPreview: string | null;
  setPortraitFile: React.Dispatch<React.SetStateAction<File | null>>;
  setPortraitPreview: React.Dispatch<React.SetStateAction<string | null>>;
};
