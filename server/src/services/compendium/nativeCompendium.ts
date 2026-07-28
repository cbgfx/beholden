import type Database from "better-sqlite3";
import { normalizeKey } from "../../lib/text.js";
import { crRatingToNumber } from "@beholden/shared/domain/monsters";
import {
  assertGrandCompendiumEntry,
  projectGrandSpell,
} from "./grandCompendium.js";
import { isGrandCompendiumEntry } from "./grandCompendium.js";
import { GRAND_COMPENDIUM_SCHEMA_VERSION } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { type JsonRecord, record } from "../../lib/jsonRecord.js";
import { assertNativeCompendiumGuardrails } from "./nativeCompendiumGuardrails.js";
import {
  NATIVE_COMPENDIUM_CATEGORIES,
  isNativeCompendiumCategory,
  nativeEntryKey,
  type NativeCompendiumCategory,
} from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import { computeContentHashSync } from "@beholden/shared/domain/compendium/computeContentHashSync";

export { NATIVE_COMPENDIUM_CATEGORIES, isNativeCompendiumCategory, type NativeCompendiumCategory };

export const BEHOLDEN_COMPENDIUM_FORMAT = "beholden.compendium";
export const BEHOLDEN_COMPENDIUM_SCHEMA = "grand";

export type NativeCompendiumBatch = {
  format: typeof BEHOLDEN_COMPENDIUM_FORMAT;
  schema: typeof BEHOLDEN_COMPENDIUM_SCHEMA;
  category: NativeCompendiumCategory;
  exportedAt: string;
  entries: JsonRecord[];
};

export type NativeCompendiumBundle = {
  format: typeof BEHOLDEN_COMPENDIUM_FORMAT;
  schema: typeof BEHOLDEN_COMPENDIUM_SCHEMA;
  exportedAt: string;
} & Partial<Record<NativeCompendiumCategory, JsonRecord[]>>;

export type NativeCompendiumDocument = NativeCompendiumBatch | NativeCompendiumBundle;

export type NativeCompendiumImportResult = {
  category: NativeCompendiumCategory;
  imported: number;
  total: number;
};

export type NativeCompendiumDocumentImportResult = {
  imported: number;
  total: number;
  batches: NativeCompendiumImportResult[];
};

export type NativeCompendiumPreview = {
  entries: number;
  additions: number;
  /** additions excluded; equals changed + unchanged. Kept for backward compatibility. */
  replacements: number;
  /** Of the replacements, how many actually differ in content from what's already stored. */
  changed: number;
  /** Of the replacements, how many are byte-identical to what's already stored (a no-op). */
  unchanged: number;
  batches: Array<{
    category: NativeCompendiumCategory;
    entries: number;
    additions: number;
    replacements: number;
    changed: number;
    unchanged: number;
  }>;
};

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function requiredText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown, fallback = 0): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function parseJsonRecord(value: unknown): JsonRecord {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function makeId(prefix: string, name: string): string {
  const key = normalizeKey(name)
    .replace(/[^a-z0-9[\].'()-]+/giu, "_")
    .replace(/^_+|_+$/gu, "");
  return `${prefix}${key || "entry"}`;
}

function idOrGenerated(entry: JsonRecord, prefix: string, name: string): string {
  return optionalText(entry.id) ?? makeId(prefix, name);
}

function canonicalNameKey(entry: JsonRecord, name: string): string {
  return optionalText(entry.nameKey ?? entry.name_key) ?? normalizeKey(name);
}

function mergeExportEntry(
  category: NativeCompendiumCategory,
  row: JsonRecord,
): JsonRecord {
  const blob = parseJsonRecord(row.data_json);
  if (isGrandCompendiumEntry(category, blob)) return blob;
  assertGrandCompendiumEntry(category, blob, 0);
  return blob;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function parseNativeCompendiumBatch(value: unknown): NativeCompendiumBatch {
  const root = asRecord(value, "Compendium document");
  if (root.format !== BEHOLDEN_COMPENDIUM_FORMAT) {
    throw new Error(`Expected format "${BEHOLDEN_COMPENDIUM_FORMAT}".`);
  }
  if (root.schema !== BEHOLDEN_COMPENDIUM_SCHEMA) {
    throw new Error(`Expected Grand Schema compendium (schema "${BEHOLDEN_COMPENDIUM_SCHEMA}").`);
  }
  const category = String(root.category ?? "");
  if (!isNativeCompendiumCategory(category)) {
    throw new Error(`Unknown compendium category: ${category || "missing"}.`);
  }
  if (!Array.isArray(root.entries)) {
    throw new Error("Compendium entries must be an array.");
  }
  const entries = root.entries.map((entry, index) => {
    const parsed = asRecord(entry, `Entry ${index + 1}`);
    if (!isGrandCompendiumEntry(category, parsed)) {
      assertGrandCompendiumEntry(category, parsed, index);
    }
    return parsed;
  });
  entries.forEach((entry, index) => assertGrandCompendiumEntry(category, entry, index));
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    const id = requiredText(entry.id, `Entry ${index + 1}.id`);
    if (ids.has(id)) {
      throw new Error(`${category} entry ${index + 1} duplicates id "${id}".`);
    }
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
  const flatCategories = NATIVE_COMPENDIUM_CATEGORIES.filter((category) => root[category] !== undefined);
  if (flatCategories.length > 0) {
    if (root.format !== BEHOLDEN_COMPENDIUM_FORMAT) {
      throw new Error(`Expected format "${BEHOLDEN_COMPENDIUM_FORMAT}".`);
    }
    if (root.schema !== BEHOLDEN_COMPENDIUM_SCHEMA) {
      throw new Error(`Expected Grand Schema compendium (schema "${BEHOLDEN_COMPENDIUM_SCHEMA}").`);
    }
    const exportedAt = optionalText(root.exportedAt) ?? new Date().toISOString();
    return flatCategories.map((category) => {
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
  return [parseNativeCompendiumBatch(root)];
}

/** Categories whose rows carry a single `data_json` blob that is exactly `JSON.stringify(entry)`
 * as written at import time (see importParsedNativeCompendiumBatch) -- an incoming entry can be
 * compared against it directly to tell a real content change from a no-op re-upload. "decks" and
 * "bastions" store their fields denormalized across columns (bastions across three separate
 * tables) with no single comparable blob, so they fall back to presence-only detection below. */
const CONTENT_COMPARABLE_QUERIES: Partial<Record<NativeCompendiumCategory, string>> = {
  monsters: "SELECT id, ruleset, data_json FROM compendium_monsters",
  items: "SELECT id, ruleset, data_json FROM compendium_items",
  spells: "SELECT id, ruleset, data_json FROM compendium_spells",
  classTalents: "SELECT id, ruleset, data_json FROM compendium_class_talents",
  classes: "SELECT id, ruleset, data_json FROM compendium_classes",
  species: "SELECT id, ruleset, data_json FROM compendium_races",
  backgrounds: "SELECT id, ruleset, data_json FROM compendium_backgrounds",
  feats: "SELECT id, ruleset, data_json FROM compendium_feats",
};

const PRESENCE_ONLY_QUERIES: Partial<Record<NativeCompendiumCategory, string[]>> = {
  decks: ["SELECT id, ruleset FROM compendium_deck_cards"],
  bastions: [
    "SELECT id, ruleset FROM compendium_bastion_spaces",
    "SELECT id, ruleset FROM compendium_bastion_orders",
    "SELECT id, ruleset FROM compendium_bastion_facilities",
  ],
};

/** Table names for the same 8 categories as CONTENT_COMPARABLE_QUERIES -- used by the manifest
 * endpoint to backfill `content_hash` on rows written before that column existed. Decks/bastions
 * are out of scope for the manifest feature. */
const CONTENT_HASH_TABLE_NAMES: Partial<Record<NativeCompendiumCategory, string>> = {
  monsters: "compendium_monsters",
  items: "compendium_items",
  spells: "compendium_spells",
  classTalents: "compendium_class_talents",
  classes: "compendium_classes",
  species: "compendium_races",
  backgrounds: "compendium_backgrounds",
  feats: "compendium_feats",
};

/** Maps each existing row's identity key to its stored `data_json` (for content comparison), or
 * `null` when the category doesn't support that (see CONTENT_COMPARABLE_QUERIES above). */
function existingNativeContent(
  db: Database.Database,
  category: NativeCompendiumCategory,
): Map<string, string | null> {
  const contentQuery = CONTENT_COMPARABLE_QUERIES[category];
  if (contentQuery) {
    const rows = db.prepare(contentQuery).all() as Array<{ id: string; ruleset: string; data_json: string }>;
    return new Map(rows.map((row) => [nativeEntryKey(category, row), row.data_json]));
  }
  const presenceQueries = PRESENCE_ONLY_QUERIES[category] ?? [];
  const map = new Map<string, string | null>();
  for (const sql of presenceQueries) {
    for (const row of db.prepare(sql).all() as Array<{ id: string; ruleset: string }>) {
      map.set(nativeEntryKey(category, row), null);
    }
  }
  return map;
}

/** Native compendium manifest version: the client and server must agree on this before a manifest
 * exchange is honored, leaving room to change the hashing algorithm/payload shape later without
 * an old client and a new server silently talking past each other. */
export const NATIVE_COMPENDIUM_MANIFEST_VERSION = 1;

export type NativeCompendiumManifestRequest = {
  version: number;
  category: NativeCompendiumCategory;
  /** nativeEntryKey(category, {id, ruleset}) -> contentHash, for every entry the client is about
   * to import. */
  hashes: Record<string, string>;
};

export type NativeCompendiumManifestResult = {
  /** Keys (nativeEntryKey format) the client should actually include in its upload -- either
   * absent server-side (new) or present with a different contentHash (changed). */
  upload: string[];
};

/** Maps each existing row's identity key to its `content_hash`, computing and persisting it on
 * the fly for any row written before that column existed (see
 * compendiumContentHashColumnMigration.ts) -- a strictly opportunistic, one-time-per-row cost.
 * Only the 8 content-comparable categories are supported; decks/bastions are out of scope for
 * the manifest feature. */
export function resolveNativeContentHashes(
  db: Database.Database,
  category: NativeCompendiumCategory,
): Map<string, string> {
  const table = CONTENT_HASH_TABLE_NAMES[category];
  if (!table) return new Map();
  return db.transaction(() => {
    const rows = db.prepare(
      `SELECT rowid, id, ruleset, data_json, content_hash FROM ${table}`,
    ).all() as Array<{ rowid: number; id: string; ruleset: string; data_json: string; content_hash: string | null }>;
    const backfill = db.prepare(`UPDATE ${table} SET content_hash = ? WHERE rowid = ?`);
    const result = new Map<string, string>();
    for (const row of rows) {
      let hash = row.content_hash;
      if (!hash) {
        hash = computeContentHashSync(parseJsonRecord(row.data_json));
        backfill.run(hash, row.rowid);
      }
      result.set(nativeEntryKey(category, row), hash);
    }
    return result;
  })();
}

/** Compares a client's manifest of `{key: contentHash}` against what's actually stored and
 * returns only the keys that need a real upload (new or changed). Rejects unsupported manifest
 * versions and categories with no content-hash support (decks/bastions) explicitly rather than
 * silently telling the client to upload everything or nothing. */
export function resolveNativeCompendiumManifest(
  db: Database.Database,
  request: NativeCompendiumManifestRequest,
): NativeCompendiumManifestResult {
  if (request.version !== NATIVE_COMPENDIUM_MANIFEST_VERSION) {
    throw new Error(`Unsupported compendium manifest version: ${request.version}.`);
  }
  if (!isNativeCompendiumCategory(request.category)) {
    throw new Error(`Unknown compendium category: ${request.category}.`);
  }
  if (!CONTENT_HASH_TABLE_NAMES[request.category]) {
    throw new Error(`Compendium category "${request.category}" does not support manifest diffing.`);
  }
  const stored = resolveNativeContentHashes(db, request.category);
  const upload = Object.entries(request.hashes)
    .filter(([key, hash]) => stored.get(key) !== hash)
    .map(([key]) => key);
  return { upload };
}

export function previewNativeCompendiumDocument(
  db: Database.Database,
  input: NativeCompendiumDocument | unknown,
): NativeCompendiumPreview {
  const batches = parseNativeCompendiumDocument(input);
  assertNativeCompendiumGuardrails(db, batches);
  return previewValidatedNativeCompendiumBatches(db, batches);
}

export function previewValidatedNativeCompendiumBatches(
  db: Database.Database,
  batches: NativeCompendiumBatch[],
): NativeCompendiumPreview {
  const existingByCategory = new Map<NativeCompendiumCategory, Map<string, string | null>>();
  const previewBatches = batches.map((batch) => {
    const existing = existingByCategory.get(batch.category)
      ?? existingNativeContent(db, batch.category);
    existingByCategory.set(batch.category, existing);
    let additions = 0;
    let changed = 0;
    let unchanged = 0;
    for (const entry of batch.entries) {
      const key = nativeEntryKey(batch.category, { id: String(entry.id), ruleset: entry.ruleset ? String(entry.ruleset) : undefined });
      if (!existing.has(key)) {
        additions++;
        continue;
      }
      const storedJson = existing.get(key)!;
      // storedJson is null for categories with no single comparable blob (decks, bastions) --
      // treated as changed, matching the old presence-only "exists = replacement" behavior.
      if (storedJson !== null && storedJson === JSON.stringify(entry)) unchanged++;
      else changed++;
    }
    return {
      category: batch.category,
      entries: batch.entries.length,
      additions,
      replacements: changed + unchanged,
      changed,
      unchanged,
    };
  });
  return {
    entries: previewBatches.reduce((total, batch) => total + batch.entries, 0),
    additions: previewBatches.reduce((total, batch) => total + batch.additions, 0),
    replacements: previewBatches.reduce((total, batch) => total + batch.replacements, 0),
    changed: previewBatches.reduce((total, batch) => total + batch.changed, 0),
    unchanged: previewBatches.reduce((total, batch) => total + batch.unchanged, 0),
    batches: previewBatches,
  };
}

export function exportNativeCompendiumBundle(
  db: Database.Database,
  categories: Iterable<NativeCompendiumCategory> = NATIVE_COMPENDIUM_CATEGORIES,
  options: { includeEmpty?: boolean } = {},
): NativeCompendiumBundle {
  const exportedAt = new Date().toISOString();
  const batches = Array.from(categories)
    .map((category) => exportNativeCompendiumBatch(db, category))
    .filter((batch) => options.includeEmpty || batch.entries.length > 0)
  const document = {
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    schema: BEHOLDEN_COMPENDIUM_SCHEMA,
    exportedAt,
  } as NativeCompendiumBundle;
  for (const batch of batches) document[batch.category] = batch.entries;
  return document;
}

const exportQueries: Partial<Record<NativeCompendiumCategory, string>> = {
  monsters: "SELECT id, ruleset, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json FROM compendium_monsters ORDER BY name COLLATE NOCASE",
  items: "SELECT id, ruleset, name, name_key, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json FROM compendium_items ORDER BY name COLLATE NOCASE",
  spells: "SELECT id, ruleset, name, name_key, level, school, ritual, concentration, components, classes, data_json FROM compendium_spells ORDER BY name COLLATE NOCASE",
  classTalents: "SELECT id, ruleset, name, name_key, kind, data_json FROM compendium_class_talents ORDER BY kind, name COLLATE NOCASE",
  classes: "SELECT id, ruleset, name, name_key, hd, data_json FROM compendium_classes ORDER BY name COLLATE NOCASE",
  species: "SELECT id, ruleset, name, name_key, size, speed, data_json FROM compendium_races ORDER BY name COLLATE NOCASE",
  backgrounds: "SELECT id, ruleset, name, name_key, data_json FROM compendium_backgrounds ORDER BY name COLLATE NOCASE",
  feats: "SELECT id, ruleset, name, name_key, data_json FROM compendium_feats ORDER BY name COLLATE NOCASE",
};

/** Iterates exported entries without retaining a category-sized database result array. */
export function* iterateNativeCompendiumEntries(
  db: Database.Database,
  category: NativeCompendiumCategory,
): Generator<JsonRecord> {
  const query = exportQueries[category];
  if (query) {
    for (const row of db.prepare(query).iterate() as Iterable<JsonRecord>) {
      yield mergeExportEntry(category, row);
    }
    return;
  }

  if (category === "decks") {
    const rows = db.prepare(
      "SELECT id, ruleset, deck_name, deck_key, card_name, card_key, card_text, sort_index FROM compendium_deck_cards ORDER BY deck_name COLLATE NOCASE, sort_index, card_name COLLATE NOCASE",
    ).iterate() as Iterable<JsonRecord>;
    for (const row of rows) {
      yield {
        schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION,
        ruleset: row.ruleset,
        id: row.id,
        deckName: row.deck_name,
        deckKey: row.deck_key,
        cardName: row.card_name,
        cardKey: row.card_key ?? null,
        text: row.card_text ?? null,
        sort: row.sort_index,
      };
    }
    return;
  }

  const spaces = db.prepare(
    "SELECT id, ruleset, name, name_key, squares, label, sort_index FROM compendium_bastion_spaces ORDER BY sort_index, name COLLATE NOCASE",
  ).iterate() as Iterable<JsonRecord>;
  for (const row of spaces) {
    yield {
      schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION,
      ruleset: row.ruleset,
      kind: "space",
      id: row.id,
      name: row.name,
      nameKey: row.name_key,
      squares: row.squares ?? null,
      label: row.label ?? null,
      sort: row.sort_index,
    };
  }
  const orders = db.prepare(
    "SELECT id, ruleset, order_name, order_key, sort_index FROM compendium_bastion_orders ORDER BY sort_index, order_name COLLATE NOCASE",
  ).iterate() as Iterable<JsonRecord>;
  for (const row of orders) {
    yield {
      schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION,
      ruleset: row.ruleset,
      kind: "order",
      id: row.id,
      name: row.order_name,
      nameKey: row.order_key,
      sort: row.sort_index,
    };
  }
  const facilities = db.prepare(
    "SELECT id, ruleset, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json FROM compendium_bastion_facilities ORDER BY facility_type, minimum_level, name COLLATE NOCASE",
  ).iterate() as Iterable<JsonRecord>;
  for (const row of facilities) {
    yield {
      schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION,
      ruleset: row.ruleset,
      kind: "facility",
      id: row.id,
      name: row.name,
      nameKey: row.name_key,
      facilityType: row.facility_type,
      minimumLevel: row.minimum_level,
      prerequisite: row.prerequisite ?? null,
      orders: parseJsonArray(row.orders_json),
      space: row.space ?? null,
      hirelings: row.hirelings ?? null,
      allowMultiple: bool(row.allow_multiple),
      description: row.description ?? null,
    };
  }
}

export function exportNativeCompendiumBatch(
  db: Database.Database,
  category: NativeCompendiumCategory,
  ids?: Iterable<string>,
): NativeCompendiumBatch {
  let entries: JsonRecord[];

  switch (category) {
    case "monsters":
      entries = (db.prepare(
        "SELECT id, ruleset, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json FROM compendium_monsters ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("monsters", row));
      break;
    case "items":
      entries = (db.prepare(
        "SELECT id, ruleset, name, name_key, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json FROM compendium_items ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("items", row));
      break;
    case "spells":
      entries = (db.prepare(
        "SELECT id, ruleset, name, name_key, level, school, ritual, concentration, components, classes, data_json FROM compendium_spells ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("spells", row));
      break;
    case "classTalents":
      entries = (db.prepare(
        "SELECT id, ruleset, name, name_key, kind, data_json FROM compendium_class_talents ORDER BY kind, name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("classTalents", row));
      break;
    case "classes":
      entries = (db.prepare(
        "SELECT id, ruleset, name, name_key, hd, data_json FROM compendium_classes ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("classes", row));
      break;
    case "species":
      entries = (db.prepare(
        "SELECT id, ruleset, name, name_key, size, speed, data_json FROM compendium_races ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("species", row));
      break;
    case "backgrounds":
      entries = (db.prepare(
        "SELECT id, ruleset, name, name_key, data_json FROM compendium_backgrounds ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("backgrounds", row));
      break;
    case "feats":
      entries = (db.prepare(
        "SELECT id, ruleset, name, name_key, data_json FROM compendium_feats ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("feats", row));
      break;
    case "decks":
      entries = (db.prepare(
        "SELECT id, ruleset, deck_name, deck_key, card_name, card_key, card_text, sort_index FROM compendium_deck_cards ORDER BY deck_name COLLATE NOCASE, sort_index, card_name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => ({
        schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION,
        ruleset: row.ruleset,
        id: row.id,
        deckName: row.deck_name,
        deckKey: row.deck_key,
        cardName: row.card_name,
        cardKey: row.card_key ?? null,
        text: row.card_text ?? null,
        sort: row.sort_index,
      }));
      break;
    case "bastions": {
      const spaces = (db.prepare(
        "SELECT id, ruleset, name, name_key, squares, label, sort_index FROM compendium_bastion_spaces ORDER BY sort_index, name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => ({
        schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION,
        ruleset: row.ruleset,
        kind: "space",
        id: row.id,
        name: row.name,
        nameKey: row.name_key,
        squares: row.squares ?? null,
        label: row.label ?? null,
        sort: row.sort_index,
      }));
      const orders = (db.prepare(
        "SELECT id, ruleset, order_name, order_key, sort_index FROM compendium_bastion_orders ORDER BY sort_index, order_name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => ({
        schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION,
        ruleset: row.ruleset,
        kind: "order",
        id: row.id,
        name: row.order_name,
        nameKey: row.order_key,
        sort: row.sort_index,
      }));
      const facilities = (db.prepare(
        "SELECT id, ruleset, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json FROM compendium_bastion_facilities ORDER BY facility_type, minimum_level, name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => ({
        schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION,
        ruleset: row.ruleset,
        kind: "facility",
        id: row.id,
        name: row.name,
        nameKey: row.name_key,
        facilityType: row.facility_type,
        minimumLevel: row.minimum_level,
        prerequisite: row.prerequisite ?? null,
        orders: parseJsonArray(row.orders_json),
        space: row.space ?? null,
        hirelings: row.hirelings ?? null,
        allowMultiple: bool(row.allow_multiple),
        description: row.description ?? null,
      }));
      entries = [...spaces, ...orders, ...facilities];
      break;
    }
  }

  if (ids) {
    const wanted = new Set(ids);
    entries = entries.filter((entry) => wanted.has(String(entry.id ?? "")));
  }

  return {
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    schema: BEHOLDEN_COMPENDIUM_SCHEMA,
    category,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

/** True when this entry is byte-identical to what's already stored for its (id, ruleset) --
 * lets the writer below skip the INSERT OR REPLACE entirely instead of rewriting a no-op row. */
function isUnchangedNativeEntry(
  existing: Map<string, string | null>,
  category: NativeCompendiumCategory,
  entry: JsonRecord,
  resolvedId: string,
): boolean {
  const key = nativeEntryKey(category, { id: resolvedId, ruleset: entry.ruleset ? String(entry.ruleset) : undefined });
  const stored = existing.get(key);
  return stored != null && stored === JSON.stringify(entry);
}

function importParsedNativeCompendiumBatch(
  db: Database.Database,
  batch: NativeCompendiumBatch,
): NativeCompendiumImportResult {
  const entries = batch.entries;
  const existing = CONTENT_COMPARABLE_QUERIES[batch.category] ? existingNativeContent(db, batch.category) : null;
  let skipped = 0;

  db.transaction(() => {
    switch (batch.category) {
      case "monsters": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_monsters (id, ruleset, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Monster ${index + 1} name`);
          const id = idOrGenerated(entry, "m_", name);
          if (existing && isUnchangedNativeEntry(existing, batch.category, entry, id)) { skipped++; continue; }
          const classification = record(entry.classification);
          const challenge = record(entry.challenge);
          const cr = optionalText(challenge.rating);
          const crNumeric = crRatingToNumber(cr);
          stmt.run(
            id,
            requiredText(entry.ruleset, `Monster ${index + 1} ruleset`),
            name,
            canonicalNameKey(entry, name),
            cr,
            crNumeric,
            optionalText(classification.type),
            optionalText(classification.description),
            optionalText(classification.size),
            stringList(classification.environment).join(", ") || null,
            JSON.stringify(entry),
            computeContentHashSync(entry),
          );
        }
        break;
      }
      case "items": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_items (id, ruleset, name, name_key, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Item ${index + 1} name`);
          const id = idOrGenerated(entry, "i_", name);
          if (existing && isUnchangedNativeEntry(existing, batch.category, entry, id)) { skipped++; continue; }
          stmt.run(
            id,
            requiredText(entry.ruleset, `Item ${index + 1} ruleset`),
            name,
            canonicalNameKey(entry, name),
            optionalText(entry.rarity)?.toLowerCase() ?? null,
            optionalText(entry.type),
            normalizeKey(entry.type),
            entry.attunement === true || typeof entry.attunement === "string" ? 1 : 0,
            entry.magical === true ? 1 : 0,
            entry.equippable === true ? 1 : 0,
            optionalNumber(entry.weight),
            optionalNumber(entry.value),
            optionalText(entry.proficiency),
            JSON.stringify(entry),
            computeContentHashSync(entry),
          );
        }
        break;
      }
      case "spells": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_spells (id, ruleset, name, name_key, level, school, ritual, concentration, components, classes, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Spell ${index + 1} name`);
          const id = idOrGenerated(entry, "s_", name);
          if (existing && isUnchangedNativeEntry(existing, batch.category, entry, id)) { skipped++; continue; }
          const screenView = projectGrandSpell(entry);
          stmt.run(
            id,
            requiredText(entry.ruleset, `Spell ${index + 1} ruleset`),
            name,
            canonicalNameKey(entry, name),
            optionalNumber(entry.level),
            optionalText(entry.school),
            bool(entry.ritual) ? 1 : 0,
            bool(screenView.concentration) ? 1 : 0,
            optionalText(screenView.components),
            optionalText(screenView.classes),
            JSON.stringify(entry),
            computeContentHashSync(entry),
          );
        }
        break;
      }
      case "classTalents": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_class_talents (id, ruleset, name, name_key, kind, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Class talent ${index + 1} name`);
          const id = idOrGenerated(entry, "ct_", name);
          // The legacy corpus stored ClassTalents in the spell table under these IDs -- this
          // cleanup is idempotent and cheap, so it always runs even when the row itself is
          // unchanged and its own write gets skipped below.
          db.prepare("DELETE FROM compendium_spells WHERE id = ?").run(id);
          if (existing && isUnchangedNativeEntry(existing, batch.category, entry, id)) { skipped++; continue; }
          stmt.run(
            id,
            requiredText(entry.ruleset, `Class talent ${index + 1} ruleset`),
            name,
            canonicalNameKey(entry, name),
            requiredText(entry.kind, `Class talent ${index + 1} kind`),
            JSON.stringify(entry),
            computeContentHashSync(entry),
          );
        }
        break;
      }
      case "classes": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_classes (id, ruleset, name, name_key, hd, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Class ${index + 1} name`);
          const id = idOrGenerated(entry, "c_", name);
          if (existing && isUnchangedNativeEntry(existing, batch.category, entry, id)) { skipped++; continue; }
          stmt.run(
            id,
            requiredText(entry.ruleset, `Class ${index + 1} ruleset`),
            name,
            canonicalNameKey(entry, name),
            optionalNumber(entry.hitDie),
            JSON.stringify(entry),
            computeContentHashSync(entry),
          );
        }
        break;
      }
      case "species": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_races (id, ruleset, name, name_key, size, speed, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Species ${index + 1} name`);
          const id = idOrGenerated(entry, "r_", name);
          if (existing && isUnchangedNativeEntry(existing, batch.category, entry, id)) { skipped++; continue; }
          stmt.run(
            id,
            requiredText(entry.ruleset, `Species ${index + 1} ruleset`),
            name,
            canonicalNameKey(entry, name),
            optionalText(entry.size),
            optionalNumber(entry.speed),
            JSON.stringify(entry),
            computeContentHashSync(entry),
          );
        }
        break;
      }
      case "backgrounds": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_backgrounds (id, ruleset, name, name_key, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Background ${index + 1} name`);
          const id = idOrGenerated(entry, "bg_", name);
          if (existing && isUnchangedNativeEntry(existing, batch.category, entry, id)) { skipped++; continue; }
          stmt.run(
            id,
            requiredText(entry.ruleset, `Background ${index + 1} ruleset`),
            name,
            canonicalNameKey(entry, name),
            JSON.stringify(entry),
            computeContentHashSync(entry),
          );
        }
        break;
      }
      case "feats": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_feats (id, ruleset, name, name_key, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Feat ${index + 1} name`);
          const id = idOrGenerated(entry, "f_", name);
          if (existing && isUnchangedNativeEntry(existing, batch.category, entry, id)) { skipped++; continue; }
          stmt.run(
            id,
            requiredText(entry.ruleset, `Feat ${index + 1} ruleset`),
            name,
            canonicalNameKey(entry, name),
            JSON.stringify(entry),
            computeContentHashSync(entry),
          );
        }
        break;
      }
      case "decks": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_deck_cards (id, ruleset, deck_name, deck_key, card_name, card_key, card_text, sort_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const deckName = requiredText(entry.deckName ?? entry.deck_name, `Deck card ${index + 1} deckName`);
          const cardName = requiredText(entry.cardName ?? entry.card_name ?? entry.name, `Deck card ${index + 1} cardName`);
          const deckKey = optionalText(entry.deckKey ?? entry.deck_key)
            ?? makeId("", deckName).replace(/_/gu, "-");
          const cardKey = optionalText(entry.cardKey ?? entry.card_key)
            ?? makeId("", cardName).replace(/_/gu, "-");
          stmt.run(
            optionalText(entry.id) ?? `deck:${deckKey}:${cardKey}`,
            requiredText(entry.ruleset, `Deck card ${index + 1} ruleset`),
            deckName,
            deckKey,
            cardName,
            cardKey,
            optionalText(entry.text ?? entry.cardText ?? entry.card_text),
            integer(entry.sort ?? entry.sortIndex ?? entry.sort_index, index),
          );
        }
        break;
      }
      case "bastions": {
        const spaceStmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_bastion_spaces (id, ruleset, name, name_key, squares, label, sort_index) VALUES (?, ?, ?, ?, ?, ?, ?)",
        );
        const orderStmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_bastion_orders (id, ruleset, order_name, order_key, sort_index) VALUES (?, ?, ?, ?, ?)",
        );
        const facilityStmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_bastion_facilities (id, ruleset, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const kind = requiredText(entry.kind, `Bastion entry ${index + 1} kind`);
          const name = requiredText(entry.name, `Bastion entry ${index + 1} name`);
          const nameKey = canonicalNameKey(entry, name);
          if (kind === "space") {
            spaceStmt.run(
              idOrGenerated(entry, "bastion-space:", name),
              requiredText(entry.ruleset, `Bastion entry ${index + 1} ruleset`),
              name,
              nameKey,
              optionalNumber(entry.squares),
              optionalText(entry.label),
              integer(entry.sort ?? entry.sortIndex, index),
            );
          } else if (kind === "order") {
            orderStmt.run(
              idOrGenerated(entry, "bastion-order:", name),
              requiredText(entry.ruleset, `Bastion entry ${index + 1} ruleset`),
              name,
              nameKey,
              integer(entry.sort ?? entry.sortIndex, index),
            );
          } else if (kind === "facility") {
            const orders = Array.isArray(entry.orders)
              ? entry.orders.map((value) => String(value)).filter(Boolean)
              : [];
            facilityStmt.run(
              idOrGenerated(entry, "bastion-facility:", name),
              requiredText(entry.ruleset, `Bastion entry ${index + 1} ruleset`),
              name,
              nameKey,
              optionalText(entry.facilityType ?? entry.type) ?? "special",
              integer(entry.minimumLevel, 0),
              optionalText(entry.prerequisite),
              JSON.stringify(orders),
              optionalText(entry.space),
              optionalNumber(entry.hirelings),
              bool(entry.allowMultiple) ? 1 : 0,
              optionalText(entry.description),
              JSON.stringify(entry),
            );
          } else {
            throw new Error(`Unknown bastion entry kind "${kind}" at entry ${index + 1}.`);
          }
        }
        break;
      }
    }

  })();

  return {
    category: batch.category,
    // Rows actually written (additions + real changes) -- entries that were byte-identical to
    // what's already stored got skipped above rather than rewritten as a no-op.
    imported: batch.entries.length - skipped,
    total: countNativeCategory(db, batch.category),
  };
}

export function importNativeCompendiumBatch(
  db: Database.Database,
  input: NativeCompendiumBatch | unknown,
): NativeCompendiumImportResult {
  return importParsedNativeCompendiumBatch(db, parseNativeCompendiumBatch(input));
}

/** Imports server-staged batches that already passed schema and cross-reference validation. */
export function importValidatedNativeCompendiumBatches(
  db: Database.Database,
  batches: NativeCompendiumBatch[],
): NativeCompendiumDocumentImportResult {
  const results = db.transaction(() => {
    const imported = batches.map((batch) => importParsedNativeCompendiumBatch(db, batch));
    return imported.map((result) => ({
      ...result,
      total: countNativeCategory(db, result.category),
    }));
  })();
  return {
    imported: results.reduce((total, result) => total + result.imported, 0),
    total: results.reduce((total, result) => total + result.total, 0),
    batches: results,
  };
}

export function importNativeCompendiumDocument(
  db: Database.Database,
  input: NativeCompendiumDocument | unknown,
): NativeCompendiumDocumentImportResult {
  const batches = parseNativeCompendiumDocument(input);
  assertNativeCompendiumGuardrails(db, batches);
  return importValidatedNativeCompendiumBatches(db, batches);
}

function countNativeCategory(
  db: Database.Database,
  category: NativeCompendiumCategory,
): number {
  if (category === "bastions") {
    const spaces = (db.prepare("SELECT count(*) AS n FROM compendium_bastion_spaces").get() as { n: number }).n;
    const orders = (db.prepare("SELECT count(*) AS n FROM compendium_bastion_orders").get() as { n: number }).n;
    const facilities = (db.prepare("SELECT count(*) AS n FROM compendium_bastion_facilities").get() as { n: number }).n;
    return spaces + orders + facilities;
  }
  const table = {
    monsters: "compendium_monsters",
    items: "compendium_items",
    spells: "compendium_spells",
    classTalents: "compendium_class_talents",
    classes: "compendium_classes",
    species: "compendium_races",
    backgrounds: "compendium_backgrounds",
    feats: "compendium_feats",
    decks: "compendium_deck_cards",
  }[category];
  return (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
}
