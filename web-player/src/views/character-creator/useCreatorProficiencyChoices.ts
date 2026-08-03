import React from "react";
import {
  ALL_LANGUAGES,
  STANDARD_55E_LANGUAGES,
  getEligibleWeaponMasteryKinds,
} from "@/views/character-creator/constants/CharacterCreatorConstants";
import {
  getClassExpertiseChoices,
  parseSkillList,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import { getStep5ChoiceState } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import { getWeaponMasteryChoice as getWeaponMasteryChoiceFromUtils } from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import { getClassFeatChoices, type FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import {
  getClassLanguageChoice as getClassLanguageChoiceFromRules,
  getCoreLanguageChoice as getCoreLanguageChoiceFromRules,
} from "@/views/character/CharacterRuleParsers";
import type { ParsedFeatDetailLike as BackgroundFeat } from "@/views/character-creator/utils/FeatChoiceTypes";
import type {
  BgDetail,
  ClassDetail,
  LevelUpFeatDetail,
  RaceDetail,
} from "@/views/character-creator/utils/CharacterCreatorTypes";

/**
 * The character creator's step-5 ("Skills & Proficiencies") choice-derivation cluster: every
 * skill/tool/language/expertise/weapon-mastery choice available given the current class/race/
 * background, culminating in `step5ChoiceState` (the step's full UI-facing choice state).
 *
 * Extracted from useCharacterCreatorDerivedState.ts because it's entirely derived from this
 * hook's own args, with no dependency on the class-feature/race-trait effect parsing that stays
 * in the parent hook -- a self-contained cluster, not a partial slice of a bigger one.
 */
export function useCreatorProficiencyChoices(args: {
  form: FormState;
  classDetail: ClassDetail | null;
  raceDetail: RaceDetail | null;
  bgDetail: BgDetail | null;
  resolvedRaceFeatDetail: BackgroundFeat | null;
  resolvedBgOriginFeatDetail: BackgroundFeat | null;
  classFeatDetails: Record<string, BackgroundFeat>;
  levelUpFeatDetails: LevelUpFeatDetail[];
  featSummaries: Array<{ id: string; name: string }>;
}) {
  const {
    form,
    classDetail,
    raceDetail,
    bgDetail,
    resolvedRaceFeatDetail,
    resolvedBgOriginFeatDetail,
    classFeatDetails,
    levelUpFeatDetails,
    featSummaries,
  } = args;

  const step5SkillList = React.useMemo(
    () => classDetail ? parseSkillList(classDetail.proficiency) : [],
    [classDetail]
  );
  const step5NumSkills = classDetail?.numSkills ?? 0;
  const step5BgLangChoice = React.useMemo(
    () => bgDetail?.proficiencies?.languages ?? { fixed: [], choose: 0, from: null },
    [bgDetail]
  );
  const step5BgSkillFixed = React.useMemo(
    () => bgDetail?.proficiencies?.skills?.fixed ?? (bgDetail ? parseSkillList(bgDetail.proficiency) : []),
    [bgDetail]
  );
  const step5BgToolFixed = React.useMemo(
    () => bgDetail?.proficiencies?.tools?.fixed ?? [],
    [bgDetail]
  );
  const step5ClassToolProficiency = React.useMemo(
    () => {
      const tools = classDetail?.proficiencies?.tools;
      if (!tools) return null;
      return {
        fixed: Array.isArray(tools.fixed) ? tools.fixed : [],
        choices: Array.isArray(tools.choices) ? tools.choices : [],
        notes: Array.isArray(tools.notes) ? tools.notes : [],
      };
    },
    [classDetail]
  );
  const step5CoreLanguageChoice = React.useMemo(
    () => getCoreLanguageChoiceFromRules(raceDetail?.parsedChoices ?? null, STANDARD_55E_LANGUAGES),
    [raceDetail]
  );
  const step5ClassFeatChoices = React.useMemo(
    () => getClassFeatChoices(classDetail, form.level, featSummaries, form.subclass),
    [classDetail, form.level, featSummaries, form.subclass]
  );
  const step5ClassLanguageChoice = React.useMemo(
    () => getClassLanguageChoiceFromRules(classDetail, form.level, ALL_LANGUAGES, form.subclass),
    [classDetail, form.level, form.subclass]
  );
  const step5ClassExpertiseChoices = React.useMemo(
    // "replace" groups (e.g. Bardic Versatility) only make sense as a level-up swap of an
    // already-chosen skill; direct creation just picks the final held set, so they're a no-op here.
    () => getClassExpertiseChoices(classDetail, form.level, form.subclass).filter((choice) => !choice.replace),
    [classDetail, form.level, form.subclass]
  );
  const step5WeaponMasteryChoice = React.useMemo(
    () => getWeaponMasteryChoiceFromUtils(classDetail, form.level),
    [classDetail, form.level]
  );
  const step5WeaponOptions = React.useMemo(
    () => getEligibleWeaponMasteryKinds(classDetail?.proficiencies?.weapons).sort((a, b) => a.localeCompare(b)),
    [classDetail]
  );
  const step5ChoiceState = React.useMemo(() => getStep5ChoiceState({
    form,
    bgDetail,
    raceDetailName: raceDetail?.name,
    bgOriginFeatDetail: resolvedBgOriginFeatDetail,
    bgSkillFixed: step5BgSkillFixed,
    bgToolFixed: step5BgToolFixed,
    classToolProficiency: step5ClassToolProficiency,
    classFeatChoices: step5ClassFeatChoices,
    classFeatDetails,
    raceFeatDetail: resolvedRaceFeatDetail,
    levelUpFeatDetails,
    classLanguageChoice: step5ClassLanguageChoice,
    coreLanguageChoice: step5CoreLanguageChoice,
    classExpertiseChoices: step5ClassExpertiseChoices,
    weaponMasteryChoice: step5WeaponMasteryChoice,
    weaponOptions: step5WeaponOptions,
  }), [
    classFeatDetails,
    form,
    bgDetail,
    levelUpFeatDetails,
    raceDetail?.name,
    resolvedBgOriginFeatDetail,
    resolvedRaceFeatDetail,
    step5BgSkillFixed,
    step5BgToolFixed,
    step5ClassToolProficiency,
    step5ClassExpertiseChoices,
    step5ClassFeatChoices,
    step5ClassLanguageChoice,
    step5CoreLanguageChoice,
    step5WeaponMasteryChoice,
    step5WeaponOptions,
  ]);

  return {
    step5SkillList,
    step5NumSkills,
    step5BgLangChoice,
    step5CoreLanguageChoice,
    step5ClassFeatChoices,
    step5ClassLanguageChoice,
    step5ClassExpertiseChoices,
    step5ClassToolProficiency,
    step5WeaponMasteryChoice,
    step5WeaponOptions,
    step5ChoiceState,
  };
}
