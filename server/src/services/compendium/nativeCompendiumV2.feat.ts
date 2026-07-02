import { classifyFeatResolution } from "../../lib/featResolution.js";
import { CANONICAL_V2_SCHEMA_VERSION } from "./nativeCompendiumV2Schemas.js";
import { isCanonicalV2Shape, upgradeCanonicalV2Entry } from "./nativeCompendiumV2Migration.js";
import { type JsonRecord, record, list, text } from "./nativeCompendiumV2.helpers.js";
import { compactFeatEntry, expandFeatMechanics } from "./featCompaction.js";

export function featToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Shape("feats", entry)) return compactFeatEntry(upgradeCanonicalV2Entry("feats", entry));
  const parsed = record(entry.parsed);
  const classified = classifyFeatResolution(String(entry.name ?? ""), parsed);
  const fullMechanics = "baseName" in parsed ? expandFeatMechanics(parsed, entry) : parsed;
  return compactFeatEntry({
    schemaVersion: CANONICAL_V2_SCHEMA_VERSION,
    id: text(entry.id),
    name: text(entry.name),
    source: text(entry.source ?? parsed.source) ?? null,
    category: text(entry.category ?? parsed.category) ?? null,
    prerequisite: entry.prerequisite ?? parsed.prerequisite ?? null,
    repeatable: entry.repeatable === true || parsed.repeatable === true,
    description: (text(entry.text) ?? "").replace(/(?:^|\n)Source:\s*[^\n]+\s*$/iu, "").trim(),
    resolution: entry.resolution ?? parsed.resolution ?? classified.resolution,
    resolutionNotes: list(entry.resolutionNotes ?? parsed.resolutionNotes ?? classified.resolutionNotes),
    mechanics: fullMechanics,
  });
}

export function featFromV2(entry: JsonRecord): JsonRecord {
  const mechanics = expandFeatMechanics(entry.mechanics, entry);
  const classified = classifyFeatResolution(String(entry.name ?? ""), mechanics);
  const resolution = entry.resolution ?? mechanics.resolution ?? classified.resolution;
  const resolutionNotes = entry.resolutionNotes ?? mechanics.resolutionNotes ?? classified.resolutionNotes;
  return {
    id: entry.id,
    name: entry.name,
    source: entry.source,
    category: entry.category,
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
