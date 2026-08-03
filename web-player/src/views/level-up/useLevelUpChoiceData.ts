import type { LevelUpFeatDetail, LevelUpResolvedSpellChoiceEntry } from "@/views/level-up/LevelUpTypes";
import type { GrowthChoiceDefinition } from "@/views/character-creator/utils/GrowthChoiceUtils";
import { useGrowthChoiceData, useSpellChoiceOptions } from "@/views/character-creator/useChoiceDataLoaders";

export function useLevelUpChoiceData(args: {
  chosenFeatDetail: LevelUpFeatDetail | null;
  featResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  classFeatureResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  invocationResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  growthChoiceDefinitions: GrowthChoiceDefinition[];
  ruleset?: "5e" | "5.5e" | null;
}) {
  const featSpellChoiceOptions = useSpellChoiceOptions({ choices: args.featResolvedSpellChoices, enabled: !!args.chosenFeatDetail, forceIncludeText: true, ruleset: args.ruleset });
  const classFeatureSpellChoiceOptions = useSpellChoiceOptions({ choices: args.classFeatureResolvedSpellChoices, forceIncludeText: true, ruleset: args.ruleset });
  const invocationSpellChoiceOptions = useSpellChoiceOptions({ choices: args.invocationResolvedSpellChoices, forceIncludeText: true, ruleset: args.ruleset });
  const growth = useGrowthChoiceData({ definitions: args.growthChoiceDefinitions, includeMetamagic: true, ruleset: args.ruleset });
  return { featSpellChoiceOptions, classFeatureSpellChoiceOptions, invocationSpellChoiceOptions, ...growth };
}
