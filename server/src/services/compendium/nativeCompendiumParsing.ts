import { assertGrandCompendiumEntry, isGrandCompendiumEntry } from "./grandCompendium.js";
import { compactClassEntry } from "./classCompaction.js";
import { compactFeatEntry } from "./featCompaction.js";
import { GRAND_COMPENDIUM_SCHEMA_VERSION } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import {
  NATIVE_COMPENDIUM_CATEGORIES,
  isNativeCompendiumCategory,
  nativeEntryKey,
  type NativeCompendiumCategory,
} from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import type { JsonRecord } from "../../lib/jsonRecord.js";
import {
  BEHOLDEN_COMPENDIUM_FORMAT,
  BEHOLDEN_COMPENDIUM_SCHEMA,
  asRecord,
  optionalText,
  requiredText,
  type NativeCompendiumBatch,
} from "./nativeCompendiumShared.js";

export function parseNativeCompendiumBatch(value: unknown): NativeCompendiumBatch {
  const root = asRecord(value, "Compendium document");
  if (root.format !== BEHOLDEN_COMPENDIUM_FORMAT) throw new Error(`Expected format "${BEHOLDEN_COMPENDIUM_FORMAT}".`);
  if (root.schema !== BEHOLDEN_COMPENDIUM_SCHEMA) throw new Error(`Expected Grand Schema compendium (schema "${BEHOLDEN_COMPENDIUM_SCHEMA}").`);
  const documentVersion = readGrandSchemaVersion(root.version);
  const category = String(root.category ?? "");
  if (!isNativeCompendiumCategory(category)) throw new Error(`Unknown compendium category: ${category || "missing"}.`);
  if (!Array.isArray(root.entries)) throw new Error("Compendium entries must be an array.");
  const entries = root.entries.map((entry, index) => {
    const source = migrateLegacyEntryVersion(category, asRecord(entry, `Entry ${index + 1}`), root.version === undefined, index);
    const parsed = category === "feats" ? compactFeatEntry(source) : category === "classes" ? compactClassEntry(source) : source;
    if (!isGrandCompendiumEntry(category, parsed)) assertGrandCompendiumEntry(category, parsed, index);
    return parsed;
  });
  entries.forEach((entry, index) => assertGrandCompendiumEntry(category, entry, index));
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    const id = requiredText(entry.id, `Entry ${index + 1}.id`);
    const key = nativeEntryKey(category, { id, ruleset: requiredText(entry.ruleset, `Entry ${index + 1}.ruleset`) });
    if (ids.has(key)) throw new Error(`${category} entry ${index + 1} duplicates id "${id}" in ruleset "${entry.ruleset}".`);
    ids.add(key);
  });
  return {
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    schema: BEHOLDEN_COMPENDIUM_SCHEMA,
    version: documentVersion,
    category,
    exportedAt: optionalText(root.exportedAt) ?? new Date().toISOString(),
    entries,
  };
}

export function parseNativeCompendiumDocument(value: unknown): NativeCompendiumBatch[] {
  const root = asRecord(value, "Compendium document");
  const categories = NATIVE_COMPENDIUM_CATEGORIES.filter((category) => root[category] !== undefined);
  if (categories.length === 0) return [parseNativeCompendiumBatch(root)];
  if (root.format !== BEHOLDEN_COMPENDIUM_FORMAT) throw new Error(`Expected format "${BEHOLDEN_COMPENDIUM_FORMAT}".`);
  if (root.schema !== BEHOLDEN_COMPENDIUM_SCHEMA) throw new Error(`Expected Grand Schema compendium (schema "${BEHOLDEN_COMPENDIUM_SCHEMA}").`);
  const version = readGrandSchemaVersion(root.version);
  const exportedAt = optionalText(root.exportedAt) ?? new Date().toISOString();
  return categories.map((category) => {
    if (!Array.isArray(root[category])) throw new Error(`Compendium ${category} must be an array.`);
    return parseNativeCompendiumBatch({
      format: BEHOLDEN_COMPENDIUM_FORMAT,
      schema: BEHOLDEN_COMPENDIUM_SCHEMA,
      ...(root.version === undefined ? {} : { version }),
      category,
      exportedAt,
      entries: root[category],
    });
  });
}

function readGrandSchemaVersion(value: unknown): typeof GRAND_COMPENDIUM_SCHEMA_VERSION {
  if (value === undefined) return GRAND_COMPENDIUM_SCHEMA_VERSION;
  if (value !== GRAND_COMPENDIUM_SCHEMA_VERSION) throw new Error(`Unsupported Grand compendium version: ${String(value)}.`);
  return GRAND_COMPENDIUM_SCHEMA_VERSION;
}

function migrateLegacyEntryVersion(
  category: NativeCompendiumCategory,
  entry: JsonRecord,
  legacyEnvelope: boolean,
  index: number,
): JsonRecord {
  if (category !== "decks" && category !== "bastions") return entry;
  if (entry.schemaVersion !== undefined && entry.schemaVersion !== GRAND_COMPENDIUM_SCHEMA_VERSION) {
    throw new Error(`${category} entry ${index + 1} has unsupported schemaVersion ${String(entry.schemaVersion)}.`);
  }
  if (legacyEnvelope && entry.schemaVersion !== GRAND_COMPENDIUM_SCHEMA_VERSION) {
    throw new Error(`${category} entry ${index + 1} requires legacy schemaVersion ${GRAND_COMPENDIUM_SCHEMA_VERSION}.`);
  }
  if (entry.schemaVersion === undefined) return entry;
  const { schemaVersion: _legacyVersion, ...canonical } = entry;
  return canonical;
}
