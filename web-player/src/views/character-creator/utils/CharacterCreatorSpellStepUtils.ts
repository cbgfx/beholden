import React from "react";

import { titleCase } from "@/lib/format/titleCase";
import { ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import {
  resolveSelectedSpellOptionEntries,
  type SharedSpellSummary,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import type {
  CreatorResolvedSpellChoiceEntry,
  CreatorSpellListChoiceEntry,
  ItemSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

type GrowthChoiceDefinition = {
  key: string;
  title: string;
  sourceLabel?: string | null;
  totalCount: number;
  note?: string | null;
  category: string;
  abilityChoice?: {
    key: string;
    title: string;
    options: AbilityKey[];
  } | null;
};

type PreparedSpellProgressionChoiceDefinition = {
  key: string;
  prompt: string;
  sourceName: string;
  options: string[];
};

type SpellChoiceUpdater = React.Dispatch<React.SetStateAction<FormState>>;

export function buildSpellStepChoiceState(args: {
  form: FormState;
  setForm: SpellChoiceUpdater;
  step6SpellListChoices: CreatorSpellListChoiceEntry[];
  step6ResolvedSpellChoices: CreatorResolvedSpellChoiceEntry[];
  growthChoiceDefinitions: GrowthChoiceDefinition[];
  preparedSpellProgressionChoiceDefinitions: PreparedSpellProgressionChoiceDefinition[];
  growthOptionEntriesByKey: Record<string, ItemSummary[]>;
  featSpellChoiceOptions: Record<string, SharedSpellSummary[]>;
  getGrowthChoiceSelectedAbility: (choices: Record<string, string[]>, definition: GrowthChoiceDefinition) => string | null;
}) {
  const {
    form,
    setForm,
    step6SpellListChoices,
    step6ResolvedSpellChoices,
    growthChoiceDefinitions,
    preparedSpellProgressionChoiceDefinitions,
    growthOptionEntriesByKey,
    featSpellChoiceOptions,
    getGrowthChoiceSelectedAbility,
  } = args;

  const extraSpellListChoices = step6SpellListChoices.map((entry) => ({
    key: entry.key,
    title: entry.title,
    sourceLabel: entry.sourceLabel,
    options: entry.options,
    chosen: form.chosenFeatOptions[entry.key] ?? [],
    max: entry.count,
    note: entry.note,
    emptyMsg: entry.linkedTo ? "Choose the spell list first." : "No eligible spell options found.",
    onToggle: (value: string) => setForm((f) => {
      const current = f.chosenFeatOptions[entry.key] ?? [];
      const next = current.includes(value)
        ? current.filter((x) => x !== value)
        : current.length < entry.count ? [...current, value] : current;
      return { ...f, chosenFeatOptions: { ...f.chosenFeatOptions, [entry.key]: next } };
    }),
  }));

  const extraSpellChoices = step6ResolvedSpellChoices.map((entry) => ({
    key: entry.key,
    title: entry.title,
    sourceLabel: entry.sourceLabel,
    spells: (featSpellChoiceOptions[entry.key] ?? []).map((spell) => ({ ...spell, id: String(spell.id), level: spell.level ?? null })),
    chosen: resolveSelectedSpellOptionEntries(form.chosenFeatOptions[entry.key] ?? [], featSpellChoiceOptions[entry.key] ?? []).map((spell) => String(spell.id)),
    chosenNames: resolveSelectedSpellOptionEntries(form.chosenFeatOptions[entry.key] ?? [], featSpellChoiceOptions[entry.key] ?? []).map((spell) => spell.name),
    max: entry.count,
    note: entry.note,
    emptyMsg: entry.linkedTo ? "Choose the spell list first." : "No eligible spell options found.",
    onToggle: (id: string) => setForm((f) => {
      const current = f.chosenFeatOptions[entry.key] ?? [];
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < entry.count ? [...current, id] : current;
      return { ...f, chosenFeatOptions: { ...f.chosenFeatOptions, [entry.key]: next } };
    }),
  }));

  const maneuverSpellChoices = growthChoiceDefinitions
    .filter((definition) => definition.category === "maneuver" || definition.category === "metamagic")
    .map((definition) => ({
      key: definition.key,
      title: definition.title,
      sourceLabel: definition.sourceLabel,
      spells: (growthOptionEntriesByKey[definition.key] ?? []).map((spell) => ({
        ...spell,
        id: String(spell.id),
        level: null,
      })),
      chosen: resolveSelectedSpellOptionEntries(form.chosenFeatureChoices[definition.key] ?? [], growthOptionEntriesByKey[definition.key] ?? []).map((spell) => String(spell.id)),
      chosenNames: resolveSelectedSpellOptionEntries(form.chosenFeatureChoices[definition.key] ?? [], growthOptionEntriesByKey[definition.key] ?? []).map((spell) => spell.name),
      max: definition.totalCount,
      note: definition.note,
      emptyMsg: `No ${definition.title.toLowerCase()} options found in compendium.`,
      onToggle: (id: string) => setForm((f) => {
        const current = f.chosenFeatureChoices[definition.key] ?? [];
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : current.length < definition.totalCount ? [...current, id] : current;
        return { ...f, chosenFeatureChoices: { ...f.chosenFeatureChoices, [definition.key]: next } };
      }),
    }));

  const planItemChoices = growthChoiceDefinitions
    .filter((definition) => definition.category === "plan")
    .map((definition) => ({
      key: definition.key,
      title: definition.title,
      sourceLabel: definition.sourceLabel,
      items: growthOptionEntriesByKey[definition.key] ?? [],
      chosen: (form.chosenFeatureChoices[definition.key] ?? []).map(String),
      disabledIds: growthChoiceDefinitions
        .filter((other) => other.category === "plan" && other.key !== definition.key)
        .flatMap((other) => form.chosenFeatureChoices[other.key] ?? [])
        .map(String),
      max: definition.totalCount,
      note: definition.note,
      emptyMsg: "No eligible magic item plans found in compendium.",
      onToggle: (id: string) => setForm((f) => {
        const current = f.chosenFeatureChoices[definition.key] ?? [];
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : current.length < definition.totalCount ? [...current, id] : current;
        return { ...f, chosenFeatureChoices: { ...f.chosenFeatureChoices, [definition.key]: next } };
      }),
    }));

  const maneuverAbilityChoices = growthChoiceDefinitions
    .filter((definition) => definition.abilityChoice)
    .map((definition) => ({
      key: definition.abilityChoice!.key,
      title: definition.abilityChoice!.title,
      sourceLabel: definition.sourceLabel,
      options: definition.abilityChoice!.options.map((option) => ABILITY_LABELS[option]),
      chosen: (() => {
        const selectedAbility = getGrowthChoiceSelectedAbility(form.chosenFeatureChoices, definition);
        return selectedAbility ? [ABILITY_LABELS[selectedAbility as AbilityKey]] : [];
      })(),
      max: 1,
      note: `This sets the save DC ability for ${definition.title.toLowerCase()} from this feature.`,
      emptyMsg: "No ability options found.",
      onToggle: (value: string) => setForm((f) => {
        const entry = definition.abilityChoice;
        if (!entry) return f;
        const abilityKey = Object.entries(ABILITY_LABELS).find(([, label]) => label === value)?.[0] as AbilityKey | undefined;
        if (!abilityKey || !entry.options.includes(abilityKey)) return f;
        const current = f.chosenFeatureChoices[entry.key] ?? [];
        const next = current[0] === abilityKey ? [] : [abilityKey];
        return { ...f, chosenFeatureChoices: { ...f.chosenFeatureChoices, [entry.key]: next } };
      }),
    }));

  const progressionTableChoices = preparedSpellProgressionChoiceDefinitions.map((definition) => ({
    key: definition.key,
    title: definition.prompt,
    sourceLabel: definition.sourceName,
    options: definition.options.map((option) => titleCase(option)),
    chosen: form.chosenFeatureChoices[definition.key] ?? [],
    max: 1,
    note: "This determines which ongoing prepared-spell progression applies to this feature.",
    emptyMsg: "No progression tables found.",
    onToggle: (value: string) => setForm((f) => {
      const current = f.chosenFeatureChoices[definition.key] ?? [];
      const canonicalValue = definition.options.find((option) => titleCase(option) === value) ?? value;
      const next = current[0] === canonicalValue ? [] : [canonicalValue];
      return { ...f, chosenFeatureChoices: { ...f.chosenFeatureChoices, [definition.key]: next } };
    }),
  }));

  const missingExtraSpellSelections =
    extraSpellListChoices.some((entry) => entry.chosen.length < entry.max)
    || extraSpellChoices.some((entry) => entry.chosen.length < entry.max)
    || maneuverSpellChoices.some((entry) => entry.chosen.length < entry.max)
    || planItemChoices.some((entry) => entry.chosen.length < entry.max)
    || maneuverAbilityChoices.some((entry) => entry.chosen.length < entry.max)
    || progressionTableChoices.some((entry) => entry.chosen.length < entry.max);

  return {
    extraSpellListChoices,
    extraSpellChoices,
    maneuverSpellChoices,
    planItemChoices,
    maneuverAbilityChoices,
    progressionTableChoices,
    missingExtraSpellSelections,
  };
}
