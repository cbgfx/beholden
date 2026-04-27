import React from "react";
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
import { deriveCharProficiencies, reconcileSelectedSpellIds, stripRulesetSuffix } from "@/views/level-up/LevelUpHelpers";
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
  classCantrips: Array<{ id: string; name: string; level?: number | null; text?: string | null }>;
  classSpells: Array<{ id: string; name: string; level?: number | null; text?: string | null }>;
  classInvocations: Array<{ id: string; name: string; level?: number | null; text?: string | null }>;
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
    classCantrips,
    classSpells,
    classInvocations,
  } = args;

  const hd = classDetail?.hd ?? 8;
  const conScore = char?.conScore ?? 10;
  const conMod = abilityMod(conScore);
  const hpAverage = Math.floor(hd / 2) + 1 + conMod;
  const hpRollMax = hd + conMod;

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
      || (
        Boolean(subclass)
        && /\(([^()]+)\)\s*$/.test(f.name)
        && new RegExp(`\\(${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "i").test(f.name)
      )
    ) ?? [],
    [autoLevel, subclass]
  );
  const isAsiLevel = Boolean(autoLevel?.scoreImprovement ?? hasAsiFeature);
  const newSlots = autoLevel?.slots ?? null;
  const subclassLevel = classDetail ? getSubclassLevel(classDetail) : null;
  const subclassOptions = classDetail ? getSubclassList(classDetail) : [];
  const showSubclassChoice = Boolean(subclassLevel && nextLevel === subclassLevel && subclassOptions.length > 0);
  const needsSubclassChoice = Boolean(subclassLevel && nextLevel >= subclassLevel && subclassOptions.length > 0 && !subclass.trim());
  const subclassOverview = React.useMemo(() => {
    if (!classDetail || !subclass.trim()) return null;
    const className = stripRulesetSuffix(classDetail.name);
    const subclassPattern = new RegExp(`^${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Subclass:\\s+${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    for (const autolevel of mergedAutolevels) {
      const feature = autolevel.features.find((entry) => subclassPattern.test(entry.name));
      if (feature) return feature;
    }
    return null;
  }, [classDetail, mergedAutolevels, subclass]);
  const selectedSubclassFeatures = React.useMemo(() => {
    if (!autoLevel || !subclass.trim()) return [];
    const subclassSuffix = new RegExp(`\\(${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "i");
    return autoLevel.features.filter((feature) => subclassSuffix.test(feature.name));
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
  const { charProficiencies, proficientSkills, proficientTools, proficientLanguages, existingExpertise } = deriveCharProficiencies(char);
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
          kind: /\(/.test(feature.name) ? "subclass" : "class",
          name: feature.name,
          text: feature.text,
          level: nextLevel,
        },
        text: feature.text,
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
        .map((choice) => ({
          key: `levelupclassfeature:${nextLevel}:${choice.id}`,
          title: choice.source.name,
          sourceLabel: choice.source.name,
          count: choice.count.kind === "fixed" ? choice.count.value : 0,
          level: choice.level,
          note: choice.note ?? null,
          linkedTo: null,
          listNames: choice.spellLists,
          schools: choice.schools,
          ritualOnly: false,
        })),
      ...slotLevelTriggeredSpellChoices,
    ],
    [nextLevel, parsedNewFeatureEffects, slotLevelTriggeredSpellChoices]
  );
  const classFeatureProficiencyChoices = React.useMemo(
    () => collectProficiencyChoiceEffectsFromEffects(parsedNewFeatureEffects)
      .filter((choice) =>
        !choice.expertise
        && choice.choice?.count.kind === "fixed"
        && ["skill", "tool", "language"].includes(choice.choice?.optionCategory ?? "")
      )
      .map((choice) => ({
        key: `classfeature:${choice.id}`,
        sourceLabel: choice.source.name,
        category: choice.choice?.optionCategory as "skill" | "tool" | "language",
        count: choice.choice?.count.kind === "fixed" ? choice.choice.count.value : 0,
      }))
      .filter((choice) => choice.count > 0),
    [parsedNewFeatureEffects]
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
      })),
    [char?.className, chosenInvocations, classDetail?.name, classInvocations, nextLevel]
  );
  const invocationResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => collectSpellChoicesFromEffects(selectedInvocationEffects).flatMap((choice) => {
      if (choice.count.kind !== "fixed") return [];
      return [{
        key: `invocation:${choice.id}`,
        title: choice.source.name,
        sourceLabel: choice.source.name,
        count: choice.count.value,
        level: choice.level,
        note: choice.note ?? choice.summary ?? null,
        linkedTo: null,
        listNames: choice.spellLists,
        schools: choice.schools,
        ritualOnly: /\britual tag\b/i.test(choice.note ?? ""),
      }];
    }),
    [selectedInvocationEffects]
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
    hpRollMax,
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
    parsedNewFeatureEffects,
    slotLevelTriggeredSpellChoices,
    classFeatureResolvedSpellChoices,
    classFeatureProficiencyChoices,
    classFeatureSkillKeys,
    classFeatureToolKeys,
    classFeatureLanguageKeys,
    growthChoiceDefinitions,
    appliedPreparedSpellProgressionFeatures,
    preparedSpellProgressionChoiceDefinitions,
    preparedSpellProgressionGrantedKeys,
    selectedInvocationEffects,
    invocationResolvedSpellChoices,
    allowedInvocationIds,
    featSpellChoiceOptions,
    classFeatureSpellChoiceOptions,
    invocationSpellChoiceOptions,
    growthOptionEntriesByKey,
  };
}
