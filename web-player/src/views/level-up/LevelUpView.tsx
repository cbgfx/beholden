import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { fetchMyCharacter } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { rollDiceExpr } from "@/lib/dice";
import { collectProficiencyChoiceEffectsFromEffects, collectSpellChoicesFromEffects, parseFeatureEffects } from "@/domain/character/parseFeatureEffects";
import { buildPreparedSpellProgressionChoiceDefinitions, buildPreparedSpellProgressionGrants } from "@/domain/character/characterFeatures";
import { abilityMod, normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import {
  getCantripCount,
  getClassExpertiseChoices,
  getClassFeatureTable,
  getFeatChoiceOptions,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSlotLevelTriggeredSpellChoices,
  getSubclassLevel,
  getSubclassList,
  featureMatchesSubclass,
  isSubclassChoiceFeature,
  isSpellcaster,
  tableValueAtLevel,
  normalizeChoiceKey,
  usesFlexiblePreparedSpells,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  getGrowthChoiceDefinitions,
  getGrowthChoiceSelectedAbility,
  sanitizeGrowthChoiceSelections,
} from "@/views/character-creator/utils/GrowthChoiceUtils";
import {
  buildResolvedSpellChoiceEntry,
  buildSpellListChoiceEntry,
  resolveSelectedSpellOptionEntries,
  sanitizeSpellChoiceSelections,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import { getFeatSpellcastingAbilityChoice } from "@/views/character-creator/utils/FeatSpellcastingUtils";
import type {
  AsiMode,
  HpChoice,
  LevelUpCharacter as Character,
  LevelUpClassDetail as ClassDetail,
  LevelUpFeatDetail as FeatDetail,
  LevelUpFeatSummary as FeatSummary,
  LevelUpResolvedSpellChoiceEntry,
  LevelUpSpellListChoiceEntry,
  LevelUpSpellSummary as SpellSummary,
} from "@/views/level-up/LevelUpTypes";
import { AsiAbilityGrid, BackBtn, ChoiceBtn, ExpertiseSelectionSection, FeatSelectionSection, LevelUpHpSection, Section, Wrap } from "@/views/level-up/LevelUpParts";
import { LevelUpChoicesSection, LevelUpFeaturesSection, LevelUpSpellSlotsSection, LevelUpSubclassSection } from "@/views/level-up/LevelUpSections";
import { buildLevelUpPayload, deriveAllowedInvocationIds, deriveFeatAbilityBonuses, deriveHpGain, deriveLevelUpValidation, derivePreviewScores } from "@/views/level-up/LevelUpUtils";
import { deriveCharProficiencies, hasKeys, reconcileSelectedSpellIds, sameSelectionMap, stripRulesetSuffix } from "@/views/level-up/LevelUpHelpers";
import { isToughFeat } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { useLevelUpInitialData } from "@/views/level-up/useLevelUpInitialData";
import { useLevelUpChoiceData } from "@/views/level-up/useLevelUpChoiceData";
import { useLevelUpDerivedState } from "@/views/level-up/useLevelUpDerivedState";

export function LevelUpView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    char,
    classDetail,
    loading,
    error,
    setError,
    nextLevel,
    mergedAutolevels,
    primaryClassEntry,
    subclass,
    setSubclass,
    chosenCantrips,
    setChosenCantrips,
    chosenSpells,
    setChosenSpells,
    chosenInvocations,
    setChosenInvocations,
    chosenExpertise,
    setChosenExpertise,
    chosenFeatureChoices,
    setChosenFeatureChoices,
    featSummaries,
    chosenFeatId,
    setChosenFeatId,
    chosenFeatDetail,
    classCantrips,
    classSpells,
    classInvocations,
  } = useLevelUpInitialData(id);

  const [saving, setSaving] = useState(false);

  // HP
  const [hpChoice, setHpChoice] = useState<HpChoice>(null);
  const [rolledHp, setRolledHp] = useState<number | null>(null);
  const [manualHp, setManualHp] = useState<string>("");

  // ASI
  const [asiMode, setAsiMode] = useState<AsiMode>(null);
  const [asiStats, setAsiStats] = useState<Record<string, number>>({});

  // Feature expand
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
  const [featSearch, setFeatSearch] = useState("");
  const [chosenFeatOptions, setChosenFeatOptions] = useState<Record<string, string[]>>({});

  const {
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
  } = useLevelUpDerivedState({
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
  });

  useEffect(() => {
    setChosenCantrips((prev) => {
      const next = reconcileSelectedSpellIds(prev, classCantrips, existingClassSpellNames).slice(0, cantripCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classCantrips, cantripCount, existingClassSpellNames]);

  useEffect(() => {
    if (maxSpellLevel === 0) return;
    setChosenSpells((prev) => {
      const next = reconcileSelectedSpellIds(prev, classSpells, existingClassSpellNames)
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell) && spellLevel > 0 && spellLevel <= maxSpellLevel;
        })
        .slice(0, prepCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classSpells, existingClassSpellNames, maxSpellLevel, prepCount]);

  useEffect(() => {
    setChosenInvocations((prev) => {
      const next = reconcileSelectedSpellIds(prev, classInvocations, existingClassInvocationNames)
        .filter((id) => allowedInvocationIds.has(id))
        .slice(0, invocCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [allowedInvocationIds, classInvocations, existingClassInvocationNames, invocCount]);

  useEffect(() => {
    if (expertiseChoices.length === 0) return;
    setChosenExpertise((prev) => {
      let changed = false;
      const next: Record<string, string[]> = { ...prev };
      const taken = new Set(existingExpertise.map((name) => normalizeChoiceKey(name)));
      const proficientSkillKeys = new Set(proficientSkills.map((skill) => normalizeChoiceKey(skill)));
      const existingExpertiseEntries = Array.isArray(char?.characterData?.proficiencies?.expertise)
        ? char.characterData.proficiencies.expertise
        : [];
      for (const choice of expertiseChoices) {
        const options = (choice.options ?? proficientSkills).filter((skill) => proficientSkillKeys.has(normalizeChoiceKey(skill)));
        const current = prev[choice.key] ?? [];
        const seededCurrent = current.length > 0
          ? current
          : existingExpertiseEntries
            .filter((entry) => typeof entry !== "string" && entry?.source === choice.source)
            .map((entry) => entry.name)
            .filter((skill) => options.some((option) => normalizeChoiceKey(option) === normalizeChoiceKey(skill)))
            .slice(0, choice.count);
        const filtered = current
          .filter((skill) => options.some((option) => normalizeChoiceKey(option) === normalizeChoiceKey(skill)))
          .filter((skill) => !taken.has(normalizeChoiceKey(skill)))
          .slice(0, choice.count);
        const finalSelection = filtered.length > 0 ? filtered : seededCurrent;
        finalSelection.forEach((skill) => taken.add(normalizeChoiceKey(skill)));
        if (finalSelection.length === 0) delete next[choice.key];
        else next[choice.key] = finalSelection;
        if (finalSelection.length !== current.length || finalSelection.some((skill, index) => skill !== current[index])) changed = true;
      }
      return changed ? next : prev;
    });
  }, [char?.characterData?.proficiencies?.expertise, expertiseChoices, proficientSkills, existingExpertise]);

  useEffect(() => {
    if (!chosenFeatDetail) {
      setChosenFeatOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
  }, [chosenFeatDetail]);

  const featChoiceOptionsByKey = React.useMemo(() => {
    const entries: Array<[string, string[]]> = [];
    for (const choice of featChoiceEntries) {
      const key = `levelupfeat:${nextLevel}:${chosenFeatDetail?.id ?? ""}:${choice.id}`;
      if (choice.type === "spell") {
        const spellOptions = featSpellChoiceOptions[key] ?? [];
        const resolved = spellOptions.length > 0
          ? spellOptions.map((spell) => spell.name)
          : getFeatChoiceOptions(choice);
        entries.push([key, resolved]);
      } else {
        entries.push([key, getFeatChoiceOptions(choice)]);
      }
    }
    return Object.fromEntries(entries);
  }, [chosenFeatDetail?.id, featChoiceEntries, featSpellChoiceOptions, nextLevel]);

  useEffect(() => {
    if (!chosenFeatDetail) return;
    setChosenFeatOptions((prev) => {
      const next = { ...prev };
      for (const choice of chosenFeatDetail.parsed.choices) {
        const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
        if (choice.type === "spell" || choice.type === "spell_list") continue;
        const options = featChoiceOptionsByKey[key] ?? [];
        const filtered = (prev[key] ?? [])
          .filter((value) => options.includes(value))
          .slice(0, choice.count);
        if (filtered.length === 0) delete next[key];
        else next[key] = filtered;
      }
      const sanitized = sanitizeSpellChoiceSelections({
        currentSelections: next,
        spellListChoices: featSpellListChoices,
        resolvedSpellChoices: featResolvedSpellChoices,
        spellOptionsByKey: featSpellChoiceOptions,
      });
      return sameSelectionMap(prev, sanitized) ? prev : sanitized;
    });
  }, [chosenFeatDetail, featChoiceEntries, featChoiceOptionsByKey, featResolvedSpellChoices, featSpellChoiceOptions, featSpellListChoices, nextLevel]);

  useEffect(() => {
    setChosenFeatOptions((prev) => {
      const sanitized = sanitizeSpellChoiceSelections({
        currentSelections: prev,
        spellListChoices: [],
        resolvedSpellChoices: [...classFeatureResolvedSpellChoices, ...invocationResolvedSpellChoices],
        spellOptionsByKey: {
          ...classFeatureSpellChoiceOptions,
          ...invocationSpellChoiceOptions,
        },
      });
      return sameSelectionMap(prev, sanitized) ? prev : sanitized;
    });
  }, [classFeatureResolvedSpellChoices, classFeatureSpellChoiceOptions, invocationResolvedSpellChoices, invocationSpellChoiceOptions]);

  useEffect(() => {
    setChosenFeatureChoices((prev) => {
      const sanitized = sanitizeGrowthChoiceSelections({
        definitions: growthChoiceDefinitions,
        currentSelections: prev,
        optionEntriesByKey: growthOptionEntriesByKey,
      });
      return sameSelectionMap(prev, sanitized) ? prev : sanitized;
    });
  }, [growthChoiceDefinitions, growthOptionEntriesByKey]);

  useEffect(() => {
    setChosenFeatureChoices((prev) => {
      const next = { ...prev };
      const validKeys = new Set(preparedSpellProgressionChoiceDefinitions.map((definition) => definition.key));
      for (const definition of preparedSpellProgressionChoiceDefinitions) {
        const filtered = (next[definition.key] ?? [])
          .filter((value) => definition.options.includes(value))
          .slice(0, 1);
        if (filtered.length > 0) next[definition.key] = filtered;
        else delete next[definition.key];
      }
      for (const key of Object.keys(next)) {
        if (key.includes(":prepared-spell-progression:") && !validKeys.has(key)) delete next[key];
      }
      return sameSelectionMap(prev, next) ? prev : next;
    });
  }, [preparedSpellProgressionChoiceDefinitions]);

  const hpGain = deriveHpGain(hpChoice, hpAverage, rolledHp, manualHp);
  const featAbilityBonuses = React.useMemo(
    () => deriveFeatAbilityBonuses({ chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel }),
    [chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel]
  );
  const featHpBonus = asiMode === "feat" && isToughFeat(chosenFeatDetail?.name) ? nextLevel * 2 : 0;

  // Current scores + ASI deltas
  const baseScores: Record<string, number> = {
    str: char?.strScore ?? 10, dex: char?.dexScore ?? 10, con: char?.conScore ?? 10,
    int: char?.intScore ?? 10, wis: char?.wisScore ?? 10, cha: char?.chaScore ?? 10,
  };
  const previewScores = React.useMemo(
    () => derivePreviewScores({ baseScores, asiStats, asiMode, featAbilityBonuses }),
    [baseScores, asiStats, asiMode, featAbilityBonuses]
  );
  const lockedCantripSelectionIds = React.useMemo(
    () =>
      reconcileSelectedSpellIds(char?.characterData?.chosenCantrips ?? [], classCantrips, existingClassSpellNames)
        .filter((id) => {
          const spell = classCantrips.find((entry) => entry.id === id);
          return spell ? !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)) : false;
        })
        .slice(0, cantripCount),
    [char?.characterData?.chosenCantrips, cantripCount, classCantrips, existingClassSpellNames, preparedSpellProgressionGrantedKeys]
  );
  const lockedCantripIds = React.useMemo(
    () => new Set(lockedCantripSelectionIds),
    [lockedCantripSelectionIds]
  );
  const lockedSpellSelectionIds = React.useMemo(
    () =>
      reconcileSelectedSpellIds(char?.characterData?.chosenSpells ?? [], classSpells, existingClassSpellNames)
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell)
            && spellLevel > 0
            && spellLevel <= maxSpellLevel
            && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell!.name));
        })
        .slice(0, prepCount),
    [char?.characterData?.chosenSpells, classSpells, existingClassSpellNames, maxSpellLevel, prepCount, preparedSpellProgressionGrantedKeys]
  );
  const lockedSpellIds = React.useMemo(
    () => new Set(lockedSpellSelectionIds),
    [lockedSpellSelectionIds]
  );
  const lockedInvocationSelectionIds = React.useMemo(
    () =>
      reconcileSelectedSpellIds(char?.characterData?.chosenInvocations ?? [], classInvocations, existingClassInvocationNames)
        .filter((id) => allowedInvocationIds.has(id))
        .slice(0, invocCount),
    [allowedInvocationIds, char?.characterData?.chosenInvocations, classInvocations, existingClassInvocationNames, invocCount]
  );
  const lockedInvocationIds = React.useMemo(
    () => new Set(lockedInvocationSelectionIds),
    [lockedInvocationSelectionIds]
  );
  const maneuverChoiceEntries = React.useMemo(
    () => growthChoiceDefinitions
      .filter((definition) => definition.category === "maneuver")
      .map((definition) => {
        const existingCount = Array.isArray(char?.characterData?.chosenFeatureChoices?.[definition.key])
          ? (char?.characterData?.chosenFeatureChoices?.[definition.key] ?? []).length
          : 0;
        const chosenEntries = resolveSelectedSpellOptionEntries(
          chosenFeatureChoices[definition.key] ?? [],
          growthOptionEntriesByKey[definition.key] ?? []
        );
        return {
          definition,
          remainingCount: Math.max(0, definition.totalCount - existingCount),
          chosen: chosenEntries.map((spell) => String(spell.id)),
          chosenEntries,
          selectedAbility: getGrowthChoiceSelectedAbility(chosenFeatureChoices, definition),
        };
      })
      .filter((entry) => entry.remainingCount > 0),
    [char?.characterData?.chosenFeatureChoices, chosenFeatureChoices, growthChoiceDefinitions, growthOptionEntriesByKey]
  );
  const planChoiceEntries = React.useMemo(
    () => growthChoiceDefinitions
      .filter((definition) => definition.category === "plan")
      .map((definition) => {
        const existingCount = Array.isArray(char?.characterData?.chosenFeatureChoices?.[definition.key])
          ? (char?.characterData?.chosenFeatureChoices?.[definition.key] ?? []).length
          : 0;
        return {
          definition,
          remainingCount: Math.max(0, definition.totalCount - existingCount),
          chosen: (chosenFeatureChoices[definition.key] ?? []).map(String),
          disabledIds: growthChoiceDefinitions
            .filter((other) => other.category === "plan" && other.key !== definition.key)
            .flatMap((other) => [
              ...(((char?.characterData?.chosenFeatureChoices?.[other.key] ?? []) as string[]).map(String)),
              ...((chosenFeatureChoices[other.key] ?? []).map(String)),
            ]),
        };
      })
      .filter((entry) => entry.remainingCount > 0 || entry.chosen.length > 0),
    [char?.characterData?.chosenFeatureChoices, chosenFeatureChoices, growthChoiceDefinitions]
  );
  const progressionTableChoiceEntries = React.useMemo(
    () => preparedSpellProgressionChoiceDefinitions.map((definition) => ({
      definition,
      chosen: chosenFeatureChoices[definition.key] ?? [],
    })),
    [chosenFeatureChoices, preparedSpellProgressionChoiceDefinitions]
  );
  const extraFeatSpellSelectionsValid = React.useMemo(
    () =>
      featSpellListChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && featResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && classFeatureResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && classFeatureProficiencyChoices.every((choice) => (chosenFeatureChoices[choice.key] ?? []).length === choice.count)
      && invocationResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && maneuverChoiceEntries.every((entry) => entry.chosen.length === entry.definition.totalCount)
      && planChoiceEntries.every((entry) => entry.chosen.length === entry.definition.totalCount)
      && maneuverChoiceEntries.every((entry) => !entry.definition.abilityChoice || entry.selectedAbility !== null)
      && progressionTableChoiceEntries.every((entry) => entry.chosen.length === 1),
    [chosenFeatOptions, chosenFeatureChoices, classFeatureProficiencyChoices, classFeatureResolvedSpellChoices, featResolvedSpellChoices, featSpellListChoices, invocationResolvedSpellChoices, maneuverChoiceEntries, planChoiceEntries, progressionTableChoiceEntries]
  );

  const cantripChoiceCount = Math.max(0, cantripCount - lockedCantripIds.size);
  const spellChoiceCount = Math.max(0, prepCount - lockedSpellIds.size);
  const invocationChoiceCount = Math.max(0, invocCount - lockedInvocationIds.size);
  const displayedChosenCantrips = chosenCantrips.filter((id) => {
    if (lockedCantripIds.has(id)) return false;
    const spell = classCantrips.find((entry) => entry.id === id);
    return spell ? !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)) : true;
  });
  const displayedChosenSpells = chosenSpells.filter((id) => {
    if (lockedSpellIds.has(id)) return false;
    const spell = classSpells.find((entry) => entry.id === id);
    return spell ? !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)) : true;
  });
  const displayedChosenInvocations = chosenInvocations.filter((id) => !lockedInvocationIds.has(id));
  const effectiveChosenCantrips = React.useMemo(
    () => [...lockedCantripSelectionIds, ...displayedChosenCantrips],
    [displayedChosenCantrips, lockedCantripSelectionIds]
  );
  const effectiveChosenSpells = React.useMemo(
    () => [...lockedSpellSelectionIds, ...displayedChosenSpells],
    [displayedChosenSpells, lockedSpellSelectionIds]
  );
  const effectiveChosenInvocations = React.useMemo(
    () => [...lockedInvocationSelectionIds, ...displayedChosenInvocations],
    [displayedChosenInvocations, lockedInvocationSelectionIds]
  );
  const selectedFeatResolvedSpellIds = React.useMemo(
    () =>
      featResolvedSpellChoices.flatMap((choice) =>
        resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          featSpellChoiceOptions[choice.key] ?? [],
        ).map((spell) => String(spell.id))
      ),
    [chosenFeatOptions, featResolvedSpellChoices, featSpellChoiceOptions]
  );
  const selectedClassFeatureResolvedSpellIds = React.useMemo(
    () =>
      classFeatureResolvedSpellChoices.flatMap((choice) =>
        resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          classFeatureSpellChoiceOptions[choice.key] ?? [],
        ).map((spell) => String(spell.id))
      ),
    [chosenFeatOptions, classFeatureResolvedSpellChoices, classFeatureSpellChoiceOptions]
  );
  const selectedInvocationResolvedSpellIds = React.useMemo(
    () =>
      invocationResolvedSpellChoices.flatMap((choice) =>
        resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          invocationSpellChoiceOptions[choice.key] ?? [],
        ).map((spell) => String(spell.id))
      ),
    [chosenFeatOptions, invocationResolvedSpellChoices, invocationSpellChoiceOptions]
  );
  const globallyChosenSpellChoiceIds = React.useMemo(
    () => new Set([
      ...displayedChosenCantrips,
      ...displayedChosenSpells,
      ...displayedChosenInvocations,
      ...selectedFeatResolvedSpellIds,
      ...selectedClassFeatureResolvedSpellIds,
      ...selectedInvocationResolvedSpellIds,
    ]),
    [
      displayedChosenCantrips,
      displayedChosenInvocations,
      displayedChosenSpells,
      selectedClassFeatureResolvedSpellIds,
      selectedFeatResolvedSpellIds,
      selectedInvocationResolvedSpellIds,
    ]
  );

  const { filteredFeatSummaries, featPrereqsMet, featRepeatableValid, asiTotal, canConfirm } = React.useMemo(
    () =>
      deriveLevelUpValidation({
        isAsiLevel,
        asiMode,
        asiStats,
        needsSubclassChoice,
        subclass,
        cantripCount,
        chosenCantrips: effectiveChosenCantrips,
        spellcaster,
        prepCount,
        chosenSpells: effectiveChosenSpells,
        invocCount,
        chosenInvocations: effectiveChosenInvocations,
        expertiseChoices,
        chosenExpertise,
        chosenFeatDetail,
        featChoiceEntries,
        chosenFeatOptions,
        nextLevel,
        className: classDetail?.name ?? char?.className,
        level: nextLevel,
        scores: baseScores,
        prof: charProficiencies,
        featSearch,
        featSummaries,
        hpGain,
        existingLevelUpFeats: char?.characterData?.chosenLevelUpFeats ?? [],
      }),
    [
      isAsiLevel,
      asiMode,
      asiStats,
      needsSubclassChoice,
      subclass,
      cantripCount,
      effectiveChosenCantrips,
      spellcaster,
      prepCount,
      effectiveChosenSpells,
      invocCount,
      effectiveChosenInvocations,
      expertiseChoices,
      chosenExpertise,
      chosenFeatDetail,
      featChoiceEntries,
      chosenFeatOptions,
      nextLevel,
      classDetail?.name,
      char?.className,
      char?.characterData?.proficiencies,
      featSearch,
      featSummaries,
      hpGain,
    ]
  );

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;
  if (nextLevel > 20) {
    return (
      <Wrap>
        <p style={{ color: C.muted }}>Already at max level (20).</p>
        <BackBtn onClick={() => navigate(`/characters/${char.id}`)} />
      </Wrap>
    );
  }

  const availableCantripChoices = classCantrips.filter((spell) =>
    !lockedCantripIds.has(spell.id)
    && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name))
  );
  const availableSpellChoices = classSpells.filter((spell) =>
    !lockedSpellIds.has(spell.id)
    && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name))
    && Number(spell.level ?? 0) > 0
    && Number(spell.level ?? 0) <= maxSpellLevel
  );
  const availableInvocationChoices = classInvocations.filter(
    (invocation) => !lockedInvocationIds.has(invocation.id) && allowedInvocationIds.has(invocation.id)
  );

  function rollHp() {
    const rolled = rollDiceExpr(`1d${hd}`);
    const total = Math.max(1, rolled + conMod);
    setRolledHp(total);
    setHpChoice("roll");
  }

  function toggleAsiPoint(key: string) {
    if (!asiMode || asiMode === "feat") return;
    setAsiStats((prev) => {
      const current = prev[key] ?? 0;
      const totalAssigned = Object.values(prev).reduce((sum, value) => sum + value, 0);
      const next = { ...prev };
      if (current >= 2) {
        next[key] = current - 1;
      } else if (current > 0 && totalAssigned >= 2) {
        if (current === 1) delete next[key];
        else next[key] = current - 1;
      } else if (totalAssigned < 2) {
        next[key] = current + 1;
      }
      return next;
    });
  }

  function clearAsi() {
    setAsiStats({});
    setAsiMode(null);
  }

  function toggleSelection(id: string, chosen: string[], setChosen: React.Dispatch<React.SetStateAction<string[]>>, max: number) {
    setChosen((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((entry) => entry !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  }

  async function confirm() {
    if (!char || !canConfirm || !extraFeatSpellSelectionsValid) return;
    setSaving(true);
    try {
      const selectedCantripEntries = classCantrips
        .filter((spell) => effectiveChosenCantrips.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedSpellEntries = classSpells
        .filter((spell) => effectiveChosenSpells.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedClassFeatureSpellEntries = classFeatureResolvedSpellChoices.flatMap((choice) => {
        const selected = resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          classFeatureSpellChoiceOptions[choice.key] ?? [],
        );
        return selected.map((spell) => ({ id: String(spell.id), name: spell.name, source: choice.sourceLabel ?? choice.title }));
      });
      const selectedFeatureProficiencyEntries = classFeatureProficiencyChoices.reduce<Partial<Record<"skills" | "tools" | "languages" | "armor" | "weapons" | "saves", Array<{ name: string; source: string }>>>>((acc, choice) => {
        const selected = (chosenFeatureChoices[choice.key] ?? []).map((name) => ({ name, source: choice.sourceLabel }));
        if (selected.length === 0) return acc;
        if (choice.category === "skill") acc.skills = [...(acc.skills ?? []), ...selected];
        if (choice.category === "tool") acc.tools = [...(acc.tools ?? []), ...selected];
        if (choice.category === "language") acc.languages = [...(acc.languages ?? []), ...selected];
        return acc;
      }, {});
      const selectedInvocationSpellEntries = invocationResolvedSpellChoices.flatMap((choice) => {
        const selected = resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          invocationSpellChoiceOptions[choice.key] ?? [],
        );
        return selected.map((spell) => ({ id: String(spell.id), name: spell.name, source: choice.sourceLabel ?? choice.title }));
      });
      const selectedInvocationEntries = classInvocations
        .filter((spell) => effectiveChosenInvocations.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedManeuverEntries = maneuverChoiceEntries.flatMap((entry) =>
        entry.chosenEntries.map((spell) => ({
          id: String(spell.id),
          name: spell.name,
          source: entry.definition.sourceLabel,
          ability: entry.selectedAbility,
          sourceKey: entry.definition.sourceKey,
        }))
      );
      const selectedPlanEntries = planChoiceEntries.flatMap((entry) => {
        const byId = new Map((growthOptionEntriesByKey[entry.definition.key] ?? []).map((item) => [String(item.id), item]));
        return entry.chosen
          .map((id) => byId.get(String(id)))
          .filter((item): item is { id: string; name: string } => Boolean(item))
          .map((item) => ({
            id: String(item.id),
            name: item.name,
            source: entry.definition.sourceLabel,
            sourceKey: entry.definition.sourceKey,
          }));
      });
      const payload = buildLevelUpPayload({
        char,
        nextLevel,
        hpGain: hpGain ?? 0,
        featHpBonus,
        subclass,
        chosenCantrips: effectiveChosenCantrips,
        chosenSpells: effectiveChosenSpells,
        chosenInvocations: effectiveChosenInvocations,
        chosenExpertise,
        chosenFeatOptions,
        chosenFeatureChoices,
        expertiseChoices,
        featChoiceEntries,
        chosenFeatDetail,
        featSourceLabel,
        featSpellChoiceOptions,
        newFeatures,
        classDetailName: classDetail?.name,
        selectedCantripEntries,
        selectedSpellEntries,
        selectedClassFeatureSpellEntries,
        selectedFeatureProficiencyEntries,
        selectedInvocationSpellEntries,
        selectedInvocationEntries,
        selectedManeuverEntries,
        selectedPlanEntries,
        baseScores,
        asiMode,
        asiStats,
        featAbilityBonuses,
      });
      await api(`/api/me/characters/${char.id}`, jsonInit("PUT", payload));
      navigate(`/characters/${char.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const accentColor = C.accentHl;

  return (
    <Wrap>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "var(--fs-title)", padding: 0 }}
        >←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-title)", fontWeight: 900, color: C.text }}>{char.name}</h1>
          <div style={{ fontSize: "var(--fs-subtitle)", color: accentColor, fontWeight: 700, marginTop: 2 }}>
            Level {char.level} → <span style={{ color: "#fff" }}>{nextLevel}</span>
            {classDetail && <span style={{ color: C.muted, fontWeight: 400 }}> · {classDetail.name}</span>}
          </div>
        </div>
      </div>

      {/* ── HP gain ── */}
      <LevelUpHpSection
        nextLevel={nextLevel}
        hd={hd}
        conMod={conMod}
        hpChoice={hpChoice}
        hpAverage={hpAverage}
        rolledHp={rolledHp}
        manualHp={manualHp}
        hpGain={hpGain}
        featHpBonus={featHpBonus}
        hpMax={char.hpMax}
        accentColor={accentColor}
        onChooseAverage={() => { setHpChoice("average"); setRolledHp(null); setManualHp(""); }}
        onChooseRoll={() => { setManualHp(""); rollHp(); }}
        onChooseManual={() => { setHpChoice("manual"); setRolledHp(null); }}
        onManualChange={setManualHp}
      />

      {/* ── ASI ── */}
      {isAsiLevel && (
        <Section title="Ability Score Improvement" accent={accentColor}>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
            +2 to one ability score, +1 to two different scores, or take a feat.
          </div>

          {/* Mode selection */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {(["asi", "feat"] as const).map((m) => (
              <ChoiceBtn
                key={m}
                active={asiMode === m}
                onClick={() => { clearAsi(); setAsiMode(m); }}
              >
                {m === "asi" ? "Improve Abilities" : "Take a Feat"}
              </ChoiceBtn>
            ))}
          </div>

          {asiMode && asiMode !== "feat" && (
            <AsiAbilityGrid
              baseScores={baseScores}
              asiStats={asiStats}
              accentColor={accentColor}
              onToggle={toggleAsiPoint}
            />
          )}

          {asiMode === "feat" && (
            <FeatSelectionSection
              accentColor={accentColor}
              featSearch={featSearch}
              onFeatSearchChange={setFeatSearch}
              chosenFeatId={chosenFeatId}
              filteredFeatSummaries={filteredFeatSummaries}
              onChooseFeat={(featId) => {
                setChosenFeatId(featId);
                setChosenFeatOptions({});
              }}
              chosenFeatDetail={chosenFeatDetail}
              featPrereqsMet={featPrereqsMet}
              featRepeatableValid={featRepeatableValid}
              featChoiceEntries={featChoiceEntries}
                featChoiceOptionsByKey={featChoiceOptionsByKey}
                chosenFeatOptions={chosenFeatOptions}
                nextLevel={nextLevel}
              onToggleFeatOption={(choiceKey, option, count) => {
                setChosenFeatOptions((prev) => {
                  const current = prev[choiceKey] ?? [];
                  const next = current.includes(option)
                    ? current.filter((entry) => entry !== option)
                    : current.length < count
                      ? [...current, option]
                      : current;
                  return { ...prev, [choiceKey]: next };
                });
              }}
            />
          )}
        </Section>
      )}

      {expertiseChoices.length > 0 && (
        <Section title={`Expertise at Level ${nextLevel}`} accent={accentColor}>
          <ExpertiseSelectionSection
            accentColor={accentColor}
            expertiseChoices={expertiseChoices}
            chosenExpertise={chosenExpertise}
            proficientSkills={proficientSkills}
            existingExpertise={existingExpertise}
            onToggleExpertise={(choiceKey, skill, count) => {
              setChosenExpertise((prev) => {
                const current = prev[choiceKey] ?? [];
                const next = current.includes(skill)
                  ? current.filter((entry) => entry !== skill)
                  : current.length < count
                    ? [...current, skill]
                    : current;
                return { ...prev, [choiceKey]: next };
              });
            }}
          />
        </Section>
      )}

      <LevelUpSubclassSection
        show={showSubclassChoice}
        nextLevel={nextLevel}
        accentColor={accentColor}
        subclass={subclass}
        subclassOptions={subclassOptions}
        subclassOverview={subclassOverview}
        selectedSubclassFeatures={selectedSubclassFeatures}
        onSelectSubclass={setSubclass}
      />

      <LevelUpChoicesSection
        show={cantripCount > 0 || prepCount > 0 || invocCount > 0 || featSpellListChoices.length > 0 || featResolvedSpellChoices.length > 0 || classFeatureResolvedSpellChoices.length > 0 || classFeatureProficiencyChoices.length > 0 || invocationResolvedSpellChoices.length > 0 || maneuverChoiceEntries.length > 0 || planChoiceEntries.length > 0 || progressionTableChoiceEntries.length > 0}
        nextLevel={nextLevel}
        accentColor={accentColor}
        progressionTableChoiceEntries={progressionTableChoiceEntries}
        classFeatureProficiencyChoices={classFeatureProficiencyChoices}
        chosenFeatureChoices={chosenFeatureChoices}
        existingSkillKeys={classFeatureSkillKeys}
        existingToolKeys={classFeatureToolKeys}
        existingLanguageKeys={classFeatureLanguageKeys}
        cantripChoiceCount={cantripChoiceCount}
        availableCantripChoices={availableCantripChoices}
        displayedChosenCantrips={displayedChosenCantrips}
        globallyChosenSpellChoiceIds={globallyChosenSpellChoiceIds}
        lockedCantripIds={lockedCantripIds}
        classCantrips={classCantrips}
        preparedSpellProgressionGrantedKeys={preparedSpellProgressionGrantedKeys}
        spellcaster={spellcaster}
        spellChoiceCount={spellChoiceCount}
        usesFlexiblePreparedSpellsModel={usesFlexiblePreparedSpellsModel}
        prepCount={prepCount}
        maxSpellLevel={maxSpellLevel}
        availableSpellChoices={availableSpellChoices}
        displayedChosenSpells={displayedChosenSpells}
        lockedSpellIds={lockedSpellIds}
        classSpells={classSpells}
        invocCount={invocCount}
        invocationChoiceCount={invocationChoiceCount}
        availableInvocationChoices={availableInvocationChoices}
        displayedChosenInvocations={displayedChosenInvocations}
        lockedInvocationIds={lockedInvocationIds}
        allowedInvocationIds={allowedInvocationIds}
        maneuverChoiceEntries={maneuverChoiceEntries}
        planChoiceEntries={planChoiceEntries}
        growthOptionEntriesByKey={growthOptionEntriesByKey}
        featSpellListChoices={featSpellListChoices}
        featResolvedSpellChoices={featResolvedSpellChoices}
        classFeatureResolvedSpellChoices={classFeatureResolvedSpellChoices}
        invocationResolvedSpellChoices={invocationResolvedSpellChoices}
        featSpellChoiceOptions={featSpellChoiceOptions}
        classFeatureSpellChoiceOptions={classFeatureSpellChoiceOptions}
        invocationSpellChoiceOptions={invocationSpellChoiceOptions}
        chosenFeatOptions={chosenFeatOptions}
        normalizeSpellTrackingKey={normalizeSpellTrackingKey}
        toggleSelection={toggleSelection}
        setChosenCantrips={setChosenCantrips}
        setChosenSpells={setChosenSpells}
        setChosenInvocations={setChosenInvocations}
        setChosenFeatureChoices={setChosenFeatureChoices}
        setChosenFeatOptions={setChosenFeatOptions}
        extraFeatSpellSelectionsValid={extraFeatSpellSelectionsValid}
      />

      {/* ── New features ── */}

      <LevelUpFeaturesSection
        nextLevel={nextLevel}
        accentColor={accentColor}
        newFeatures={newFeatures}
        expandedFeatures={expandedFeatures}
        onToggleFeature={(key) =>
          setExpandedFeatures((prev) =>
            prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]
          )
        }
      />

      <LevelUpSpellSlotsSection
        nextLevel={nextLevel}
        accentColor={accentColor}
        newSlots={newSlots}
      />

      {/* ── Confirm ── */}
      <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{
            padding: "12px 20px", borderRadius: 10, cursor: "pointer", fontSize: "var(--fs-medium)", fontWeight: 600,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.muted,
          }}
        >Cancel</button>
        <button
          onClick={confirm}
          disabled={!canConfirm || !extraFeatSpellSelectionsValid || saving}
          style={{
            flex: 1, padding: "12px 20px", borderRadius: 10, cursor: canConfirm && !saving ? "pointer" : "not-allowed",
            fontSize: "var(--fs-medium)", fontWeight: 800, border: "none",
            background: canConfirm ? accentColor : "rgba(255,255,255,0.08)",
            color: canConfirm ? "#fff" : C.muted,
            opacity: saving ? 0.6 : 1,
            transition: "background 0.2s",
          }}
        >
          {saving ? "Saving…" : `⬆ Level Up to ${nextLevel}`}
        </button>
      </div>
    </Wrap>
  );
}
