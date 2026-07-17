import { type JsonRecord, list, record } from "../../lib/jsonRecord.js";

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function compactScalingRoll(raw: unknown): JsonRecord {
  const roll = record(raw);
  const compact: JsonRecord = { formula: roll.formula };
  const desc = text(roll.description);
  if (desc) compact.description = desc;
  if (roll.level != null) compact.level = roll.level;
  return compact;
}

function compactChoices(value: unknown): JsonRecord | undefined {
  const c = record(value);
  const compact: JsonRecord = {};
  if (c.hasChosenSize === true) compact.hasChosenSize = true;
  if (c.hasFeatChoice === true) compact.hasFeatChoice = true;
  if (c.skillChoice != null) compact.skillChoice = c.skillChoice;
  if (c.toolChoice != null) compact.toolChoice = c.toolChoice;
  if (c.languageChoice != null) compact.languageChoice = c.languageChoice;
  if (c.spellcastingAbilityChoice != null) compact.spellcastingAbilityChoice = c.spellcastingAbilityChoice;
  return Object.keys(compact).length > 0 ? compact : undefined;
}

export function compactTrait(raw: unknown): JsonRecord {
  const trait = record(raw);
  const compact: JsonRecord = {
    id: trait.id,
    name: trait.name,
    description: String(trait.description ?? ""),
  };
  const category = text(trait.category);
  if (category) compact.category = category;
  const scalingRolls = list(trait.scalingRolls).map(compactScalingRoll);
  if (scalingRolls.length > 0) compact.scalingRolls = scalingRolls;
  const psp = list(trait.preparedSpellProgression);
  if (psp.length > 0) compact.preparedSpellProgression = psp;
  const effects = list(trait.effects);
  if (effects.length > 0) compact.effects = effects;
  const resolution = trait.resolution;
  if (resolution === "automatic" || resolution === "manual" || resolution === "mixed") {
    compact.resolution = resolution;
  }
  const resolutionNotes = list(trait.resolutionNotes).map(String).filter(Boolean);
  if (resolutionNotes.length > 0) compact.resolutionNotes = resolutionNotes;
  return compact;
}

export function compactSpeciesEntry(entry: JsonRecord): JsonRecord {
  const compact: JsonRecord = {
    id: entry.id,
    name: entry.name,
  };
  const source = text(entry.source);
  if (source) compact.source = source;
  if (entry.size != null) compact.size = entry.size;
  const creatureType = text(entry.creatureType);
  if (creatureType) compact.creatureType = creatureType;
  compact.speed = entry.speed;
  if (entry.spellcastingAbility != null) compact.spellcastingAbility = entry.spellcastingAbility;
  const resistances = list(entry.resistances).map(String).filter(Boolean);
  if (resistances.length > 0) compact.resistances = resistances;
  const vision = list(entry.vision).map((raw) => {
    const v = record(raw);
    const vCompact: JsonRecord = {};
    if (v.type != null) vCompact.type = v.type;
    if (v.range != null) vCompact.range = v.range;
    return vCompact;
  });
  if (vision.length > 0) compact.vision = vision;
  const choices = compactChoices(entry.choices);
  if (choices !== undefined) compact.choices = choices;
  compact.traits = list(entry.traits).map(compactTrait);
  return compact;
}
