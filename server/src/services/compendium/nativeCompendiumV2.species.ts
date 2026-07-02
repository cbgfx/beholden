import { isCanonicalV2Shape, upgradeCanonicalV2Entry } from "./nativeCompendiumV2Migration.js";
import { type JsonRecord, record, list, text, number, abilityKey, split } from "./nativeCompendiumV2.helpers.js";
import { traitsToV2, traitsFromV2 } from "./nativeCompendiumV2.traits.js";
import { compactSpeciesEntry } from "./speciesCompaction.js";

export function speciesToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Shape("species", entry)) return upgradeCanonicalV2Entry("species", entry);
  return compactSpeciesEntry({
    id: text(entry.id),
    name: text(entry.name),
    source: text(entry.source),
    size: text(entry.size),
    speed: number(entry.speed),
    spellcastingAbility: abilityKey(entry.spellAbility),
    resistances: split(entry.resist),
    vision: list(entry.vision).map((raw) => {
      const vision = record(raw);
      return { type: text(vision.type), range: number(vision.range) };
    }),
    choices: record(entry.parsedChoices),
    traits: traitsToV2(entry.traits),
  });
}

export function speciesFromV2(entry: JsonRecord): JsonRecord {
  return {
    id: entry.id,
    name: entry.name,
    source: entry.source,
    size: entry.size,
    speed: entry.speed,
    spellAbility: entry.spellcastingAbility,
    resist: list(entry.resistances).join(", "),
    vision: entry.vision,
    parsedChoices: entry.choices,
    traits: traitsFromV2(entry.traits),
  };
}
