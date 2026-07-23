/** Resolves a class-level exclusive choice group (e.g. Fighting Style, Pact Boon) — the same
 * `cls.choices` shape the character creator consumes via `getOptionalGroups`/`chosenOptionals` —
 * to the character's currently-held option and the alternatives they could swap to. Used by
 * ASI-level "Versatility" replacement features, which have no other way to re-offer a choice
 * that was normally made once at an earlier level. */

export interface ExclusiveGroupReplacementOption {
  id: string;
  name: string;
  selectionNames: string[];
}

export interface ExclusiveGroupReplacementChoice {
  key: string;
  groupId: string;
  groupName: string;
  currentOptionId: string | null;
  currentSelectionNames: string[];
  options: ExclusiveGroupReplacementOption[];
}

export function getExclusiveGroupReplacementChoice(args: {
  choices?: Array<{ id: string; name: string; options: Array<{ id: string; name: string; features: string[] }> }>;
  autolevels: Array<{ level: number | null; features?: Array<{ id?: string; name: string }> }>;
  groupName: string;
  level: number;
  chosenOptionals: string[];
}): ExclusiveGroupReplacementChoice | null {
  const group = (args.choices ?? []).find((entry) => entry.name === args.groupName);
  if (!group) return null;

  const byId = new Map<string, { id?: string; name: string; level: number }>();
  for (const autolevel of args.autolevels) {
    if (autolevel.level == null || autolevel.level > args.level) continue;
    for (const feature of autolevel.features ?? []) {
      if (feature.id) byId.set(feature.id, { ...feature, level: autolevel.level });
    }
  }

  const options: ExclusiveGroupReplacementOption[] = group.options
    .map((option) => {
      const features = option.features.map((featureId) => byId.get(featureId)).filter((f): f is NonNullable<typeof f> => f != null);
      if (features.length !== option.features.length) return null;
      return { id: option.id, name: option.name, selectionNames: features.map((f) => f.name) };
    })
    .filter((option): option is ExclusiveGroupReplacementOption => option != null);

  const chosenSet = new Set(args.chosenOptionals);
  const current = options.find((option) => option.selectionNames.length > 0 && option.selectionNames.every((name) => chosenSet.has(name))) ?? null;

  return {
    key: `classchoicereplacement:${group.id}`,
    groupId: group.id,
    groupName: group.name,
    currentOptionId: current?.id ?? null,
    currentSelectionNames: current?.selectionNames ?? [],
    options,
  };
}

/** Applies a pending replacement pick to the character's persisted `chosenOptionals`: swaps out
 * the currently-selected option's feature names for the newly-picked option's, leaving every
 * other entry (unrelated groups, other classes) untouched. No-op if nothing was picked or the
 * pick matches what's already selected. */
export function applyExclusiveGroupReplacement(args: {
  chosenOptionals: string[];
  choice: ExclusiveGroupReplacementChoice | null;
  selectedOptionId: string | null;
}): string[] {
  const { chosenOptionals, choice, selectedOptionId } = args;
  if (!choice || !selectedOptionId || selectedOptionId === choice.currentOptionId) return chosenOptionals;
  const nextOption = choice.options.find((option) => option.id === selectedOptionId);
  if (!nextOption) return chosenOptionals;
  const currentNames = new Set(choice.currentSelectionNames);
  return [
    ...chosenOptionals.filter((name) => !currentNames.has(name)),
    ...nextOption.selectionNames,
  ];
}
