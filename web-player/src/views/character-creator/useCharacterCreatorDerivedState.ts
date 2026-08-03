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
import type { SpellChoiceEffect } from "@/domain/character/featureEffects";
import { buildAppliedCharacterFeatures, buildPreparedSpellProgressionChoiceDefinitions } from "@/domain/character/characterFeatures";
import {
  getMaxSlotLevel,
  getSlotLevelTriggeredSpellChoicesUpToLevel,
  normalizeChoiceKey,
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
import { getFeatChoiceOptionsForStep5 } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import { parseAppliedClassFeatureEffects } from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import { parseAppliedSpeciesTraitEffects } from "@/views/character-creator/utils/CharacterCreatorClassFeatureUtils";
import {
  deriveFeatGrantedAbilityBonuses,
  deriveTotalFeatAbilityBonuses,
  type FormState,
} from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { useCreatorChoiceData } from "@/views/character-creator/useCreatorChoiceData";
import { useCreatorProficiencyChoices } from "@/views/character-creator/useCreatorProficiencyChoices";

/**
 * Assembles a `CreatorResolvedSpellChoiceEntry[]` from a list of fixed-count spell-choice effects,
 * shared by the class-feature/race-trait/invocation sources (the 3 of creator's 5 spell-choice
 * sources whose per-entry construction is genuinely identical apart from the options below). The
 * other 2 sources (feat choices, slot-growth choices) already delegate to their own shared
 * utilities and don't fit this shape -- they're left as-is.
 */
export function buildFixedCountSpellChoiceEntries(
  effects: SpellChoiceEffect[],
  opts: {
    keyPrefix: string;
    resolveKeyId: (effect: SpellChoiceEffect) => string;
    /** Produces "<word> Cantrip" / "<word> Spell" / "<word> Level N Spell" from this word. */
    titleWord: string;
    /** Only the class-feature source filters by whether the referenced spell/cantrip is already known. */
    ifKnownPool?: { classCantrips: SpellSummary[]; chosenCantripIds: string[] };
    /** Only the class-feature source caps unleveled choices to the class's max slot level. */
    maxSpellLevel?: number;
    noteFrom?: (effect: SpellChoiceEffect) => string | undefined;
    /** Only the invocation source carries these (schools/ritual/damage/attack/allowedSpellIds/grantsSpell). */
    extraFields?: (effect: SpellChoiceEffect) => Partial<CreatorResolvedSpellChoiceEntry>;
  },
): CreatorResolvedSpellChoiceEntry[] {
  return effects.flatMap((effect) => {
    if (effect.count.kind !== "fixed") return [];
    if (opts.ifKnownPool && effect.ifKnown) {
      const known = opts.ifKnownPool.classCantrips.some((spell) =>
        opts.ifKnownPool!.chosenCantripIds.includes(spell.id)
        && spell.name.trim().toLowerCase() === effect.ifKnown!.trim().toLowerCase()
      );
      if (!known) return [];
    }
    return [{
      // Canonical key: `<prefix>:<compendium choice id>`. The class-feature prefix in particular
      // must match the level-up wizard and MysticArcanumRevisitUtils exactly (not be namespaced
      // any further) -- a pick made through any of those flows must be visible to the others
      // instead of being invisible under a different key.
      key: `${opts.keyPrefix}:${opts.resolveKeyId(effect)}`,
      title: effect.level === 0
        ? `${opts.titleWord} Cantrip`
        : effect.level == null
          ? `${opts.titleWord} Spell`
          : `${opts.titleWord} Level ${effect.level} Spell`,
      sourceLabel: effect.source.name,
      count: effect.count.value,
      level: effect.level,
      ...(opts.maxSpellLevel !== undefined
        ? { maxLevel: effect.level === null && opts.maxSpellLevel > 0 ? opts.maxSpellLevel : null }
        : {}),
      note: opts.noteFrom ? opts.noteFrom(effect) : effect.summary,
      listNames: effect.spellLists,
      ...(opts.extraFields ? opts.extraFields(effect) : {}),
    }];
  });
}

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
  const selectedClassFeatureEffects = React.useMemo(
    () => parseAppliedClassFeatureEffects(classDetail, form.level, form.subclass, form.chosenOptionals),
    [classDetail, form.level, form.subclass, form.chosenOptionals]
  );
  const selectedClassFeatureSpellChoices = React.useMemo(
    () => collectSpellChoicesFromEffects(selectedClassFeatureEffects)
      .filter((choice) => !/^(level\s+\d+:\s+)?(spellcasting|pact magic)\b/i.test(choice.source.name))
      // Replacement cantrips (Eldritch/Cantrip/Bardic/Sorcerous Versatility) are handled by
      // freely re-picking from the main cantrip list, not by an additive picker here — rendering
      // them here would incorrectly grant an extra cantrip beyond the class's known-cantrip count.
      .filter((choice) => !(choice.canReplace && choice.level === 0 && choice.mode === "learn")),
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
          || (form.chosenFeatureChoices[`classfeature:${choice.choiceId ?? choice.id}`]?.length ?? 0) > 0
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

  const {
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
  } = useCreatorProficiencyChoices({
    form,
    classDetail,
    raceDetail,
    bgDetail,
    resolvedRaceFeatDetail,
    resolvedBgOriginFeatDetail,
    classFeatDetails,
    levelUpFeatDetails,
    featSummaries,
  });

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
    () => buildFixedCountSpellChoiceEntries(selectedClassFeatureSpellChoices, {
      keyPrefix: "classfeature",
      resolveKeyId: (effect) => effect.choiceId ?? effect.id,
      titleWord: "Bonus",
      ifKnownPool: { classCantrips, chosenCantripIds: form.chosenCantrips },
      maxSpellLevel,
    }),
    [classCantrips, form.chosenCantrips, maxSpellLevel, selectedClassFeatureSpellChoices]
  );
  const step6RaceTraitSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => buildFixedCountSpellChoiceEntries(selectedRaceTraitSpellChoices, {
      keyPrefix: "racetrait",
      // Race traits have no `choiceId` fallback -- unlike class-feature/invocation, this source
      // never used one, and adding one now would silently rename every existing race-trait key.
      resolveKeyId: (effect) => effect.id,
      titleWord: "Species",
    }),
    [selectedRaceTraitSpellChoices]
  );
  const step6InvocationSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => buildFixedCountSpellChoiceEntries(selectedInvocationSpellChoices, {
      keyPrefix: "invocation",
      resolveKeyId: (effect) => effect.choiceId ?? effect.id,
      titleWord: "Invocation Bonus",
      noteFrom: (effect) => effect.note ?? effect.summary,
      extraFields: (effect) => ({
        schools: effect.schools,
        ritualOnly: effect.filters?.ritual === true,
        damageOnly: effect.filters?.damage === true,
        attackOnly: effect.filters?.attack === true,
        allowedSpellIds: effect.filters?.known === true ? form.chosenCantrips : undefined,
        grantsSpell: effect.mode !== "select",
      }),
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
    ruleset: form.ruleset,
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
