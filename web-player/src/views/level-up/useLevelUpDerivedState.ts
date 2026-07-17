import React from "react";
import { getInvocationFeatChoices } from "@/domain/character/invocationFeatChoices";
import { abilityMod, normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import {
  featureMatchesSubclass,
  getCantripCount,
  getClassExpertiseChoices,
  getClassFeatureTable,
  getFeatChoiceOptions,
  getGrowthChoiceDefinitions,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSpellSlotsAtLevel,
  getSlotLevelTriggeredSpellChoices,
  getSubclassLevel,
  getSubclassList,
  isSpellcaster,
  isSubclassChoiceFeature,
  normalizeChoiceKey,
  tableValueAtLevel,
  usesFlexiblePreparedSpells,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import { parseFeatureEffects, collectSpellChoicesFromEffects, collectProficiencyChoiceEffectsFromEffects } from "@/domain/character/parseFeatureEffects";
import {
  buildPreparedSpellProgressionChoiceDefinitions,
  buildPreparedSpellProgressionGrants,
} from "@/domain/character/characterFeatures";
import { buildResolvedSpellChoiceEntry, buildSpellListChoiceEntry } from "@/views/character-creator/utils/SpellChoiceUtils";
import { getFeatSpellcastingAbilityChoice } from "@/views/character-creator/utils/FeatSpellcastingUtils";
import { deriveAllowedInvocationIds } from "@/views/level-up/LevelUpUtils";
import { deriveCharProficiencies } from "@/views/level-up/LevelUpHelpers";
import type {
  LevelUpCharacter as Character,
  LevelUpClassDetail as ClassDetail,
  LevelUpFeatDetail as FeatDetail,
  LevelUpResolvedSpellChoiceEntry,
  LevelUpSpellListChoiceEntry,
} from "@/views/level-up/LevelUpTypes";
import { useLevelUpChoiceData } from "@/views/level-up/useLevelUpChoiceData";

type PrimaryClassLike = {
  classId?: string | null;
  subclass?: string | null;
};

export function useLevelUpDerivedState(args: {
  char: Character | null;
  classDetail: ClassDetail | null;
  mergedAutolevels: ClassDetail["autolevels"];
  nextLevel: number;
  primaryClassEntry: PrimaryClassLike | null;
  subclass: string;
  chosenCantrips: string[];
  chosenInvocations: string[];
  chosenFeatOptions: Record<string, string[]>;
  chosenFeatureChoices: Record<string, string[]>;
  chosenFeatDetail: FeatDetail | null;
  featSummaries: Array<{ id: string; name: string; category?: string | null }>;
  classCantrips: Array<{ id: string; name: string; level?: number | null; text?: string | null }>;
  classInvocations: Array<{ id: string; name: string; level?: number | null; text?: string | null; effects?: unknown[] }>;
}) {
  const {
    char,
    classDetail,
    mergedAutolevels,
    nextLevel,
    primaryClassEntry,
    subclass,
    chosenCantrips,
    chosenInvocations,
    chosenFeatOptions,
    chosenFeatureChoices,
    chosenFeatDetail,
    featSummaries,
    classCantrips,
    classInvocations,
  } = args;

  const hd = classDetail?.hd ?? 8;
  const conScore = char?.conScore ?? 10;
  const conMod = abilityMod(conScore);
  const hpAverage = Math.floor(hd / 2) + 1 + conMod;

  const autoLevel = React.useMemo(
    () => mergedAutolevels.find((al) => al.level === nextLevel) ?? null,
    [mergedAutolevels, nextLevel]
  );
  const hasAsiFeature = Boolean(
    autoLevel?.features?.some((feature) => /ability score improvement/i.test(feature.name))
  );
  const usesFlexiblePreparedSpellsModel = usesFlexiblePreparedSpells(classDetail);
  const newFeatures = React.useMemo(
    () => autoLevel?.features.filter((f) =>
      !f.optional
      || (Boolean(subclass) && f.subclass === subclass)
    ) ?? [],
    [autoLevel, subclass]
  );
  const isAsiLevel = Boolean(autoLevel?.scoreImprovement ?? hasAsiFeature);
  const newSlots = classDetail ? getSpellSlotsAtLevel(classDetail, nextLevel, subclass) : null;
  const subclassLevel = classDetail ? getSubclassLevel(classDetail) : null;
  const subclassOptions = classDetail ? getSubclassList(classDetail) : [];
  const showSubclassChoice = Boolean(subclassLevel && nextLevel === subclassLevel && subclassOptions.length > 0);
  const needsSubclassChoice = Boolean(subclassLevel && nextLevel >= subclassLevel && subclassOptions.length > 0 && !subclass.trim());
  const subclassOverview = React.useMemo(() => {
    if (!subclass.trim()) return null;
    for (const autolevel of mergedAutolevels) {
      const feature = autolevel.features.find((entry) => entry.subclass === subclass);
      if (feature) return feature;
    }
    return null;
  }, [mergedAutolevels, subclass]);
  const selectedSubclassFeatures = React.useMemo(() => {
    if (!autoLevel || !subclass.trim()) return [];
    return autoLevel.features.filter((feature) => feature.subclass === subclass);
  }, [autoLevel, subclass]);
  const cantripCount = classDetail ? getCantripCount(classDetail, nextLevel, subclass) : 0;
  const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", nextLevel, subclass) : [];
  const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, nextLevel) : 0;
  const prepCount = classDetail ? getPreparedSpellCount(classDetail, nextLevel, subclass) : 0;
  const maxSpellLevel = classDetail ? getMaxSlotLevel(classDetail, nextLevel, subclass) : 0;
  const spellcaster = classDetail ? isSpellcaster(classDetail, nextLevel, subclass) : false;
  const expertiseChoices = React.useMemo(
    () => (classDetail ? getClassExpertiseChoices(classDetail, nextLevel).filter((choice) => choice.key.startsWith(`classexpertise:${nextLevel}:`)) : []),
    [classDetail, nextLevel]
  );
  const { charProficiencies, proficientSkills, proficientTools, proficientLanguages, proficientSaves, existingExpertise } = deriveCharProficiencies(char);
  const existingClassSpellNames = React.useMemo(
    () => Array.isArray(char?.characterData?.proficiencies?.spells)
      ? char.characterData.proficiencies.spells
        .filter((entry) => entry.source === (classDetail?.name ?? char.className))
        .map((entry) => entry.name)
      : [],
    [char?.characterData?.proficiencies?.spells, char?.className, classDetail?.name]
  );
  const existingClassInvocationNames = React.useMemo(
    () => Array.isArray(char?.characterData?.proficiencies?.invocations)
      ? char.characterData.proficiencies.invocations
        .filter((entry) => entry.source === (classDetail?.name ?? char.className))
        .map((entry) => entry.name)
      : [],
    [char?.characterData?.proficiencies?.invocations, char?.className, classDetail?.name]
  );
  const featChoiceEntries = React.useMemo(
    () => {
      if (!chosenFeatDetail) return [];
      const baseChoices = (chosenFeatDetail.parsed.choices ?? []).filter((choice) => choice.type !== "damage_type");
      const abilityChoice = getFeatSpellcastingAbilityChoice(chosenFeatDetail);
      if (!abilityChoice || baseChoices.some((choice) => choice.id === abilityChoice.id)) return baseChoices;
      return [...baseChoices, abilityChoice];
    },
    [chosenFeatDetail]
  );
  const featSourceLabel = chosenFeatDetail ? `${chosenFeatDetail.name} (Level ${nextLevel})` : "";
  const featSpellListChoices = React.useMemo<LevelUpSpellListChoiceEntry[]>(
    () => {
      if (!chosenFeatDetail) return [];
      return featChoiceEntries
        .filter((choice) => choice.type === "spell_list")
        .map((choice) => {
          const entry = buildSpellListChoiceEntry({
            key: `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`,
            choice: { ...choice, options: getFeatChoiceOptions(choice) },
            level: nextLevel,
            sourceLabel: featSourceLabel,
          });
          return {
            ...entry,
            title: "Spell List",
            note: entry.options.length === 1
              ? (choice.note ?? "Spell list fixed by this feat.")
              : choice.note,
          };
        });
    },
    [chosenFeatDetail, featChoiceEntries, featSourceLabel, nextLevel]
  );
  const featResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => {
      if (!chosenFeatDetail) return [];
      return featChoiceEntries
        .filter((choice) => choice.type === "spell")
        .map((choice) => {
          const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
          const linkedChoiceKey = choice.linkedTo ? `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.linkedTo}` : null;
          return {
            ...buildResolvedSpellChoiceEntry({
              key,
              choice,
              level: nextLevel,
              sourceLabel: chosenFeatDetail.name,
              chosenOptions: chosenFeatOptions,
              linkedChoiceKey,
            }),
          };
        });
    },
    [chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel]
  );
  const parsedNewFeatureEffects = React.useMemo(
    () => newFeatures.map((feature, index) =>
      parseFeatureEffects({
        source: {
          id: `levelup:${nextLevel}:${index}:${feature.name}`,
          kind: feature.subclass ? "subclass" : "class",
          name: feature.name,
          text: feature.text,
          level: nextLevel,
        },
        text: feature.text,
        classEffects: feature.effects,
        classChoices: feature.choices,
      })
    ),
    [newFeatures, nextLevel]
  );
  const slotLevelTriggeredSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () =>
      getSlotLevelTriggeredSpellChoices(
        classDetail,
        Math.max(0, nextLevel - 1),
        nextLevel,
        subclass || primaryClassEntry?.subclass || null,
      ).map((choice) => ({
        key: `levelupslotgrowth:${nextLevel}:${choice.key}`,
        title: choice.title,
        sourceLabel: choice.sourceLabel,
        count: choice.count,
        level: choice.level,
        note: choice.note ?? null,
        linkedTo: null,
        listNames: choice.listNames,
        schools: choice.schools,
        ritualOnly: false,
      })),
    [classDetail, nextLevel, primaryClassEntry?.subclass, subclass]
  );
  const classFeatureResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => [
      ...collectSpellChoicesFromEffects(parsedNewFeatureEffects)
        .filter((choice) => !/^(level\s+\d+:\s+)?(spellcasting|pact magic)\b/i.test(choice.source.name))
        .filter((choice) => !choice.ifKnown || existingClassSpellNames.some((name) => name.trim().toLowerCase() === choice.ifKnown!.trim().toLowerCase()))
        .map((choice) => ({
          key: `levelupclassfeature:${nextLevel}:${choice.id}`,
          title: choice.source.name,
          sourceLabel: choice.source.name,
          count: choice.count.kind === "fixed" ? choice.count.value : 0,
          level: choice.level,
          // Cap "any level" choices (level===null) to the character's highest spell slot so
          // e.g. a L6 Bard picking Magical Discoveries only sees up to 3rd-level spells.
          maxLevel: choice.level === null && maxSpellLevel > 0 ? maxSpellLevel : null,
          note: choice.note ?? null,
          linkedTo: null,
          listNames: choice.spellLists,
          schools: choice.schools,
          ritualOnly: false,
        })),
      ...slotLevelTriggeredSpellChoices,
    ],
    [existingClassSpellNames, nextLevel, maxSpellLevel, parsedNewFeatureEffects, slotLevelTriggeredSpellChoices]
  );
  const classFeatureProficiencyChoices = React.useMemo(
    () => collectProficiencyChoiceEffectsFromEffects(parsedNewFeatureEffects)
      .filter((choice) =>
        !choice.expertise
        && choice.choice?.count.kind === "fixed"
        && ["skill", "tool", "language", "saving_throw"].includes(choice.choice?.optionCategory ?? "")
        && (!choice.choice?.ifProficient || proficientSaves.map(normalizeChoiceKey).includes(normalizeChoiceKey(choice.choice.ifProficient)))
      )
      .map((choice) => ({
        key: `classfeature:${choice.id}`,
        sourceLabel: choice.source.name,
        category: choice.choice?.optionCategory as "skill" | "tool" | "language" | "saving_throw",
        count: choice.choice?.count.kind === "fixed" ? choice.choice.count.value : 0,
        options: choice.choice?.options,
      }))
      .filter((choice) => choice.count > 0),
    [parsedNewFeatureEffects, proficientSaves]
  );
  const classFeatureSkillKeys = React.useMemo(
    () => new Set([
      ...proficientSkills.map(normalizeChoiceKey),
      ...classFeatureProficiencyChoices
        .filter((choice) => choice.category === "skill")
        .flatMap((choice) => chosenFeatureChoices[choice.key] ?? [])
        .map(normalizeChoiceKey),
    ]),
    [chosenFeatureChoices, classFeatureProficiencyChoices, proficientSkills]
  );
  const classFeatureToolKeys = React.useMemo(
    () => new Set([
      ...proficientTools.map(normalizeChoiceKey),
      ...classFeatureProficiencyChoices
        .filter((choice) => choice.category === "tool")
        .flatMap((choice) => chosenFeatureChoices[choice.key] ?? [])
        .map(normalizeChoiceKey),
    ]),
    [chosenFeatureChoices, classFeatureProficiencyChoices, proficientTools]
  );
  const classFeatureLanguageKeys = React.useMemo(
    () => new Set([
      ...proficientLanguages.map(normalizeChoiceKey),
      ...classFeatureProficiencyChoices
        .filter((choice) => choice.category === "language")
        .flatMap((choice) => chosenFeatureChoices[choice.key] ?? [])
        .map(normalizeChoiceKey),
    ]),
    [chosenFeatureChoices, classFeatureProficiencyChoices, proficientLanguages]
  );
  const classFeatureSaveKeys = React.useMemo(
    () => new Set([
      ...proficientSaves.map(normalizeChoiceKey),
      ...classFeatureProficiencyChoices
        .filter((choice) => choice.category === "saving_throw")
        .flatMap((choice) => chosenFeatureChoices[choice.key] ?? [])
        .map(normalizeChoiceKey),
    ]),
    [chosenFeatureChoices, classFeatureProficiencyChoices, proficientSaves]
  );
  const growthChoiceDefinitions = React.useMemo(
    () => getGrowthChoiceDefinitions({
      classId: String(primaryClassEntry?.classId ?? ""),
      className: classDetail?.name ?? char?.className ?? null,
      classDetail,
      level: nextLevel,
      selectedSubclass: subclass || primaryClassEntry?.subclass || null,
    }),
    [char?.className, classDetail, nextLevel, primaryClassEntry?.classId, primaryClassEntry?.subclass, subclass]
  );
  const appliedPreparedSpellProgressionFeatures = React.useMemo(
    () =>
      (classDetail?.autolevels ?? [])
        .filter((autolevel) => autolevel.level != null && autolevel.level <= nextLevel)
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
    [classDetail?.autolevels, nextLevel, primaryClassEntry?.classId, primaryClassEntry?.subclass, subclass]
  );
  const preparedSpellProgressionChoiceDefinitions = React.useMemo(
    () => buildPreparedSpellProgressionChoiceDefinitions(appliedPreparedSpellProgressionFeatures),
    [appliedPreparedSpellProgressionFeatures]
  );
  const preparedSpellProgressionGrantedKeys = React.useMemo(
    () => new Set(
      buildPreparedSpellProgressionGrants(
        appliedPreparedSpellProgressionFeatures,
        nextLevel,
        chosenFeatureChoices,
      ).map((entry) => normalizeSpellTrackingKey(entry.spellName))
    ),
    [appliedPreparedSpellProgressionFeatures, chosenFeatureChoices, nextLevel]
  );
  const selectedInvocationEffects = React.useMemo(
    () => classInvocations
      .filter((invocation) => chosenInvocations.includes(invocation.id) && String(invocation.text ?? "").trim())
      .map((invocation) => parseFeatureEffects({
        source: {
          id: `levelupinvocation:${nextLevel}:${invocation.id}`,
          kind: "invocation",
          name: invocation.name,
          parentName: classDetail?.name ?? char?.className ?? null,
          text: invocation.text ?? "",
        },
        text: invocation.text ?? "",
        classEffects: invocation.effects,
      })),
    [char?.className, chosenInvocations, classDetail?.name, classInvocations, nextLevel]
  );
  const invocationResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => collectSpellChoicesFromEffects(selectedInvocationEffects).flatMap((rawChoice) => {
      const invocationId = rawChoice.source.id.replace(/^levelupinvocation:\d+:/, "");
      const copies = Math.max(1, chosenInvocations.filter((id) => id === invocationId).length);
      const choice = rawChoice.count.kind === "fixed" ? { ...rawChoice, count: { ...rawChoice.count, value: rawChoice.count.value * copies } } : rawChoice;
      if (choice.count.kind !== "fixed") return [];
      return [{
        key: `invocation:${choice.choiceId ?? choice.id}`,
        title: choice.source.name,
        sourceLabel: choice.source.name,
        count: choice.count.value,
        level: choice.level,
        note: choice.note ?? choice.summary ?? null,
        linkedTo: null,
        listNames: choice.spellLists,
        schools: choice.schools,
        ritualOnly: choice.filters?.ritual === true,
        damageOnly: choice.filters?.damage === true,
        attackOnly: choice.filters?.attack === true,
        allowedSpellIds: choice.filters?.known === true
          ? [...(char?.characterData?.chosenCantrips ?? []), ...chosenCantrips]
          : undefined,
        grantsSpell: choice.mode !== "select",
      }];
    }),
    [char?.characterData?.chosenCantrips, chosenCantrips, chosenInvocations, selectedInvocationEffects]
  );
  const invocationFeatChoices = React.useMemo(
    () => getInvocationFeatChoices(classInvocations, chosenInvocations, featSummaries),
    [classInvocations, chosenInvocations, featSummaries],
  );
  const allInvocationFeatChoices = React.useMemo(
    () => getInvocationFeatChoices(classInvocations, classInvocations.map((invocation) => invocation.id), featSummaries),
    [classInvocations, featSummaries],
  );
  const allowedInvocationIds = React.useMemo(
    () => deriveAllowedInvocationIds({ classCantrips, classInvocations, chosenCantrips, chosenInvocations, nextLevel }),
    [chosenCantrips, chosenInvocations, classCantrips, classInvocations, nextLevel]
  );
  const {
    featSpellChoiceOptions,
    classFeatureSpellChoiceOptions,
    invocationSpellChoiceOptions,
    growthOptionEntriesByKey,
  } = useLevelUpChoiceData({
    chosenFeatDetail,
    featResolvedSpellChoices,
    classFeatureResolvedSpellChoices,
    invocationResolvedSpellChoices,
    growthChoiceDefinitions,
  });

  return {
    hd,
    conScore,
    conMod,
    hpAverage,
    autoLevel,
    hasAsiFeature,
    usesFlexiblePreparedSpellsModel,
    newFeatures,
    isAsiLevel,
    newSlots,
    subclassLevel,
    subclassOptions,
    showSubclassChoice,
    needsSubclassChoice,
    subclassOverview,
    selectedSubclassFeatures,
    cantripCount,
    invocCount,
    prepCount,
    maxSpellLevel,
    spellcaster,
    expertiseChoices,
    charProficiencies,
    proficientSkills,
    proficientTools,
    proficientLanguages,
    existingExpertise,
    existingClassSpellNames,
    existingClassInvocationNames,
    featChoiceEntries,
    featSourceLabel,
    featSpellListChoices,
    featResolvedSpellChoices,
    slotLevelTriggeredSpellChoices,
    classFeatureResolvedSpellChoices,
    classFeatureProficiencyChoices,
    classFeatureSkillKeys,
    classFeatureToolKeys,
    classFeatureLanguageKeys,
    classFeatureSaveKeys,
    growthChoiceDefinitions,
    appliedPreparedSpellProgressionFeatures,
    preparedSpellProgressionChoiceDefinitions,
    preparedSpellProgressionGrantedKeys,
    selectedInvocationEffects,
    invocationResolvedSpellChoices,
    invocationFeatChoices,
    allInvocationFeatChoices,
    allowedInvocationIds,
    featSpellChoiceOptions,
    classFeatureSpellChoiceOptions,
    invocationSpellChoiceOptions,
    growthOptionEntriesByKey,
  };
}
