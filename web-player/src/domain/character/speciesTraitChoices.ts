type JsonRecord = Record<string, unknown>;

export interface SpeciesTraitChoiceBundle {
  key: string;
  traitName: string;
  options: Array<{ id: string; label: string }>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export function speciesTraitChoiceKey(speciesId: string, traitName: string): string {
  return `species:${speciesId}:${traitName}:choice-bundle`;
}

export function collectSpeciesTraitChoiceBundles(
  species: { id: string; traits: Array<{ name: string; effects?: unknown[] }> } | null,
): SpeciesTraitChoiceBundle[] {
  if (!species) return [];
  return species.traits.flatMap((trait) =>
    (trait.effects ?? []).flatMap((effect) => {
      const bundle = record(effect);
      if (bundle.type !== "choice_bundle" || !Array.isArray(bundle.options)) return [];
      const options = bundle.options.flatMap((option) => {
        const candidate = record(option);
        const id = String(candidate.optionId ?? "").trim();
        const label = String(candidate.label ?? "").trim();
        return id && label ? [{ id, label }] : [];
      });
      return options.length > 0
        ? [{ key: speciesTraitChoiceKey(species.id, trait.name), traitName: trait.name, options }]
        : [];
    })
  );
}

export function resolveSpeciesTraitEffects(
  speciesId: string,
  traitName: string,
  effects: unknown[] | undefined,
  chosenFeatureChoices: Record<string, string[]> | null | undefined,
): unknown[] {
  return (effects ?? []).flatMap((effect) => {
    const bundle = record(effect);
    if (bundle.type !== "choice_bundle" || !Array.isArray(bundle.options)) return [effect];
    const selected = chosenFeatureChoices?.[speciesTraitChoiceKey(speciesId, traitName)]?.[0];
    if (!selected) return [];
    const option = bundle.options.map(record).find((candidate) => candidate.optionId === selected);
    return Array.isArray(option?.effects) ? option.effects : [];
  });
}
