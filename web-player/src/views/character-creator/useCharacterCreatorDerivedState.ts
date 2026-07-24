import React from "react";
import {
  invocationPrerequisitesMet,
  resolvePactBoonFromChosenOptionals,
  spellLooksLikeDamageSpell,
} from "@/views/character/CharacterSheetUtils";
import {
  collectProficiencyChoiceEffectsFromEffects,
  collectSpellChoicesFromEffects,
  parseFeatureEffects,
  type ParseFeatureEffectsInput,
} from "@/domain/character/parseFeatureEffects";
import { buildAppliedCharacterFeatures, buildPreparedSpellProgressionChoiceDefinitions } from "@/domain/character/characterFeatures";
import {
  ALL_LANGUAGES,
  STANDARD_55E_LANGUAGES,
  getEligibleWeaponMasteryKinds,
} from "@/views/character-creator/constants/CharacterCreatorConstants";
import {
  getClassExpertiseChoices,
  getMaxSlotLevel,
  getSlotLevelTriggeredSpellChoicesUpToLevel,
  normalizeChoiceKey,
  parseSkillList,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  getGrowthChoiceDefinitions,
} from "@/views/character-creator/utils/GrowthChoiceUtils";
import {
  buildSelectedFeatSpellcastingAbilityChoices,
} from "@/views/character-creator/utils/FeatSpellcastingUtils";
import {
  buildSpellListChoiceEntry,
  buildResolvedSpellChoiceEntry,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import type { ParsedFeatDetailLike as BackgroundFeat } from "@/views/character-creator/utils/FeatChoiceTypes";
import type {
  BgDetail,
  ClassDetail,
  ClassSummary,
  CreatorResolvedSpellChoiceEntry,
  CreatorSpellListChoiceEntry,
  LevelUpFeatDetail,
  RaceDetail,
  SpellSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import { getStep5ChoiceState, getFeatChoiceOptionsForStep5 } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import {
  getWeaponMasteryChoice as getWeaponMasteryChoiceFromUtils,
  parseAppliedClassFeatureEffects,
} from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import { parseAppliedSpeciesTraitEffects } from "@/views/character-creator/utils/CharacterCreatorClassFeatureUtils";
import {
  deriveFeatGrantedAbilityBonuses,
  deriveTotalFeatAbilityBonuses,
  getClassFeatChoices,
  type FormState,
} from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { getClassLanguageChoice as getClassLanguageChoiceFromRules, getCoreLanguageChoice as getCoreLanguageChoiceFromRules } from "@/views/character/CharacterRuleParsers";
import { useCreatorChoiceData } from "@/views/character-creator/useCreatorChoiceData";

export function useCharacterCreatorDerivedState(args: {
  classes: ClassSummary[];
  featSummaries: Array<{ id: string; name: string }>;
  form: FormState;
  classDetail: ClassDetail | null;
  raceDetail: RaceDetail | null;
  bgDetail: BgDetail | null;
  resolvedRaceFeatDetail: BackgroundFeat | null;
  resolvedBgOriginFeatDetail: BackgroundFeat | null;
  classFeatDetails: Record<string, BackgroundFeat>;
  levelUpFeatDetails: LevelUpFeatDetail[];
  classCantrips: SpellSummary[];
  classInvocations: SpellSummary[];
}) {
  const {
    classes,
    featSummaries,
    form,
    classDetail,
    raceDetail,
    bgDetail,
    resolvedRaceFeatDetail,
    resolvedBgOriginFeatDetail,
    classFeatDetails,
    levelUpFeatDetails,
    classCantrips,
    classInvocations,
  } = args;

  const selectedClassSummary = React.useMemo(
    () => classes.find((c) => c.id === form.classId) ?? null,
    [classes, form.classId]
  );
  const selectedClassFeatDetails = React.useMemo(
    () => Object.entries(form.chosenClassFeatIds)
      .map(([featureName]) => classFeatDetails[featureName])
      .filter(Boolean),
    [form.chosenClassFeatIds, classFeatDetails]
  );
  const selectedClassFeatureEffects = React.useMemo(
    () => parseAppliedClassFeatureEffects(classDetail, form.level, form.subclass, form.chosenOptionals),
    [classDetail, form.level, form.subclass, form.chosenOptionals]
  );
  const selectedClassFeatureSpellChoices = React.useMemo(
    () => collectSpellChoicesFromEffects(selectedClassFeatureEffects)
      .filter((choice) => !/^(level\s+\d+:\s+)?(spellcasting|pact magic)\b/i.test(choice.source.name)),
    [selectedClassFeatureEffects]
  );
  const selectedRaceTraitEffects = React.useMemo(
    () => parseAppliedSpeciesTraitEffects(raceDetail),
    [raceDetail]
  );
  const selectedRaceTraitSpellChoices = React.useMemo(
    () => collectSpellChoicesFromEffects(selectedRaceTraitEffects),
    [selectedRaceTraitEffects]
  );
  const maxSpellLevel = React.useMemo(
    () => classDetail ? getMaxSlotLevel(classDetail, form.level, form.subclass) : 0,
    [classDetail, form.level, form.subclass]
  );
  const selectedClassFeatureProficiencyChoices = React.useMemo(
    () => collectProficiencyChoiceEffectsFromEffects(selectedClassFeatureEffects)
      .filter((choice) =>
        !choice.expertise
        && choice.choice?.count.kind === "fixed"
        && ["skill", "tool", "language", "saving_throw", "selection"].includes(choice.choice?.optionCategory ?? "")
        && (
          !choice.choice?.ifProficient
          || (classDetail?.proficiencies?.savingThrows ?? []).map(normalizeChoiceKey).includes(normalizeChoiceKey(choice.choice.ifProficient))
          || (form.chosenFeatureChoices[`classfeature:${choice.id}`]?.length ?? 0) > 0
        )
      ),
    [classDetail?.proficiencies?.savingThrows, form.chosenFeatureChoices, selectedClassFeatureEffects]
  );
  const selectedInvocationEffects = React.useMemo(
    () => classInvocations
      .filter((invocation) => form.chosenInvocations.includes(invocation.id) && String(invocation.text ?? "").trim())
      .map((invocation) => parseFeatureEffects({
        source: {
          id: `creator-invocation:${invocation.id}`,
          kind: "invocation",
          name: invocation.name,
          parentName: classDetail?.name ?? selectedClassSummary?.name ?? null,
          text: invocation.text ?? "",
        },
        text: invocation.text ?? "",
        classEffects: invocation.effects,
      } satisfies ParseFeatureEffectsInput)),
    [classDetail?.name, classInvocations, form.chosenInvocations, selectedClassSummary?.name]
  );
  const selectedInvocationSpellChoices = React.useMemo(
    () => collectSpellChoicesFromEffects(selectedInvocationEffects).map((choice) => {
      const invocationId = choice.source.id.replace(/^creator-invocation:/, "");
      const copies = Math.max(1, form.chosenInvocations.filter((id) => id === invocationId).length);
      return choice.count.kind === "fixed" ? { ...choice, count: { ...choice.count, value: choice.count.value * copies } } : choice;
    }),
    [form.chosenInvocations, selectedInvocationEffects]
  );
  const selectedFeatGrantedAbilityBonuses = React.useMemo(() => {
    return deriveFeatGrantedAbilityBonuses({
      bgOriginFeatDetail: resolvedBgOriginFeatDetail,
      raceFeatDetail: resolvedRaceFeatDetail,
      classFeatDetails,
      levelUpFeatDetails,
      chosenFeatOptions: form.chosenFeatOptions,
    });
  }, [resolvedBgOriginFeatDetail, resolvedRaceFeatDetail, classFeatDetails, form.chosenFeatOptions, levelUpFeatDetails]);
  const selectedFeatAbilityBonuses = React.useMemo(() => {
    return deriveTotalFeatAbilityBonuses(selectedFeatGrantedAbilityBonuses, form.chosenLevelUpFeats);
  }, [form.chosenLevelUpFeats, selectedFeatGrantedAbilityBonuses]);
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
    () => getClassFeatChoices(classDetail, form.level, featSummaries),
    [classDetail, form.level, featSummaries]
  );
  const step5ClassLanguageChoice = React.useMemo(
    () => getClassLanguageChoiceFromRules(classDetail, form.level, ALL_LANGUAGES),
    [classDetail, form.level]
  );
  const step5ClassExpertiseChoices = React.useMemo(
    // "replace" groups (e.g. Bardic Versatility) only make sense as a level-up swap of an
    // already-chosen skill; direct creation just picks the final held set, so they're a no-op here.
    () => getClassExpertiseChoices(classDetail, form.level).filter((choice) => !choice.replace),
    [classDetail, form.level]
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
  const step6FeatSpellListChoices = React.useMemo<CreatorSpellListChoiceEntry[]>(
    () => step5ChoiceState.allFeatChoices
      .filter(({ choice }) => choice.type === "spell_list")
      .map(({ featName, choice, key, sourceLabel }) => {
        const resolvedSourceLabel = sourceLabel ?? featName;
        const entry = buildSpellListChoiceEntry({
          key,
          choice: { ...choice, options: getFeatChoiceOptionsForStep5(choice) },
          level: form.level,
          sourceLabel: resolvedSourceLabel,
        });
        return {
          ...entry,
          title: "Spell List",
          note: entry.options.length === 1 && resolvedSourceLabel !== featName
            ? (choice.note ?? "Spell list fixed by this feat.")
            : choice.note,
        };
      }),
    [form.level, step5ChoiceState]
  );
  const step6FeatResolvedSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => step5ChoiceState.allFeatChoices
      .filter(({ choice }) => choice.type === "spell")
      .map(({ featName, choice, key, sourceLabel }) => {
        const resolvedSourceLabel = sourceLabel ?? featName;
        const linkedChoiceKey = choice.linkedTo ? key.replace(`:${choice.id}`, `:${choice.linkedTo}`) : null;
        return {
          ...buildResolvedSpellChoiceEntry({
            key,
            choice,
            level: form.level,
            sourceLabel: resolvedSourceLabel,
            chosenOptions: form.chosenFeatOptions,
            linkedChoiceKey,
          }),
        };
      }),
    [form.chosenFeatOptions, form.level, step5ChoiceState]
  );
  const step6ClassFeatureSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => selectedClassFeatureSpellChoices.flatMap((effect) => {
      if (effect.count.kind !== "fixed") return [];
      if (effect.ifKnown) {
        const known = classCantrips.some((spell) =>
          form.chosenCantrips.includes(spell.id)
          && spell.name.trim().toLowerCase() === effect.ifKnown!.trim().toLowerCase()
        );
        if (!known) return [];
      }
      return [{
        key: `classfeature:${effect.id}`,
        title: effect.level === 0 ? "Bonus Cantrip" : effect.level == null ? "Bonus Spell" : `Bonus Level ${effect.level} Spell`,
        sourceLabel: effect.source.name,
        count: effect.count.value,
        level: effect.level,
        maxLevel: effect.level === null && maxSpellLevel > 0 ? maxSpellLevel : null,
        note: effect.summary,
        listNames: effect.spellLists,
      }];
    }),
    [classCantrips, form.chosenCantrips, maxSpellLevel, selectedClassFeatureSpellChoices]
  );
  const step6RaceTraitSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => selectedRaceTraitSpellChoices.flatMap((effect) => {
      if (effect.count.kind !== "fixed") return [];
      return [{
        key: `racetrait:${effect.id}`,
        title: effect.level === 0 ? "Species Cantrip" : effect.level == null ? "Species Spell" : `Species Level ${effect.level} Spell`,
        sourceLabel: effect.source.name,
        count: effect.count.value,
        level: effect.level,
        note: effect.summary,
        listNames: effect.spellLists,
      }];
    }),
    [selectedRaceTraitSpellChoices]
  );
  const step6InvocationSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => selectedInvocationSpellChoices.flatMap((effect) => {
      if (effect.count.kind !== "fixed") return [];
      return [{
        key: `invocation:${effect.choiceId ?? effect.id}`,
        title: effect.level === 0 ? "Invocation Bonus Cantrip" : effect.level == null ? "Invocation Bonus Spell" : `Invocation Bonus Level ${effect.level} Spell`,
        sourceLabel: effect.source.name,
        count: effect.count.value,
        level: effect.level,
        note: effect.note ?? effect.summary,
        listNames: effect.spellLists,
        schools: effect.schools,
        ritualOnly: effect.filters?.ritual === true,
        damageOnly: effect.filters?.damage === true,
        attackOnly: effect.filters?.attack === true,
        allowedSpellIds: effect.filters?.known === true
          ? form.chosenCantrips
          : undefined,
        grantsSpell: effect.mode !== "select",
      }];
    }),
    [form.chosenCantrips, selectedInvocationSpellChoices]
  );
  const step6SlotGrowthSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => getSlotLevelTriggeredSpellChoicesUpToLevel(
      classDetail,
      form.level,
      form.subclass || null,
    ).map((choice) => ({
      key: `creator:${choice.key}`,
      title: choice.title,
      sourceLabel: choice.sourceLabel,
      count: choice.count,
      level: choice.level,
      note: choice.note ?? null,
      listNames: choice.listNames,
      schools: choice.schools,
      ritualOnly: false,
    })),
    [classDetail, form.level, form.subclass]
  );
  const step6SpellListChoices = step6FeatSpellListChoices;
  const step6ResolvedSpellChoices = React.useMemo(
    () => [
      ...step6FeatResolvedSpellChoices,
      ...step6ClassFeatureSpellChoices,
      ...step6RaceTraitSpellChoices,
      ...step6InvocationSpellChoices,
      ...step6SlotGrowthSpellChoices,
    ],
    [step6ClassFeatureSpellChoices, step6FeatResolvedSpellChoices, step6InvocationSpellChoices, step6RaceTraitSpellChoices, step6SlotGrowthSpellChoices]
  );
  const selectedFeatSpellcastingAbilityChoices = React.useMemo(
    () => buildSelectedFeatSpellcastingAbilityChoices({
      selectedChoices: form.chosenFeatOptions,
      bgOriginFeatDetail: resolvedBgOriginFeatDetail,
      raceFeatDetail: resolvedRaceFeatDetail,
      classFeatDetails,
      levelUpFeatDetails,
    }),
    [classFeatDetails, form.chosenFeatOptions, levelUpFeatDetails, resolvedBgOriginFeatDetail, resolvedRaceFeatDetail]
  );
  const growthChoiceDefinitions = React.useMemo(
    () => getGrowthChoiceDefinitions({
      classId: form.classId,
      className: classDetail?.name ?? selectedClassSummary?.name ?? null,
      classDetail,
      level: form.level,
      selectedSubclass: form.subclass ?? null,
    }),
    [classDetail, form.classId, form.level, form.subclass, selectedClassSummary?.name]
  );
  const { featSpellChoiceOptions, growthOptionEntriesByKey, items } = useCreatorChoiceData({
    step6ResolvedSpellChoices,
    growthChoiceDefinitions,
  });
  const preparedSpellProgressionChoiceDefinitions = React.useMemo(
    () => buildPreparedSpellProgressionChoiceDefinitions(buildAppliedCharacterFeatures({
      charData: {
        classes: form.classId || selectedClassSummary?.name ? [{
          id: `class_${form.classId || "primary"}`,
          classId: form.classId || null,
          className: selectedClassSummary?.name ?? null,
          level: form.level,
          subclass: form.subclass || null,
        }] : [],
        chosenOptionals: form.chosenOptionals,
      },
      characterLevel: form.level,
      classDetail,
      raceDetail,
      backgroundDetail: bgDetail,
      bgOriginFeatDetail: resolvedBgOriginFeatDetail,
      raceFeatDetail: resolvedRaceFeatDetail,
      classFeatDetails: Object.entries(form.chosenClassFeatIds)
        .map(([featureName]) => classFeatDetails[featureName])
        .filter(Boolean),
      levelUpFeatDetails,
      invocationDetails: [],
    })),
    [bgDetail, resolvedBgOriginFeatDetail, classDetail, classFeatDetails, form.chosenClassFeatIds, form.chosenOptionals, form.level, form.subclass, levelUpFeatDetails, raceDetail, resolvedRaceFeatDetail, selectedClassSummary?.name, form.classId]
  );
  const levelUpFeatLevels = React.useMemo(
    () => Array.from(new Set((classDetail?.autolevels ?? [])
      .filter((al) => al.scoreImprovement && al.level != null && al.level <= form.level)
      .map((al) => al.level)))
      .sort((a, b) => a - b),
    [classDetail, form.level]
  );
  const availableLevelUpFeats = React.useMemo(
    () => featSummaries.filter((feat) => form.ruleset !== "5.5e" || form.level >= 19 || !/^boon of\b/i.test(feat.name)),
    [featSummaries, form.level, form.ruleset]
  );
  const levelUpFeatConflict = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of form.chosenLevelUpFeats) {
      if (!entry?.featId) continue;
      counts.set(entry.featId, (counts.get(entry.featId) ?? 0) + 1);
    }
    for (const [featId, count] of counts.entries()) {
      if (count < 2) continue;
      const detail = levelUpFeatDetails.find((entry) => entry.featId === featId)?.feat;
      if (!detail?.parsed.repeatable) return `Duplicate feat selected: ${featId}`;
    }
    return null;
  }, [form.chosenLevelUpFeats, levelUpFeatDetails]);

  const eligibleInvocationIds = React.useMemo(() => {
    const selectedCantrips = classCantrips.filter((spell) => form.chosenCantrips.includes(spell.id));
    const hasDamageCantrip = selectedCantrips.some(spellLooksLikeDamageSpell);
    const hasAttackDamageCantrip = selectedCantrips.some((spell) =>
      spellLooksLikeDamageSpell(spell)
      && spell.check === "attack"
    );

    const chosenPactBoon = resolvePactBoonFromChosenOptionals(form.chosenOptionals);

    return new Set(
      classInvocations
        .filter((invocation) =>
          invocationPrerequisitesMet(invocation.prerequisite, {
            level: form.level,
            hasDamageCantrip,
            hasAttackDamageCantrip,
            chosenTalentIds: form.chosenInvocations,
            chosenPactBoon,
          })
        )
        .map((invocation) => invocation.id)
    );
  }, [classCantrips, classInvocations, form.chosenCantrips, form.chosenInvocations, form.chosenOptionals, form.level]);

  return {
    selectedClassSummary,
    selectedClassFeatDetails,
    selectedClassFeatureProficiencyChoices,
    selectedFeatGrantedAbilityBonuses,
    selectedFeatAbilityBonuses,
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
    step6SpellListChoices,
    step6ResolvedSpellChoices,
    selectedFeatSpellcastingAbilityChoices,
    growthChoiceDefinitions,
    featSpellChoiceOptions,
    growthOptionEntriesByKey,
    items,
    preparedSpellProgressionChoiceDefinitions,
    levelUpFeatLevels,
    availableLevelUpFeats,
    levelUpFeatConflict,
    eligibleInvocationIds,
  };
}
