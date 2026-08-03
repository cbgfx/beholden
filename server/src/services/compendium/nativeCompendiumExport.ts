import type Database from "better-sqlite3";
import { GRAND_COMPENDIUM_SCHEMA_VERSION } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { NATIVE_COMPENDIUM_CATEGORIES, type NativeCompendiumCategory } from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import type { JsonRecord } from "../../lib/jsonRecord.js";
import { assertGrandCompendiumEntry, isGrandCompendiumEntry } from "./grandCompendium.js";
import {
  BEHOLDEN_COMPENDIUM_FORMAT, BEHOLDEN_COMPENDIUM_SCHEMA, bool, parseJsonArray,
  parseJsonRecord, type NativeCompendiumBatch, type NativeCompendiumBundle,
} from "./nativeCompendiumShared.js";

const EXPORT_QUERIES: Partial<Record<NativeCompendiumCategory, string>> = {
  monsters: "SELECT data_json FROM compendium_monsters ORDER BY name COLLATE NOCASE",
  items: "SELECT data_json FROM compendium_items ORDER BY name COLLATE NOCASE",
  spells: "SELECT data_json FROM compendium_spells ORDER BY name COLLATE NOCASE",
  classTalents: "SELECT data_json FROM compendium_class_talents ORDER BY kind, name COLLATE NOCASE",
  classes: "SELECT data_json FROM compendium_classes ORDER BY name COLLATE NOCASE",
  species: "SELECT data_json FROM compendium_races ORDER BY name COLLATE NOCASE",
  backgrounds: "SELECT data_json FROM compendium_backgrounds ORDER BY name COLLATE NOCASE",
  feats: "SELECT data_json FROM compendium_feats ORDER BY name COLLATE NOCASE",
};

function blobEntry(category: NativeCompendiumCategory, row: JsonRecord): JsonRecord {
  const entry = parseJsonRecord(row.data_json);
  if (!isGrandCompendiumEntry(category, entry)) assertGrandCompendiumEntry(category, entry, 0);
  return entry;
}

export function* iterateNativeCompendiumEntries(db: Database.Database, category: NativeCompendiumCategory): Generator<JsonRecord> {
  const query = EXPORT_QUERIES[category];
  if (query) {
    for (const row of db.prepare(query).iterate() as Iterable<JsonRecord>) yield blobEntry(category, row);
    return;
  }
  if (category === "decks") {
    const rows = db.prepare("SELECT id, ruleset, deck_name, deck_key, card_name, card_key, card_text, sort_index FROM compendium_deck_cards ORDER BY deck_name COLLATE NOCASE, sort_index, card_name COLLATE NOCASE").iterate() as Iterable<JsonRecord>;
    for (const row of rows) yield { schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION, ruleset: row.ruleset, id: row.id, deckName: row.deck_name, deckKey: row.deck_key, cardName: row.card_name, cardKey: row.card_key ?? null, text: row.card_text ?? null, sort: row.sort_index };
    return;
  }
  const spaces = db.prepare("SELECT id, ruleset, name, name_key, squares, label, sort_index FROM compendium_bastion_spaces ORDER BY sort_index, name COLLATE NOCASE").iterate() as Iterable<JsonRecord>;
  for (const row of spaces) yield { schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION, ruleset: row.ruleset, kind: "space", id: row.id, name: row.name, nameKey: row.name_key, squares: row.squares ?? null, label: row.label ?? null, sort: row.sort_index };
  const orders = db.prepare("SELECT id, ruleset, order_name, order_key, sort_index FROM compendium_bastion_orders ORDER BY sort_index, order_name COLLATE NOCASE").iterate() as Iterable<JsonRecord>;
  for (const row of orders) yield { schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION, ruleset: row.ruleset, kind: "order", id: row.id, name: row.order_name, nameKey: row.order_key, sort: row.sort_index };
  const facilities = db.prepare("SELECT id, ruleset, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description FROM compendium_bastion_facilities ORDER BY facility_type, minimum_level, name COLLATE NOCASE").iterate() as Iterable<JsonRecord>;
  for (const row of facilities) yield { schemaVersion: GRAND_COMPENDIUM_SCHEMA_VERSION, ruleset: row.ruleset, kind: "facility", id: row.id, name: row.name, nameKey: row.name_key, facilityType: row.facility_type, minimumLevel: row.minimum_level, prerequisite: row.prerequisite ?? null, orders: parseJsonArray(row.orders_json), space: row.space ?? null, hirelings: row.hirelings ?? null, allowMultiple: bool(row.allow_multiple), description: row.description ?? null };
}

export function exportNativeCompendiumBatch(db: Database.Database, category: NativeCompendiumCategory, ids?: Iterable<string>): NativeCompendiumBatch {
  let entries = Array.from(iterateNativeCompendiumEntries(db, category));
  if (ids) { const wanted = new Set(ids); entries = entries.filter((entry) => wanted.has(String(entry.id ?? ""))); }
  return { format: BEHOLDEN_COMPENDIUM_FORMAT, schema: BEHOLDEN_COMPENDIUM_SCHEMA, category, exportedAt: new Date().toISOString(), entries };
}

export function exportNativeCompendiumBundle(db: Database.Database, categories: Iterable<NativeCompendiumCategory> = NATIVE_COMPENDIUM_CATEGORIES, options: { includeEmpty?: boolean } = {}): NativeCompendiumBundle {
  const batches = Array.from(categories).map((category) => exportNativeCompendiumBatch(db, category)).filter((batch) => options.includeEmpty || batch.entries.length > 0);
  const document = { format: BEHOLDEN_COMPENDIUM_FORMAT, schema: BEHOLDEN_COMPENDIUM_SCHEMA, exportedAt: new Date().toISOString() } as NativeCompendiumBundle;
  for (const batch of batches) document[batch.category] = batch.entries;
  return document;
}
