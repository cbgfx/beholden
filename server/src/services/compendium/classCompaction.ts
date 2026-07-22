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

function compactFeature(raw: unknown): JsonRecord {
  const feature = record(raw);
  const compact: JsonRecord = {
    id: feature.id,
    name: feature.name,
    description: String(feature.description ?? ""),
  };
  const source = text(feature.source);
  if (source) compact.source = source;
  const subclass = text(feature.subclass);
  if (subclass) compact.subclass = subclass;
  if (feature.talent && typeof feature.talent === "object" && !Array.isArray(feature.talent)) compact.talent = feature.talent;
  const choices = list(feature.choices);
  if (choices.length > 0) compact.choices = choices;
  const effects = list(feature.effects);
  if (effects.length > 0) compact.effects = effects;
  const scalingRolls = list(feature.scalingRolls).map(compactScalingRoll);
  if (scalingRolls.length > 0) compact.scalingRolls = scalingRolls;
  const psp = list(feature.preparedSpellProgression);
  if (psp.length > 0) compact.preparedSpellProgression = psp;
  const resolution = feature.resolution;
  if (resolution === "automatic" || resolution === "manual" || resolution === "mixed") {
    compact.resolution = resolution;
  }
  const resolutionNotes = list(feature.resolutionNotes).map(String).filter(Boolean);
  if (resolutionNotes.length > 0) compact.resolutionNotes = resolutionNotes;
  return compact;
}

function compactResource(raw: unknown): JsonRecord {
  const r = record(raw);
  const compact: JsonRecord = { name: r.name, uses: r.uses };
  if (r.recovery && r.recovery !== "long_rest") compact.recovery = r.recovery;
  const subclass = text(r.subclass);
  if (subclass) compact.subclass = subclass;
  return compact;
}

function compactLevel(raw: unknown): JsonRecord {
  const level = record(raw);
  const compact: JsonRecord = { level: level.level };
  if (level.abilityScoreImprovement === true) compact.abilityScoreImprovement = true;
  if (level.cantripsKnown != null) compact.cantripsKnown = level.cantripsKnown;
  if (level.spellsPrepared != null) compact.spellsPrepared = level.spellsPrepared;
  const spellSlots = record(level.spellSlots);
  if (Object.keys(spellSlots).length > 0) compact.spellSlots = spellSlots;
  const features = list(level.features).map(compactFeature);
  if (features.length > 0) compact.features = features;
  const resources = list(level.resources).map(compactResource);
  if (resources.length > 0) compact.resources = resources;
  return compact;
}

function compactTools(tools: JsonRecord): JsonRecord | undefined {
  const fixed = list(tools.fixed).map(String).filter(Boolean);
  const choices = list(tools.choices);
  const notes = list(tools.notes).map(String).filter(Boolean);
  if (fixed.length === 0 && choices.length === 0 && notes.length === 0) return undefined;
  const compact: JsonRecord = {};
  if (fixed.length > 0) compact.fixed = fixed;
  if (choices.length > 0) compact.choices = choices;
  if (notes.length > 0) compact.notes = notes;
  return compact;
}

export function compactClassEntry(entry: JsonRecord): JsonRecord {
  const proficiencies = record(entry.proficiencies);
  const compact: JsonRecord = {
    id: entry.id,
    ruleset: entry.ruleset ?? "5.5e",
    name: entry.name,
  };
  const source = text(entry.source);
  if (source) compact.source = source;
  compact.description = String(entry.description ?? "");
  const descriptions = list(entry.descriptions).map(String).filter(Boolean);
  // Omit descriptions when it is just a restatement of description.
  if (descriptions.length > 1 || (descriptions.length === 1 && descriptions[0] !== compact.description)) {
    compact.descriptions = descriptions;
  }
  if (entry.hitDie != null) compact.hitDie = entry.hitDie;
  if (entry.startingWealth != null) compact.startingWealth = entry.startingWealth;
  compact.primaryAbility = entry.primaryAbility;
  if (entry.equipment && typeof entry.equipment === "object" && !Array.isArray(entry.equipment)) compact.equipment = entry.equipment;
  if (entry.multiclass && typeof entry.multiclass === "object" && !Array.isArray(entry.multiclass)) compact.multiclass = entry.multiclass;
  if (entry.subclasses && typeof entry.subclasses === "object" && !Array.isArray(entry.subclasses)) compact.subclasses = entry.subclasses;
  const choices = list(entry.choices);
  if (choices.length > 0) compact.choices = choices;
  if (entry.spellLists && typeof entry.spellLists === "object" && !Array.isArray(entry.spellLists)) compact.spellLists = entry.spellLists;
  const profCompact: JsonRecord = {
    savingThrows: list(proficiencies.savingThrows),
    skills: proficiencies.skills,
    armor: list(proficiencies.armor),
    weapons: list(proficiencies.weapons),
  };
  const tools = compactTools(record(proficiencies.tools));
  if (tools !== undefined) profCompact.tools = tools;
  compact.proficiencies = profCompact;
  const spellcasting = record(entry.spellcasting);
  if (spellcasting.ability != null) {
    const spellcastingCompact: JsonRecord = { ability: spellcasting.ability };
    if (spellcasting.list != null) spellcastingCompact.list = spellcasting.list;
    if (spellcasting.slotRecovery && spellcasting.slotRecovery !== "long_rest") spellcastingCompact.slotRecovery = spellcasting.slotRecovery;
    if (spellcasting.preparedSpellChanges) spellcastingCompact.preparedSpellChanges = spellcasting.preparedSpellChanges;
    if (spellcasting.preparedFormula) spellcastingCompact.preparedFormula = spellcasting.preparedFormula;
    compact.spellcasting = spellcastingCompact;
  }
  compact.levels = list(entry.levels).map(compactLevel);
  return compact;
}
