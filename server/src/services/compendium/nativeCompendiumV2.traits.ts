import { hasStructuredTraitMechanics, withContentResolution } from "./contentResolution.js";
import { record, list, text, number } from "./nativeCompendiumV2.helpers.js";

export function traitsToV2(value: unknown) {
  return list(value).map((raw, index) => {
    const trait = record(raw);
    const scalingRolls = list(trait.scalingRolls ?? trait.roll)
      .flatMap((rawRoll) => {
        if (typeof rawRoll === "string") {
          return rawRoll.trim()
            ? [{ description: null, level: null, formula: rawRoll.trim() }]
            : [];
        }
        const roll = record(rawRoll);
        const formula = text(roll.formula ?? roll.value ?? roll["#text"]);
        if (!formula) return [];
        return [{
          description: text(roll.description ?? roll["@_description"]),
          level: number(roll.level ?? roll["@_level"]),
          formula,
        }];
      });
    const converted = {
      id: text(trait.id) ?? `trait_${index + 1}`,
      name: text(trait.name) ?? `Trait ${index + 1}`,
      description: text(trait.text ?? trait.description) ?? "",
      category: text(trait.category),
      scalingRolls,
      preparedSpellProgression: list(trait.preparedSpellProgression),
    };
    return withContentResolution(converted, hasStructuredTraitMechanics(converted));
  });
}

export function traitsFromV2(value: unknown) {
  return list(value).map((raw) => {
    const trait = record(raw);
    return {
      id: trait.id,
      name: trait.name,
      text: trait.description,
      category: trait.category,
      scalingRolls: trait.scalingRolls,
      preparedSpellProgression: list(trait.preparedSpellProgression),
      resolution: trait.resolution,
      resolutionNotes: list(trait.resolutionNotes),
    };
  });
}
