import React from "react";
import {
  featureMatchesSubclass,
  getClassExpertiseChoices,
  isSubclassChoiceFeature,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  buildPreparedSpellProgressionChoiceDefinitions,
  buildPreparedSpellProgressionGrants,
} from "@/domain/character/characterFeatures";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import { deriveCharProficiencies } from "@/views/level-up/LevelUpHelpers";
import type { LevelUpCharacter as Character, LevelUpClassDetail as ClassDetail } from "@/views/level-up/LevelUpTypes";

type PrimaryClassLike = {
  classId?: string | null;
  subclass?: string | null;
};

/**
 * Level-up's expertise-choice and existing-proficiency-derivation cluster, plus the
 * prepared-spell-progression choices/grants that ride alongside it: everything here is derived
 * from this hook's own args, with no dependency on `parsedNewFeatureEffects` (the class-feature
 * effect parsing that stays in the parent hook) -- a self-contained cluster.
 *
 * `classFeatureProficiencyChoices` and the 4 `classFeature*Keys` sets stay in the parent hook:
 * they DO depend on `parsedNewFeatureEffects`, so extracting them here would mean threading that
 * back in, which isn't worth it for this pass -- they're consolidated in place instead.
 */
export function useLevelUpProficiencyChoices(args: {
  char: Character | null;
  classDetail: ClassDetail | null;
  nextClassLevel: number;
  subclass: string;
  primaryClassEntry: PrimaryClassLike | null;
  chosenFeatureChoices: Record<string, string[]>;
}) {
  const { char, classDetail, nextClassLevel, subclass, primaryClassEntry, chosenFeatureChoices } = args;

  const currentLevelExpertiseChoices = React.useMemo(
    () => (classDetail ? getClassExpertiseChoices(classDetail, nextClassLevel, subclass).filter((choice) => choice.key.startsWith(`classexpertise:${nextClassLevel}:`)) : []),
    [classDetail, nextClassLevel, subclass]
  );
  const expertiseChoices = React.useMemo(
    () => currentLevelExpertiseChoices.filter((choice) => !choice.replace),
    [currentLevelExpertiseChoices]
  );
  const expertiseReplacementChoices = React.useMemo(
    () => currentLevelExpertiseChoices.filter((choice) => choice.replace),
    [currentLevelExpertiseChoices]
  );
  const { charProficiencies, proficientSkills, proficientTools, proficientLanguages, proficientSaves, existingExpertise } = React.useMemo(
    () => deriveCharProficiencies(char),
    [char]
  );
  const appliedPreparedSpellProgressionFeatures = React.useMemo(
    () =>
      (classDetail?.autolevels ?? [])
        .filter((autolevel) => autolevel.level != null && autolevel.level <= nextClassLevel)
        .flatMap((autolevel) =>
          (autolevel.features ?? [])
            .filter((feature) =>
              featureMatchesSubclass(feature, subclass || primaryClassEntry?.subclass || null)
              && !isSubclassChoiceFeature(feature)
            )
            .map((feature) => ({
              id: `class:${String(primaryClassEntry?.classId ?? "")}:${String(feature.name ?? "").trim()}`,
              name: String(feature.name ?? "").trim(),
              text: String(feature.text ?? ""),
              preparedSpellProgression: feature.preparedSpellProgression,
            }))
        ),
    [classDetail?.autolevels, nextClassLevel, primaryClassEntry?.classId, primaryClassEntry?.subclass, subclass]
  );
  const preparedSpellProgressionChoiceDefinitions = React.useMemo(
    () => buildPreparedSpellProgressionChoiceDefinitions(appliedPreparedSpellProgressionFeatures),
    [appliedPreparedSpellProgressionFeatures]
  );
  const preparedSpellProgressionGrantedKeys = React.useMemo(
    () => new Set(
      buildPreparedSpellProgressionGrants(
        appliedPreparedSpellProgressionFeatures,
        nextClassLevel,
        chosenFeatureChoices,
      ).map((entry) => normalizeSpellTrackingKey(entry.spellName))
    ),
    [appliedPreparedSpellProgressionFeatures, chosenFeatureChoices, nextClassLevel]
  );

  return {
    expertiseChoices,
    expertiseReplacementChoices,
    charProficiencies,
    proficientSkills,
    proficientTools,
    proficientLanguages,
    proficientSaves,
    existingExpertise,
    preparedSpellProgressionChoiceDefinitions,
    preparedSpellProgressionGrantedKeys,
  };
}
