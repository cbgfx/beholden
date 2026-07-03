import { isCanonicalV2Entry } from "./nativeCompendiumV2Schemas.js";
import { type JsonRecord, record, list, text, number, abilityKey, split } from "./nativeCompendiumV2.helpers.js";
import { traitsToV2 } from "./nativeCompendiumV2.traits.js";
import { compactSpeciesEntry } from "./speciesCompaction.js";

export function speciesToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Entry("species", entry)) return entry;
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

