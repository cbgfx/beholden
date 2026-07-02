import { parseBackgroundEquipmentOptions } from "./backgroundEquipment.js";
import { type JsonRecord, list, record, text } from "./nativeCompendiumV2.helpers.js";

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

export function expandBackgroundChoice(value: unknown): {
  fixed: string[];
  choose: number;
  from: string[] | null;
} {
  if (Array.isArray(value)) {
    return { fixed: nonEmptyStrings(value), choose: 0, from: null };
  }
  const choice = record(value);
  return {
    fixed: nonEmptyStrings(choice.fixed),
    choose: Number.isInteger(choice.choose) && Number(choice.choose) > 0
      ? Number(choice.choose)
      : 0,
    from: nonEmptyStrings(choice.from).length > 0 ? nonEmptyStrings(choice.from) : null,
  };
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

export function compactBackgroundFeatMechanics(value: unknown): JsonRecord {
  return record(compactFeatValue(value));
}

export function expandBackgroundFeatMechanics(value: unknown, name = ""): JsonRecord {
  const parsed = record(value);
  const grants = record(parsed.grants);
  return {
    category: parsed.category ?? null,
    baseName: parsed.baseName ?? name,
    variant: parsed.variant ?? null,
    prerequisite: parsed.prerequisite ?? null,
    repeatable: parsed.repeatable === true,
    source: parsed.source ?? null,
    grants: {
      skills: list(grants.skills),
      tools: list(grants.tools),
      languages: list(grants.languages),
      armor: list(grants.armor),
      weapons: list(grants.weapons),
      savingThrows: list(grants.savingThrows),
      spells: list(grants.spells),
      cantrips: list(grants.cantrips),
      abilityIncreases: record(grants.abilityIncreases),
      bonuses: list(grants.bonuses),
      effects: list(grants.effects),
    },
    choices: list(parsed.choices),
    uses: list(parsed.uses),
    preparedSpellProgression: list(parsed.preparedSpellProgression),
    notes: list(parsed.notes),
    modifierDetails: list(parsed.modifierDetails),
    ...(parsed.spellcastingAbility !== undefined
      ? { spellcastingAbility: parsed.spellcastingAbility }
      : {}),
    ...(parsed.spellcastingAbilityFromChoiceId !== undefined
      ? { spellcastingAbilityFromChoiceId: parsed.spellcastingAbilityFromChoiceId }
      : {}),
    ...(parsed.resolution !== undefined ? { resolution: parsed.resolution } : {}),
    ...(list(parsed.resolutionNotes).length > 0
      ? { resolutionNotes: parsed.resolutionNotes }
      : {}),
  };
}

export function compactBackgroundEntry(entry: JsonRecord): JsonRecord {
  const traits = list(entry.traits).map(record);
  const descriptionTrait = traits.find((trait) => /^description$/iu.test(traitName(trait)));
  const splitDescription = splitDescriptionSource(
    text(entry.description) ?? (descriptionTrait ? traitDescription(descriptionTrait) : ""),
  );
  const source = text(entry.source) ?? splitDescription.source;
  const proficiencies = record(entry.proficiencies);
  const feats = list(proficiencies.feats).map(record).flatMap((feat) => {
    const name = text(feat.name);
    if (!name) return [];
    const matchingTrait = traits.find((trait) =>
      traitName(trait).replace(/^Feat:\s*/iu, "").trim().toLowerCase() === name.toLowerCase());
    const description = text(feat.description)
      ?? (matchingTrait ? traitDescription(matchingTrait) : null);
    const fullParsed = record(feat.parsed);
    const parsed = compactBackgroundFeatMechanics(fullParsed);
    return [{
      name,
      ...(description ? { description } : {}),
      parsed,
      ...(list(feat.scalingRolls ?? matchingTrait?.scalingRolls).length > 0
        ? { scalingRolls: compactFeatValue(feat.scalingRolls ?? matchingTrait?.scalingRolls) }
        : {}),
      ...(list(feat.preparedSpellProgression ?? matchingTrait?.preparedSpellProgression).length > 0
        ? {
            preparedSpellProgression: compactFeatValue(
              feat.preparedSpellProgression ?? matchingTrait?.preparedSpellProgression,
            ),
          }
        : {}),
      ...(text(feat.resolution ?? fullParsed.resolution ?? matchingTrait?.resolution)
        ? { resolution: feat.resolution ?? fullParsed.resolution ?? matchingTrait?.resolution }
        : {}),
    }];
  });
  const featChoice = Number(proficiencies.featChoice);
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
    ...(feats.length > 0 ? { feats } : {}),
    ...(Number.isInteger(featChoice) && featChoice > 0 ? { featChoice } : {}),
    ...(nonEmptyStrings(proficiencies.abilityScores).length > 0
      ? { abilityScores: nonEmptyStrings(proficiencies.abilityScores) }
      : {}),
    ...(Number.isInteger(abilityScoreChoose) && abilityScoreChoose > 0
      ? { abilityScoreChoose }
      : {}),
  };

  const remainingTraits = traits.flatMap((trait) => {
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

export function expandBackgroundProficiencies(value: unknown): JsonRecord {
  const proficiencies = record(value);
  return {
    skills: expandBackgroundChoice(proficiencies.skills),
    tools: expandBackgroundChoice(proficiencies.tools),
    languages: expandBackgroundChoice(proficiencies.languages),
    feats: list(proficiencies.feats).map((rawFeat) => {
      const feat = record(rawFeat);
      const name = text(feat.name) ?? "";
      return {
        ...feat,
        parsed: expandBackgroundFeatMechanics(feat.parsed, name),
      };
    }),
    featChoice: Number.isInteger(proficiencies.featChoice) ? proficiencies.featChoice : 0,
    abilityScores: nonEmptyStrings(proficiencies.abilityScores),
    abilityScoreChoose: Number.isInteger(proficiencies.abilityScoreChoose)
      ? proficiencies.abilityScoreChoose
      : 0,
  };
}
