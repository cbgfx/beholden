import {
  compactBackgroundEntry,
  expandBackgroundProficiencies,
} from "./backgroundCompaction.js";
import { isCanonicalV2Entry } from "./nativeCompendiumV2Schemas.js";
import { type JsonRecord, record, list, text } from "./nativeCompendiumV2.helpers.js";

export function backgroundToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Entry("backgrounds", entry)) return entry;
  return compactBackgroundEntry(entry);
}

export function backgroundFromV2(entry: JsonRecord): JsonRecord {
  const compact = compactBackgroundEntry(entry);
  const proficiencies = expandBackgroundProficiencies(compact.proficiencies);
  const equipment = record(compact.equipment);
  const equipmentOptions = list(equipment.options);
  const equipmentDescription = text(equipment.description)
    ?? (equipmentOptions.length > 0 ? "Structured starting equipment" : "");
  const traits = [
    ...(text(compact.description)
      ? [{ name: "Description", text: compact.description }]
      : []),
    ...list(record(compact.proficiencies).feats).map((rawFeat) => {
      const feat = record(rawFeat);
      return {
        name: `Feat: ${text(feat.name) ?? "Feat"}`,
        text: text(feat.description) ?? "",
        scalingRolls: list(feat.scalingRolls),
        preparedSpellProgression: list(feat.preparedSpellProgression),
        resolution: feat.resolution,
      };
    }),
    ...list(compact.traits).map((trait) => {
      const value = record(trait);
      return {
        ...value,
        text: value.description,
      };
    }),
  ];
  return {
    id: compact.id,
    name: compact.name,
    source: compact.source ?? null,
    description: compact.description,
    proficiencies,
    proficiency: "",
    equipment: equipmentDescription,
    equipmentOptions,
    traits,
  };
}
