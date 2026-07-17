import { parseBackgroundEquipmentOptions } from "./backgroundEquipment.js";
import { type JsonRecord, list, record, text } from "./grandCompendium.helpers.js";

const STRUCTURAL_TRAIT_NAME = /^(?:ability scores?(?::.*)?|choose abilities|choose an? (?:origin )?feat|choose skill proficiencies|languages?(?::.*)?|tool proficienc(?:y|ies)(?::.*)?|choose a tool proficiency|starting equipment|equipment|choose equipment)$/iu;

function traitName(trait: JsonRecord): string {
  return text(trait.name) ?? "";
}

function traitDescription(trait: JsonRecord): string {
  return text(trait.description ?? trait.text) ?? "";
}

function nonEmptyStrings(value: unknown): string[] {
  return list(value).map(String).map((item) => item.trim()).filter(Boolean);
}

function compactChoice(value: unknown): unknown {
  if (Array.isArray(value)) {
    const fixed = nonEmptyStrings(value);
    return fixed.length > 0 ? fixed : undefined;
  }
  const choice = record(value);
  const fixed = nonEmptyStrings(choice.fixed);
  const choose = Number(choice.choose);
  const from = nonEmptyStrings(choice.from);
  if (Number.isInteger(choose) && choose > 0) {
    return {
      ...(fixed.length > 0 ? { fixed } : {}),
      choose,
      ...(from.length > 0 ? { from } : {}),
    };
  }
  return fixed.length > 0 ? fixed : undefined;
}

function splitDescriptionSource(value: string): { description: string; source?: string } {
  const match = value.match(/\n+\s*Source:\s*(.+?)\s*$/iu);
  if (!match?.[1]) return { description: value.trim() };
  return {
    description: value.slice(0, match.index).trim(),
    source: match[1].trim(),
  };
}

const REDUNDANT_FEAT_RESOLUTION_NOTES = new Set([
  "Structured benefits are automatic; remaining feat prose requires manual resolution until reviewed.",
  "No deterministic mechanics are encoded; resolve this feat manually.",
]);

function compactFeatValue(value: unknown, key = ""): unknown {
  if (value == null || value === "" || (value === false && key === "repeatable")) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const compact = value
      .map((item) => compactFeatValue(item))
      .filter((item) => item !== undefined)
      .filter((item) => key !== "resolutionNotes"
        || !REDUNDANT_FEAT_RESOLUTION_NOTES.has(String(item)));
    return compact.length > 0 ? compact : undefined;
  }
  if (typeof value === "object") {
    const compact = Object.fromEntries(
      Object.entries(value as JsonRecord)
        .flatMap(([childKey, childValue]) => {
          const child = compactFeatValue(childValue, childKey);
          return child === undefined ? [] : [[childKey, child]];
        }),
    );
    return Object.keys(compact).length > 0 ? compact : undefined;
  }
  return value;
}

export function compactBackgroundEntry(entry: JsonRecord): JsonRecord {
  const traits = list(entry.traits).map(record);
  const descriptionTrait = traits.find((trait) => /^description$/iu.test(traitName(trait)));
  const splitDescription = splitDescriptionSource(
    text(entry.description) ?? (descriptionTrait ? traitDescription(descriptionTrait) : ""),
  );
  const source = text(entry.source) ?? splitDescription.source;
  const proficiencies = record(entry.proficiencies);
  const featValues = Array.isArray(proficiencies.feats)
    ? proficiencies.feats
    : text(proficiencies.feat) ? [proficiencies.feat] : [];
  const feats = featValues.flatMap((rawFeat) => {
    if (typeof rawFeat === "string") return rawFeat.trim() ? [rawFeat.trim()] : [];
    const name = text(record(rawFeat).name);
    return name ? [`f_${name.toLowerCase().replace(/\s+/gu, "_")}`] : [];
  });
  const featChoiceValue = proficiencies.featChoice;
  const featChoice = Number(featChoiceValue);
  const abilityScoreChoose = Number(proficiencies.abilityScoreChoose);
  const equipmentValue = entry.equipment;
  const equipmentRecord = record(equipmentValue);
  const equipmentDescription = typeof equipmentValue === "string"
    ? equipmentValue.trim()
    : text(equipmentRecord.description) ?? "";
  const equipmentTrait = traits.find((trait) =>
    /^(?:starting equipment|equipment|choose equipment)$/iu.test(traitName(trait)));
  const description = equipmentDescription
    || (equipmentTrait ? traitDescription(equipmentTrait) : "");
  const options = list(equipmentRecord.options ?? entry.equipmentOptions);
  const parsedOptions = options.length > 0 ? options : parseBackgroundEquipmentOptions(description);

  const compactProficiencies: JsonRecord = {
    ...(compactChoice(proficiencies.skills) !== undefined
      ? { skills: compactChoice(proficiencies.skills) }
      : {}),
    ...(compactChoice(proficiencies.tools) !== undefined
      ? { tools: compactChoice(proficiencies.tools) }
      : {}),
    ...(compactChoice(proficiencies.languages) !== undefined
      ? { languages: compactChoice(proficiencies.languages) }
      : {}),
    ...(feats[0] ? { feat: feats[0] } : {}),
    ...(featChoiceValue && typeof featChoiceValue === "object" && !Array.isArray(featChoiceValue)
      ? { featChoice: featChoiceValue }
      : Number.isInteger(featChoice) && featChoice > 0 ? { featChoice } : {}),
    ...(nonEmptyStrings(proficiencies.abilityScores).length > 0
      ? { abilityScores: nonEmptyStrings(proficiencies.abilityScores) }
      : {}),
    ...(Number.isInteger(abilityScoreChoose) && abilityScoreChoose > 0
      ? { abilityScoreChoose }
      : {}),
  };

  const remainingTraits = traits.flatMap((trait, index) => {
    const name = traitName(trait);
    if (
      !name
      || /^description$/iu.test(name)
      || /^Feat:\s*/iu.test(name)
      || STRUCTURAL_TRAIT_NAME.test(name)
    ) {
      return [];
    }
    const description = traitDescription(trait);
    return [{
      // Background traits share the species trait contract, which requires a stable id.
      id: text(trait.id) ?? `trait_${index + 1}`,
      name,
      description,
      ...(list(trait.scalingRolls).length > 0
        ? { scalingRolls: compactFeatValue(trait.scalingRolls) }
        : {}),
      ...(list(trait.preparedSpellProgression).length > 0
        ? { preparedSpellProgression: compactFeatValue(trait.preparedSpellProgression) }
        : {}),
      ...(text(trait.resolution) ? { resolution: trait.resolution } : {}),
    }];
  });

  return {
    id: text(entry.id),
    name: text(entry.name),
    ...(source ? { source } : {}),
    description: splitDescription.description,
    proficiencies: compactProficiencies,
    ...((description || parsedOptions.length > 0)
      ? {
          equipment: {
            ...(parsedOptions.length === 0 && description ? { description } : {}),
            ...(parsedOptions.length > 0 ? { options: parsedOptions } : {}),
          },
        }
      : {}),
    ...(remainingTraits.length > 0 ? { traits: remainingTraits } : {}),
  };
}

