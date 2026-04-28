import React from "react";
import { sanitizeGrowthChoiceSelections } from "@/views/character-creator/utils/GrowthChoiceUtils";
import { sanitizeSpellChoiceSelections } from "@/views/character-creator/utils/SpellChoiceUtils";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type {
  CreatorResolvedSpellChoiceEntry,
  CreatorSpellListChoiceEntry,
  SpellSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { SharedSpellSummary } from "@/views/character-creator/utils/SpellChoiceUtils";

function selectionMapChanged(nextMap: Record<string, string[]>, currentMap: Record<string, string[]>): boolean {
  return Object.keys(nextMap).length !== Object.keys(currentMap).length
    || Object.entries(nextMap).some(([key, values]) => {
      const current = currentMap[key] ?? [];
      return values.length !== current.length || values.some((value, index) => value !== current[index]);
    });
}

export function useCharacterCreatorSanitizers(args: {
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  levelUpFeatLevels: number[];
  step6SpellListChoices: CreatorSpellListChoiceEntry[];
  step6ResolvedSpellChoices: CreatorResolvedSpellChoiceEntry[];
  featSpellChoiceOptions: Record<string, SharedSpellSummary[]>;
  growthChoiceDefinitions: Array<{ key: string }>;
  growthOptionEntriesByKey: Record<string, Array<{ id: string; name: string }>>;
  preparedSpellProgressionChoiceDefinitions: Array<{ key: string; options: string[] }>;
  classInvocations: SpellSummary[];
  eligibleInvocationIds: Set<string>;
}) {
  const {
    setForm,
    levelUpFeatLevels,
    step6SpellListChoices,
    step6ResolvedSpellChoices,
    featSpellChoiceOptions,
    growthChoiceDefinitions,
    growthOptionEntriesByKey,
    preparedSpellProgressionChoiceDefinitions,
    classInvocations,
    eligibleInvocationIds,
  } = args;

  React.useEffect(() => {
    setForm((f) => {
      const allowedLevels = new Set(levelUpFeatLevels);
      const nextChosenLevelUpFeats = f.chosenLevelUpFeats.filter((entry) => allowedLevels.has(entry.level));
      const nextChosenFeatOptions = Object.fromEntries(
        Object.entries(f.chosenFeatOptions).filter(([key]) => {
          const match = key.match(/^levelupfeat:(\d+):/);
          return !match || allowedLevels.has(Number(match[1]));
        })
      );
      if (nextChosenLevelUpFeats.length === f.chosenLevelUpFeats.length && Object.keys(nextChosenFeatOptions).length === Object.keys(f.chosenFeatOptions).length) {
        return f;
      }
      return {
        ...f,
        chosenLevelUpFeats: nextChosenLevelUpFeats,
        chosenFeatOptions: nextChosenFeatOptions,
      };
    });
  }, [levelUpFeatLevels, setForm]);

  React.useEffect(() => {
    const allSpellChoiceKeys = new Set<string>([
      ...step6SpellListChoices.map((choice) => choice.key),
      ...step6ResolvedSpellChoices.map((choice) => choice.key),
    ]);
    if (allSpellChoiceKeys.size === 0) return;
    setForm((f) => {
      const nextChosenFeatOptions = sanitizeSpellChoiceSelections({
        currentSelections: f.chosenFeatOptions,
        spellListChoices: step6SpellListChoices,
        resolvedSpellChoices: step6ResolvedSpellChoices,
        spellOptionsByKey: featSpellChoiceOptions,
      });
      const changed = selectionMapChanged(nextChosenFeatOptions, f.chosenFeatOptions);
      return changed ? { ...f, chosenFeatOptions: nextChosenFeatOptions } : f;
    });
  }, [featSpellChoiceOptions, setForm, step6ResolvedSpellChoices, step6SpellListChoices]);

  React.useEffect(() => {
    if (growthChoiceDefinitions.length === 0) return;
    setForm((f) => {
      const nextChosenFeatureChoices = sanitizeGrowthChoiceSelections({
        definitions: growthChoiceDefinitions as never,
        currentSelections: f.chosenFeatureChoices,
        optionEntriesByKey: growthOptionEntriesByKey as never,
      });
      const changed = selectionMapChanged(nextChosenFeatureChoices, f.chosenFeatureChoices);
      return changed ? { ...f, chosenFeatureChoices: nextChosenFeatureChoices } : f;
    });
  }, [growthChoiceDefinitions, growthOptionEntriesByKey, setForm]);

  React.useEffect(() => {
    if (preparedSpellProgressionChoiceDefinitions.length === 0) return;
    setForm((f) => {
      const nextSelections = { ...f.chosenFeatureChoices };
      const validKeys = new Set(preparedSpellProgressionChoiceDefinitions.map((definition) => definition.key));
      for (const definition of preparedSpellProgressionChoiceDefinitions) {
        const filtered = (nextSelections[definition.key] ?? [])
          .filter((value) => definition.options.includes(value))
          .slice(0, 1);
        if (filtered.length > 0) nextSelections[definition.key] = filtered;
        else delete nextSelections[definition.key];
      }
      for (const key of Object.keys(nextSelections)) {
        if (key.includes(":prepared-spell-progression:") && !validKeys.has(key)) delete nextSelections[key];
      }
      const changed = selectionMapChanged(nextSelections, f.chosenFeatureChoices);
      return changed ? { ...f, chosenFeatureChoices: nextSelections } : f;
    });
  }, [preparedSpellProgressionChoiceDefinitions, setForm]);

  React.useEffect(() => {
    if (classInvocations.length === 0) return;
    setForm((f) => {
      const next = f.chosenInvocations.filter((id) => eligibleInvocationIds.has(id));
      if (next.length === f.chosenInvocations.length) return f;
      return { ...f, chosenInvocations: next };
    });
  }, [classInvocations, eligibleInvocationIds, setForm]);
}
