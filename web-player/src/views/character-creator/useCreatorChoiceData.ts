import type { CreatorResolvedSpellChoiceEntry } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { GrowthChoiceDefinition } from "@/views/character-creator/utils/GrowthChoiceUtils";
import { useGrowthChoiceData, useSpellChoiceOptions } from "./useChoiceDataLoaders";

export function useCreatorChoiceData(args: {
  step6ResolvedSpellChoices: CreatorResolvedSpellChoiceEntry[];
  growthChoiceDefinitions: GrowthChoiceDefinition[];
  ruleset?: "5e" | "5.5e" | null;
}) {
  const featSpellChoiceOptions = useSpellChoiceOptions({
    choices: args.step6ResolvedSpellChoices,
    forceIncludeText: true,
    ruleset: args.ruleset,
  });
  const growth = useGrowthChoiceData({ definitions: args.growthChoiceDefinitions, ruleset: args.ruleset });
  return { featSpellChoiceOptions, ...growth };
}
