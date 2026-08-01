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
  cantripCount: number;
  cantripReplacementCount: number;
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
    cantripCount,
    cantripReplacementCount,
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

  // Eldritch Versatility's Mystic Arcanum "revisit" entries reuse the historical choice key each
  // spell was originally picked under. Seed the current pick from the character's saved history
  // so the picker opens with it already selected, matching every other already-answered choice —
  // players can leave it alone or pick a different spell of the same level.
  React.useEffect(() => {
    const historical = char?.characterData?.chosenFeatOptions;
    if (!historical) return;
    const revisitKeys = classFeatureResolvedSpellChoices
      .map((choice) => choice.key)
      .filter((key) => Array.isArray(historical[key]) && historical[key].length > 0);
    if (revisitKeys.length === 0) return;
    setChosenFeatOptions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of revisitKeys) {
        if (key in next) continue;
        next[key] = historical[key];
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [char, classFeatureResolvedSpellChoices, setChosenFeatOptions]);

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
        .slice(0, Math.max(0, cantripCount - cantripReplacementCount)),
    [char?.characterData?.chosenCantrips, cantripCount, cantripReplacementCount, classCantrips, existingClassSpellNames, preparedSpellProgressionGrantedKeys]
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
      // Deliberately omitting the by-name fallback (unlike cantrips/spells): invocations are a
      // single flat id space with no cross-list ambiguity, so there's no legitimate case where an
      // invocation the player never chose should get silently adopted just because its name shows
      // up in proficiencies.invocations (a derived display list, not the choice record).
      reconcileSelectedSpellIds(char?.characterData?.chosenInvocations ?? [], classInvocations)
        .filter((id) => allowedInvocationIds.has(id))
        .slice(0, invocCount),
    [allowedInvocationIds, char?.characterData?.chosenInvocations, classInvocations, invocCount]
  );
  const lockedInvocationIds = React.useMemo(() => new Set(lockedInvocationSelectionIds), [lockedInvocationSelectionIds]);

  const maneuverChoiceEntries = React.useMemo(
    () =>
      growthChoiceDefinitions
        .filter((definition) => definition.category === "maneuver" || definition.category === "metamagic" || definition.category === "infusion")
        .map((definition) => {
          const existingIds = Array.isArray(char?.characterData?.chosenFeatureChoices?.[definition.key])
            ? (char?.characterData?.chosenFeatureChoices?.[definition.key] ?? []).map(String)
            : [];
          const existingCount = existingIds.length;
          const chosenEntries = resolveSelectedSpellOptionEntries(
            chosenFeatureChoices[definition.key] ?? [],
            growthOptionEntriesByKey[definition.key] ?? []
          );
          return {
            definition,
            remainingCount: Math.max(0, definition.totalCount - existingCount),
            existingIds,
            replacementsUsed: chosenEntries.filter((entry) => !existingIds.includes(String(entry.id))).length,
            chosen: chosenEntries.map((spell) => String(spell.id)),
            chosenEntries,
            selectedAbility: getGrowthChoiceSelectedAbility(chosenFeatureChoices, definition),
          };
        })
        .filter((entry) => entry.remainingCount > 0 || entry.definition.replacementLimit > 0),
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
      && maneuverChoiceEntries.every((entry) => entry.replacementsUsed <= entry.definition.replacementLimit + entry.remainingCount)
      && planChoiceEntries.every((entry) => entry.chosen.length === entry.definition.totalCount)
      && maneuverChoiceEntries.every((entry) => !entry.definition.abilityChoice || entry.selectedAbility !== null)
      && progressionTableChoiceEntries.every((entry) => entry.chosen.length === 1),
    [chosenFeatOptions, chosenFeatureChoices, classFeatureProficiencyChoices, classFeatureResolvedSpellChoices, featResolvedSpellChoices, featSpellListChoices, invocationResolvedSpellChoices, maneuverChoiceEntries, planChoiceEntries, progressionTableChoiceEntries]
  );

  const cantripChoiceCount = Math.max(0, cantripCount - lockedCantripIds.size);
  const spellChoiceCount = Math.max(0, prepCount - lockedSpellIds.size);
  const invocationChoiceCount = Math.max(0, invocCount - lockedInvocationSelectionIds.length);

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
  const displayedChosenInvocations = (() => {
    const remainingLocked = new Map<string, number>();
    for (const id of lockedInvocationSelectionIds) remainingLocked.set(id, (remainingLocked.get(id) ?? 0) + 1);
    return chosenInvocations.filter((id) => {
      const remaining = remainingLocked.get(id) ?? 0;
      if (remaining === 0) return true;
      remainingLocked.set(id, remaining - 1);
      return false;
    });
  })();

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

  const selectedFeatResolvedSpells = React.useMemo(
    () =>
      featResolvedSpellChoices.flatMap((choice) =>
        resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          featSpellChoiceOptions[choice.key] ?? [],
        )
      ),
    [chosenFeatOptions, featResolvedSpellChoices, featSpellChoiceOptions]
  );
  const selectedClassFeatureResolvedSpells = React.useMemo(
    () =>
      classFeatureResolvedSpellChoices.flatMap((choice) =>
        resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          classFeatureSpellChoiceOptions[choice.key] ?? [],
        )
      ),
    [chosenFeatOptions, classFeatureResolvedSpellChoices, classFeatureSpellChoiceOptions]
  );
  const selectedFeatResolvedSpellIds = React.useMemo(
    () => selectedFeatResolvedSpells.map((spell) => String(spell.id)),
    [selectedFeatResolvedSpells]
  );
  const selectedClassFeatureResolvedSpellIds = React.useMemo(
    () => selectedClassFeatureResolvedSpells.map((spell) => String(spell.id)),
    [selectedClassFeatureResolvedSpells]
  );
  const globallyChosenSpellChoiceIds = React.useMemo(
    () =>
      new Set([
        ...displayedChosenCantrips,
        ...displayedChosenSpells,
        ...displayedChosenInvocations,
        ...selectedFeatResolvedSpellIds,
        ...selectedClassFeatureResolvedSpellIds,
      ].map(normalizeChoiceKey)),
    [
      displayedChosenCantrips,
      displayedChosenInvocations,
      displayedChosenSpells,
      selectedClassFeatureResolvedSpellIds,
      selectedFeatResolvedSpellIds,
    ]
  );
  // Name-based backstop alongside the id-based set above: the same spell can surface under a
  // different compendium row id depending on which class-list query matched it (e.g. a feature's
  // "choose any class's spell list" search vs. the character's own class spell list), so id
  // equality alone can miss an already-known cantrip/spell. Comparing normalized names catches it
  // regardless of which row id the option happened to resolve to.
  const normalizeSpellName = (name: string) => String(name ?? "").trim().toLowerCase();
  const classCantripNameById = React.useMemo(() => new Map(classCantrips.map((spell) => [String(spell.id), spell.name])), [classCantrips]);
  const classSpellNameById = React.useMemo(() => new Map(classSpells.map((spell) => [String(spell.id), spell.name])), [classSpells]);
  const classInvocationNameById = React.useMemo(() => new Map(classInvocations.map((spell) => [String(spell.id), spell.name])), [classInvocations]);
  const globallyChosenSpellChoiceNames = React.useMemo(
    () =>
      new Set([
        ...existingClassSpellNames,
        ...displayedChosenCantrips.map((id) => classCantripNameById.get(id)),
        ...displayedChosenSpells.map((id) => classSpellNameById.get(id)),
        ...displayedChosenInvocations.map((id) => classInvocationNameById.get(id)),
        ...selectedFeatResolvedSpells.map((spell) => spell.name),
        ...selectedClassFeatureResolvedSpells.map((spell) => spell.name),
      ].filter((name): name is string => Boolean(name)).map(normalizeSpellName)),
    [
      existingClassSpellNames,
      displayedChosenCantrips,
      displayedChosenSpells,
      displayedChosenInvocations,
      classCantripNameById,
      classSpellNameById,
      classInvocationNameById,
      selectedFeatResolvedSpells,
      selectedClassFeatureResolvedSpells,
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
    lockedInvocationSelectionIds,
    maneuverChoiceEntries,
    planChoiceEntries,
    progressionTableChoiceEntries,
    effectiveChosenCantrips,
    effectiveChosenSpells,
    effectiveChosenInvocations,
    globallyChosenSpellChoiceIds,
    globallyChosenSpellChoiceNames,
  };
}
