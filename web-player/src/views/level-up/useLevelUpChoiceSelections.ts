import React from "react";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import { getFeatChoiceOptions, normalizeChoiceKey } from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  getGrowthChoiceSelectedAbility,
  sanitizeGrowthChoiceSelections,
  type GrowthChoiceDefinition,
} from "@/views/character-creator/utils/GrowthChoiceUtils";
import {
  resolveSelectedSpellOptionEntries,
  sanitizeSpellChoiceSelections,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import { hasKeys, reconcileSelectedSpellIds, sameSelectionMap } from "@/views/level-up/LevelUpHelpers";
import type {
  LevelUpCharacter as Character,
  LevelUpFeatDetail as FeatDetail,
  LevelUpResolvedSpellChoiceEntry,
  LevelUpSpellListChoiceEntry,
  LevelUpSpellSummary as SpellSummary,
} from "@/views/level-up/LevelUpTypes";

type GrowthOptionEntry = { id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean };

export function useLevelUpChoiceSelections(args: {
  char: Character | null;
  nextLevel: number;
  chosenFeatDetail: FeatDetail | null;
  featChoiceEntries: Array<{ id: string; type: string; count: number }>;
  featSpellChoiceOptions: Record<string, Array<{ id: string; name: string }>>;
  featSpellListChoices: LevelUpSpellListChoiceEntry[];
  featResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  classFeatureResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  classFeatureProficiencyChoices: Array<{ key: string; count: number }>;
  invocationResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  classFeatureSpellChoiceOptions: Record<string, Array<{ id: string; name: string }>>;
  invocationSpellChoiceOptions: Record<string, Array<{ id: string; name: string }>>;
  growthChoiceDefinitions: GrowthChoiceDefinition[];
  growthOptionEntriesByKey: Record<string, GrowthOptionEntry[]>;
  preparedSpellProgressionChoiceDefinitions: Array<{ key: string; prompt: string; sourceName: string; options: string[] }>;
  preparedSpellProgressionGrantedKeys: Set<string>;
  chosenFeatureChoices: Record<string, string[]>;
  setChosenFeatureChoices: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  chosenFeatOptions: Record<string, string[]>;
  setChosenFeatOptions: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenInvocations: string[];
  classCantrips: SpellSummary[];
  classSpells: SpellSummary[];
  classInvocations: SpellSummary[];
  existingClassSpellNames: string[];
  existingClassInvocationNames: string[];
  cantripCount: number;
  maxSpellLevel: number;
  prepCount: number;
  allowedInvocationIds: Set<string>;
  invocCount: number;
}) {
  const {
    char,
    nextLevel,
    chosenFeatDetail,
    featChoiceEntries,
    featSpellChoiceOptions,
    featSpellListChoices,
    featResolvedSpellChoices,
    classFeatureResolvedSpellChoices,
    classFeatureProficiencyChoices,
    invocationResolvedSpellChoices,
    classFeatureSpellChoiceOptions,
    invocationSpellChoiceOptions,
    growthChoiceDefinitions,
    growthOptionEntriesByKey,
    preparedSpellProgressionChoiceDefinitions,
    preparedSpellProgressionGrantedKeys,
    chosenFeatureChoices,
    setChosenFeatureChoices,
    chosenFeatOptions,
    setChosenFeatOptions,
    chosenCantrips,
    chosenSpells,
    chosenInvocations,
    classCantrips,
    classSpells,
    classInvocations,
    existingClassSpellNames,
    existingClassInvocationNames,
    cantripCount,
    maxSpellLevel,
    prepCount,
    allowedInvocationIds,
    invocCount,
  } = args;

  React.useEffect(() => {
    if (!chosenFeatDetail) {
      setChosenFeatOptions((prev) => (hasKeys(prev) ? {} : prev));
      return;
    }
  }, [chosenFeatDetail, setChosenFeatOptions]);

  const featChoiceOptionsByKey = React.useMemo(() => {
    const entries: Array<[string, string[]]> = [];
    for (const choice of featChoiceEntries) {
      const key = `levelupfeat:${nextLevel}:${chosenFeatDetail?.id ?? ""}:${choice.id}`;
      if (choice.type === "spell") {
        const spellOptions = featSpellChoiceOptions[key] ?? [];
        const resolved = spellOptions.length > 0 ? spellOptions.map((spell) => spell.name) : getFeatChoiceOptions(choice as never);
        entries.push([key, resolved]);
      } else {
        entries.push([key, getFeatChoiceOptions(choice as never)]);
      }
    }
    return Object.fromEntries(entries);
  }, [chosenFeatDetail?.id, featChoiceEntries, featSpellChoiceOptions, nextLevel]);

  React.useEffect(() => {
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
  }, [chosenFeatDetail, featChoiceOptionsByKey, featResolvedSpellChoices, featSpellChoiceOptions, featSpellListChoices, nextLevel, setChosenFeatOptions]);

  React.useEffect(() => {
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
  }, [classFeatureResolvedSpellChoices, classFeatureSpellChoiceOptions, invocationResolvedSpellChoices, invocationSpellChoiceOptions, setChosenFeatOptions]);

  React.useEffect(() => {
    setChosenFeatureChoices((prev) => {
      const sanitized = sanitizeGrowthChoiceSelections({
        definitions: growthChoiceDefinitions,
        currentSelections: prev,
        optionEntriesByKey: growthOptionEntriesByKey,
      });
      return sameSelectionMap(prev, sanitized) ? prev : sanitized;
    });
  }, [growthChoiceDefinitions, growthOptionEntriesByKey, setChosenFeatureChoices]);

  React.useEffect(() => {
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
  }, [preparedSpellProgressionChoiceDefinitions, setChosenFeatureChoices]);

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
  const lockedCantripIds = React.useMemo(() => new Set(lockedCantripSelectionIds), [lockedCantripSelectionIds]);

  const lockedSpellSelectionIds = React.useMemo(
    () =>
      reconcileSelectedSpellIds(char?.characterData?.chosenSpells ?? [], classSpells, existingClassSpellNames)
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell) && spellLevel > 0 && spellLevel <= maxSpellLevel && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell!.name));
        })
        .slice(0, prepCount),
    [char?.characterData?.chosenSpells, classSpells, existingClassSpellNames, maxSpellLevel, prepCount, preparedSpellProgressionGrantedKeys]
  );
  const lockedSpellIds = React.useMemo(() => new Set(lockedSpellSelectionIds), [lockedSpellSelectionIds]);

  const lockedInvocationSelectionIds = React.useMemo(
    () =>
      reconcileSelectedSpellIds(char?.characterData?.chosenInvocations ?? [], classInvocations, existingClassInvocationNames)
        .filter((id) => allowedInvocationIds.has(id))
        .slice(0, invocCount),
    [allowedInvocationIds, char?.characterData?.chosenInvocations, classInvocations, existingClassInvocationNames, invocCount]
  );
  const lockedInvocationIds = React.useMemo(() => new Set(lockedInvocationSelectionIds), [lockedInvocationSelectionIds]);

  const maneuverChoiceEntries = React.useMemo(
    () =>
      growthChoiceDefinitions
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
    () =>
      growthChoiceDefinitions
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
    () =>
      preparedSpellProgressionChoiceDefinitions.map((definition) => ({
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
    () =>
      new Set([
        ...displayedChosenCantrips,
        ...displayedChosenSpells,
        ...displayedChosenInvocations,
        ...selectedFeatResolvedSpellIds,
        ...selectedClassFeatureResolvedSpellIds,
        ...selectedInvocationResolvedSpellIds,
      ].map(normalizeChoiceKey)),
    [
      displayedChosenCantrips,
      displayedChosenInvocations,
      displayedChosenSpells,
      selectedClassFeatureResolvedSpellIds,
      selectedFeatResolvedSpellIds,
      selectedInvocationResolvedSpellIds,
    ]
  );

  return {
    featChoiceOptionsByKey,
    extraFeatSpellSelectionsValid,
    cantripChoiceCount,
    spellChoiceCount,
    invocationChoiceCount,
    displayedChosenCantrips,
    displayedChosenSpells,
    displayedChosenInvocations,
    lockedCantripIds,
    lockedSpellIds,
    lockedInvocationIds,
    maneuverChoiceEntries,
    planChoiceEntries,
    progressionTableChoiceEntries,
    effectiveChosenCantrips,
    effectiveChosenSpells,
    effectiveChosenInvocations,
    globallyChosenSpellChoiceIds,
  };
}
