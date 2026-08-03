import React from "react";
import { api } from "@/services/api";
import type { ItemSummary, SpellSummary } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { GrowthChoiceDefinition } from "@/views/character-creator/utils/GrowthChoiceUtils";
import { buildGrowthChoiceItemOptions } from "@/views/character-creator/utils/GrowthChoiceUtils";
import { buildGrowthItemLookupBody, fetchCompendiumItemsByLookup, isItemLookupBodyEmpty } from "@/views/character-creator/utils/ItemLookupUtils";
import { loadSpellChoiceOptions, type SharedSpellSummary } from "@/views/character-creator/utils/SpellChoiceUtils";
import { hasKeys } from "@/lib/selectionMaps";

export type ChoiceItemOption = ItemSummary;
export type ChoiceOption = {
  id: string;
  name: string;
  rarity?: string | null;
  type?: string | null;
  magic?: boolean;
  attunement?: boolean;
};

type SpellChoiceInput = Parameters<typeof loadSpellChoiceOptions>[0];
type Ruleset = "5e" | "5.5e" | null | undefined;

function sameOptionMap<T extends { id: string }>(a: Record<string, T[]>, b: Record<string, T[]>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => {
    const left = a[key] ?? [];
    const right = b[key] ?? [];
    return left.length === right.length && left.every((entry, index) => entry.id === right[index]?.id);
  });
}

export function useSpellChoiceOptions(args: {
  choices: SpellChoiceInput;
  enabled?: boolean;
  forceIncludeText?: boolean;
  ruleset?: Ruleset;
}) {
  const { choices, enabled = true, forceIncludeText = false, ruleset } = args;
  const [options, setOptions] = React.useState<Record<string, SharedSpellSummary[]>>({});
  React.useEffect(() => {
    if (!enabled || choices.length === 0) {
      setOptions((previous) => hasKeys(previous) ? {} : previous);
      return;
    }
    let cancelled = false;
    loadSpellChoiceOptions(choices, (query) => api<SpellSummary[]>(query), { forceIncludeText, ruleset })
      .then((next) => {
        if (!cancelled) setOptions((previous) => sameOptionMap(previous, next) ? previous : next);
      })
      .catch(() => {
        if (!cancelled) setOptions((previous) => hasKeys(previous) ? {} : previous);
      });
    return () => { cancelled = true; };
  }, [choices, enabled, forceIncludeText, ruleset]);
  return options;
}

export function useGrowthChoiceData(args: {
  definitions: GrowthChoiceDefinition[];
  includeMetamagic?: boolean;
  ruleset?: Ruleset;
}) {
  const { definitions, includeMetamagic = false, ruleset } = args;
  const [items, setItems] = React.useState<ChoiceItemOption[]>([]);
  const [options, setOptions] = React.useState<Record<string, ChoiceOption[]>>({});

  React.useEffect(() => {
    const body = buildGrowthItemLookupBody(definitions);
    if (definitions.length === 0 || isItemLookupBodyEmpty(body)) {
      setItems((previous) => previous.length === 0 ? previous : []);
      return;
    }
    let cancelled = false;
    fetchCompendiumItemsByLookup(body)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [definitions]);

  React.useEffect(() => {
    if (definitions.length === 0) {
      setOptions((previous) => hasKeys(previous) ? {} : previous);
      return;
    }
    const spellDefinitions = definitions.filter((definition) => definition.spellChoice);
    const itemOptions = Object.fromEntries(definitions
      .filter((definition) => definition.category === "plan")
      .map((definition) => [definition.key, buildGrowthChoiceItemOptions(definition, items)]));
    if (spellDefinitions.length === 0) {
      setOptions((previous) => sameOptionMap(previous, itemOptions) ? previous : itemOptions);
      return;
    }
    let cancelled = false;
    const includeSpecial = definitions.some((definition) => definition.category === "maneuver" || (includeMetamagic && definition.category === "metamagic"));
    loadSpellChoiceOptions(
      spellDefinitions.map((definition) => definition.spellChoice!).filter(Boolean),
      (query) => api<SpellSummary[]>(query),
      { excludeSpecial: !includeSpecial, ruleset },
    ).then((spellOptions) => {
      const next = { ...spellOptions, ...itemOptions };
      if (!cancelled) setOptions((previous) => sameOptionMap(previous, next) ? previous : next);
    }).catch(() => {
      if (!cancelled) setOptions((previous) => sameOptionMap(previous, itemOptions) ? previous : itemOptions);
    });
    return () => { cancelled = true; };
  }, [definitions, includeMetamagic, items, ruleset]);

  return { growthOptionEntriesByKey: options, items };
}
