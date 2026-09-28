import type { CreatorResolvedSpellChoiceEntry } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { GrowthChoiceDefinition } from "@/views/character-creator/utils/GrowthChoiceUtils";
import { useGrowthChoiceData, useSpellChoiceOptions, type ChoiceLoadState } from "./useChoiceDataLoaders";
import React from "react";

export function useCreatorChoiceData(args: {
  step6ResolvedSpellChoices: CreatorResolvedSpellChoiceEntry[];
  growthChoiceDefinitions: GrowthChoiceDefinition[];
  retryKey?: number;
  ruleset?: "5e" | "5.5e" | null;
}) {
  const [featSpellChoiceLoadState, setFeatSpellChoiceLoadState] = React.useState<ChoiceLoadState>("complete");
  const [growthChoiceLoadState, setGrowthChoiceLoadState] = React.useState<ChoiceLoadState>("complete");
  const featSpellChoiceOptions = useSpellChoiceOptions({
    choices: args.step6ResolvedSpellChoices,
    forceIncludeText: true,
    ruleset: args.ruleset,
    retryKey: args.retryKey,
    onLoadState: setFeatSpellChoiceLoadState,
  });
  const growth = useGrowthChoiceData({ definitions: args.growthChoiceDefinitions, ruleset: args.ruleset, retryKey: args.retryKey, onLoadState: setGrowthChoiceLoadState });
  return { featSpellChoiceOptions, featSpellChoiceLoadState, growthChoiceLoadState, ...growth };
}
