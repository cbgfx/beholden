import React from "react";
import { api } from "@/services/api";
import type { LevelUpFeatDetail, LevelUpResolvedSpellChoiceEntry, LevelUpSpellSummary } from "@/views/level-up/LevelUpTypes";
import type { GrowthChoiceDefinition } from "@/views/character-creator/utils/GrowthChoiceUtils";
import {
  buildGrowthChoiceItemOptions,
} from "@/views/character-creator/utils/GrowthChoiceUtils";
import {
  buildGrowthItemLookupBody,
  fetchCompendiumItemsByLookup,
  isItemLookupBodyEmpty,
} from "@/views/character-creator/utils/ItemLookupUtils";
import { loadSpellChoiceOptions } from "@/views/character-creator/utils/SpellChoiceUtils";
import { hasKeys, sameSpellChoiceOptionMap } from "@/views/level-up/LevelUpHelpers";

type OptionEntry = {
  id: string;
  name: string;
  rarity?: string | null;
  type?: string | null;
  magic?: boolean;
  attunement?: boolean;
};

export function useLevelUpChoiceData(args: {
  chosenFeatDetail: LevelUpFeatDetail | null;
  featResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  classFeatureResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  invocationResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  growthChoiceDefinitions: GrowthChoiceDefinition[];
}) {
  const {
    chosenFeatDetail,
    featResolvedSpellChoices,
    classFeatureResolvedSpellChoices,
    invocationResolvedSpellChoices,
    growthChoiceDefinitions,
  } = args;

  const [featSpellChoiceOptions, setFeatSpellChoiceOptions] = React.useState<Record<string, LevelUpSpellSummary[]>>({});
  const [classFeatureSpellChoiceOptions, setClassFeatureSpellChoiceOptions] = React.useState<Record<string, LevelUpSpellSummary[]>>({});
  const [invocationSpellChoiceOptions, setInvocationSpellChoiceOptions] = React.useState<Record<string, LevelUpSpellSummary[]>>({});
  const [growthOptionEntriesByKey, setGrowthOptionEntriesByKey] = React.useState<Record<string, OptionEntry[]>>({});
  const [items, setItems] = React.useState<OptionEntry[]>([]);

  React.useEffect(() => {
    if (!chosenFeatDetail) {
      setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    let alive = true;
    if (featResolvedSpellChoices.length === 0) {
      setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    loadSpellChoiceOptions(featResolvedSpellChoices, (query) => api<LevelUpSpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) {
        setFeatSpellChoiceOptions((prev) => sameSpellChoiceOptionMap(prev, optionsByKey) ? prev : optionsByKey);
      }
    }).catch(() => {
      if (alive) setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
    });
    return () => { alive = false; };
  }, [chosenFeatDetail, featResolvedSpellChoices]);

  React.useEffect(() => {
    let alive = true;
    if (classFeatureResolvedSpellChoices.length === 0) {
      setClassFeatureSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    loadSpellChoiceOptions(classFeatureResolvedSpellChoices, (query) => api<LevelUpSpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) {
        setClassFeatureSpellChoiceOptions((prev) => sameSpellChoiceOptionMap(prev, optionsByKey) ? prev : optionsByKey);
      }
    }).catch(() => {
      if (alive) setClassFeatureSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
    });
    return () => { alive = false; };
  }, [classFeatureResolvedSpellChoices]);

  React.useEffect(() => {
    let alive = true;
    if (invocationResolvedSpellChoices.length === 0) {
      setInvocationSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    loadSpellChoiceOptions(invocationResolvedSpellChoices, (query) => api<LevelUpSpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) {
        setInvocationSpellChoiceOptions((prev) => sameSpellChoiceOptionMap(prev, optionsByKey) ? prev : optionsByKey);
      }
    }).catch(() => {
      if (alive) setInvocationSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
    });
    return () => { alive = false; };
  }, [invocationResolvedSpellChoices]);

  React.useEffect(() => {
    if (growthChoiceDefinitions.length === 0) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let alive = true;
    const lookupBody = buildGrowthItemLookupBody(growthChoiceDefinitions);
    if (isItemLookupBodyEmpty(lookupBody)) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    fetchCompendiumItemsByLookup(lookupBody)
      .then((rows) => {
        if (!alive) return;
        setItems(rows);
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
      });
    return () => { alive = false; };
  }, [growthChoiceDefinitions]);

  React.useEffect(() => {
    const spellBackedDefinitions = growthChoiceDefinitions.filter((definition) => definition.spellChoice);
    const includeSpecialSpellRows = growthChoiceDefinitions.some((definition) => definition.category === "maneuver");
    let alive = true;
    if (growthChoiceDefinitions.length === 0) {
      setGrowthOptionEntriesByKey((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    const itemBacked = Object.fromEntries(
      growthChoiceDefinitions
        .filter((definition) => definition.category === "plan")
        .map((definition) => [definition.key, buildGrowthChoiceItemOptions(definition, items)])
    );
    if (spellBackedDefinitions.length === 0) {
      setGrowthOptionEntriesByKey((prev) => sameSpellChoiceOptionMap(prev, itemBacked) ? prev : itemBacked);
      return;
    }
    loadSpellChoiceOptions(
      spellBackedDefinitions.map((definition) => definition.spellChoice!).filter(Boolean),
      (query) => api<LevelUpSpellSummary[]>(query),
      { excludeSpecial: !includeSpecialSpellRows },
    ).then((optionsByKey) => {
      const next = { ...optionsByKey, ...itemBacked };
      if (alive) setGrowthOptionEntriesByKey((prev) => sameSpellChoiceOptionMap(prev, next) ? prev : next);
    }).catch(() => {
      if (alive) setGrowthOptionEntriesByKey((prev) => sameSpellChoiceOptionMap(prev, itemBacked) ? prev : itemBacked);
    });
    return () => { alive = false; };
  }, [growthChoiceDefinitions, items]);

  return {
    featSpellChoiceOptions,
    classFeatureSpellChoiceOptions,
    invocationSpellChoiceOptions,
    growthOptionEntriesByKey,
    items,
  };
}
