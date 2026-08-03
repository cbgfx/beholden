import { assertGrandCompendiumEntry, isGrandCompendiumEntry } from "./grandCompendium.js";
import {
  NATIVE_COMPENDIUM_CATEGORIES,
  isNativeCompendiumCategory,
} from "@beholden/shared/domain/compendium/nativeCompendiumKey";
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
  const category = String(root.category ?? "");
  if (!isNativeCompendiumCategory(category)) throw new Error(`Unknown compendium category: ${category || "missing"}.`);
  if (!Array.isArray(root.entries)) throw new Error("Compendium entries must be an array.");
  const entries = root.entries.map((entry, index) => {
    const parsed = asRecord(entry, `Entry ${index + 1}`);
    if (!isGrandCompendiumEntry(category, parsed)) assertGrandCompendiumEntry(category, parsed, index);
    return parsed;
  });
  entries.forEach((entry, index) => assertGrandCompendiumEntry(category, entry, index));
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    const id = requiredText(entry.id, `Entry ${index + 1}.id`);
    if (ids.has(id)) throw new Error(`${category} entry ${index + 1} duplicates id "${id}".`);
    ids.add(id);
  });
  return {
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    schema: BEHOLDEN_COMPENDIUM_SCHEMA,
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
  const exportedAt = optionalText(root.exportedAt) ?? new Date().toISOString();
  return categories.map((category) => {
    if (!Array.isArray(root[category])) throw new Error(`Compendium ${category} must be an array.`);
    return parseNativeCompendiumBatch({
      format: BEHOLDEN_COMPENDIUM_FORMAT,
      schema: BEHOLDEN_COMPENDIUM_SCHEMA,
      category,
      exportedAt,
      entries: root[category],
    });
  });
}
