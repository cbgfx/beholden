import React from "react";
import { api } from "@/services/api";
import type { CreatorResolvedSpellChoiceEntry, ItemSummary, SpellSummary } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { SharedSpellSummary } from "@/views/character-creator/utils/SpellChoiceUtils";
import type { GrowthChoiceDefinition } from "@/views/character-creator/utils/GrowthChoiceUtils";
import { loadSpellChoiceOptions } from "@/views/character-creator/utils/SpellChoiceUtils";
import { buildGrowthChoiceItemOptions } from "@/views/character-creator/utils/GrowthChoiceUtils";
import {
  buildGrowthItemLookupBody,
  fetchCompendiumItemsByLookup,
  isItemLookupBodyEmpty,
} from "@/views/character-creator/utils/ItemLookupUtils";

type ItemOptionEntry = {
  id: string;
  name: string;
  rarity?: string | null;
  type?: string | null;
  magic?: boolean;
  attunement?: boolean;
};

export function useCreatorChoiceData(args: {
  step6ResolvedSpellChoices: CreatorResolvedSpellChoiceEntry[];
  growthChoiceDefinitions: GrowthChoiceDefinition[];
}) {
  const { step6ResolvedSpellChoices, growthChoiceDefinitions } = args;
  const [featSpellChoiceOptions, setFeatSpellChoiceOptions] = React.useState<Record<string, SharedSpellSummary[]>>({});
  const [growthOptionEntriesByKey, setGrowthOptionEntriesByKey] = React.useState<Record<string, ItemOptionEntry[]>>({});
  const [items, setItems] = React.useState<ItemSummary[]>([]);

  React.useEffect(() => {
    if (step6ResolvedSpellChoices.length === 0) {
      setFeatSpellChoiceOptions({});
      return;
    }
    let cancelled = false;
    loadSpellChoiceOptions(step6ResolvedSpellChoices, (query) => api<SpellSummary[]>(query))
      .then((optionsByKey) => {
        if (!cancelled) setFeatSpellChoiceOptions(optionsByKey);
      })
      .catch(() => {
        if (!cancelled) setFeatSpellChoiceOptions({});
      });
    return () => { cancelled = true; };
  }, [step6ResolvedSpellChoices]);

  React.useEffect(() => {
    if (growthChoiceDefinitions.length === 0) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    const lookupBody = buildGrowthItemLookupBody(growthChoiceDefinitions);
    if (isItemLookupBodyEmpty(lookupBody)) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    fetchCompendiumItemsByLookup(lookupBody)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
      });
    return () => { cancelled = true; };
  }, [growthChoiceDefinitions]);

  React.useEffect(() => {
    const spellBackedDefinitions = growthChoiceDefinitions.filter((definition) => definition.spellChoice);
    const includeSpecialSpellRows = growthChoiceDefinitions.some((definition) => definition.category === "maneuver");
    if (growthChoiceDefinitions.length === 0) {
      setGrowthOptionEntriesByKey({});
      return;
    }
    let cancelled = false;
    const itemBacked = Object.fromEntries(
      growthChoiceDefinitions
        .filter((definition) => definition.category === "plan")
        .map((definition) => [definition.key, buildGrowthChoiceItemOptions(definition, items)])
    );
    if (spellBackedDefinitions.length === 0) {
      setGrowthOptionEntriesByKey(itemBacked);
      return;
    }
    loadSpellChoiceOptions(
      spellBackedDefinitions.map((definition) => definition.spellChoice!).filter(Boolean),
      (query) => api<SpellSummary[]>(query),
      { excludeSpecial: !includeSpecialSpellRows },
    )
      .then((optionsByKey) => {
        if (!cancelled) setGrowthOptionEntriesByKey({ ...optionsByKey, ...itemBacked });
      })
      .catch(() => {
        if (!cancelled) setGrowthOptionEntriesByKey(itemBacked);
      });
    return () => { cancelled = true; };
  }, [growthChoiceDefinitions, items]);

  return { featSpellChoiceOptions, growthOptionEntriesByKey, items };
}
