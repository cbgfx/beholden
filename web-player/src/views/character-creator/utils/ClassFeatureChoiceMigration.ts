export interface CurrentClassFeatureChoice {
  key: string;
  sourceLabel: string;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function migrateClassFeatureChoiceKeys(
  stored: Record<string, string[]>,
  currentChoices: CurrentClassFeatureChoice[],
): Record<string, string[]> {
  let next = stored;

  for (const choice of currentChoices) {
    if ((next[choice.key] ?? []).length > 0) continue;
    const source = normalized(choice.sourceLabel);
    if (!source) continue;

    const legacy = Object.entries(stored).find(([key, values]) =>
      values.length > 0
      && key.startsWith("classfeature:")
      && normalized(key).includes(source)
    );
    if (!legacy) continue;
    if (next === stored) next = { ...stored };
    next[choice.key] = [...legacy[1]];
  }

  return next;
}
