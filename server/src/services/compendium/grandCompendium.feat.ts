import { type JsonRecord } from "./grandCompendium.helpers.js";
import { expandFeatMechanics, featCategoryLabel } from "./featCompaction.js";

export function projectGrandFeat(entry: JsonRecord): JsonRecord {
  const mechanics = expandFeatMechanics(entry.mechanics, entry);
  const resolution = entry.resolution;
  const resolutionNotes = entry.resolutionNotes;
  return {
    id: entry.id,
    name: entry.name,
    source: entry.source,
    category: featCategoryLabel(entry.category),
    prerequisite: entry.prerequisite,
    repeatable: entry.repeatable === true,
    text: entry.description,
    resolution,
    resolutionNotes,
    parsed: {
      ...mechanics,
      resolution,
      resolutionNotes,
    },
  };
}
