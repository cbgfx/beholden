import type Database from "better-sqlite3";
import { computeContentHashSync } from "@beholden/shared/domain/compendium/computeContentHashSync";
import {
  isNativeCompendiumCategory,
  nativeEntryKey,
  type NativeCompendiumCategory,
} from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import { assertNativeCompendiumGuardrails } from "./nativeCompendiumGuardrails.js";
import { parseNativeCompendiumDocument } from "./nativeCompendiumParsing.js";
import { parseJsonRecord, type NativeCompendiumBatch, type NativeCompendiumDocument, type NativeCompendiumPreview } from "./nativeCompendiumShared.js";

export const CONTENT_COMPARABLE_QUERIES: Partial<Record<NativeCompendiumCategory, string>> = {
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

const CONTENT_HASH_TABLE_NAMES: Partial<Record<NativeCompendiumCategory, string>> = {
  monsters: "compendium_monsters", items: "compendium_items", spells: "compendium_spells",
  classTalents: "compendium_class_talents", classes: "compendium_classes", species: "compendium_races",
  backgrounds: "compendium_backgrounds", feats: "compendium_feats",
};

export function existingNativeContent(db: Database.Database, category: NativeCompendiumCategory): Map<string, string | null> {
  const contentQuery = CONTENT_COMPARABLE_QUERIES[category];
  if (contentQuery) {
    const rows = db.prepare(contentQuery).all() as Array<{ id: string; ruleset: string; data_json: string }>;
    return new Map(rows.map((row) => [nativeEntryKey(category, row), row.data_json]));
  }
  const result = new Map<string, string | null>();
  for (const sql of PRESENCE_ONLY_QUERIES[category] ?? []) {
    for (const row of db.prepare(sql).all() as Array<{ id: string; ruleset: string }>) result.set(nativeEntryKey(category, row), null);
  }
  return result;
}

export const NATIVE_COMPENDIUM_MANIFEST_VERSION = 1;
export type NativeCompendiumManifestRequest = { version: number; category: NativeCompendiumCategory; hashes: Record<string, string> };
export type NativeCompendiumManifestResult = { upload: string[] };

export function resolveNativeContentHashes(db: Database.Database, category: NativeCompendiumCategory): Map<string, string> {
  const table = CONTENT_HASH_TABLE_NAMES[category];
  if (!table) return new Map();
  return db.transaction(() => {
    const rows = db.prepare(`SELECT rowid, id, ruleset, data_json, content_hash FROM ${table}`).all() as Array<{
      rowid: number; id: string; ruleset: string; data_json: string; content_hash: string | null;
    }>;
    const backfill = db.prepare(`UPDATE ${table} SET content_hash = ? WHERE rowid = ?`);
    const result = new Map<string, string>();
    for (const row of rows) {
      const hash = row.content_hash || computeContentHashSync(parseJsonRecord(row.data_json));
      if (!row.content_hash) backfill.run(hash, row.rowid);
      result.set(nativeEntryKey(category, row), hash);
    }
    return result;
  })();
}

export function resolveNativeCompendiumManifest(db: Database.Database, request: NativeCompendiumManifestRequest): NativeCompendiumManifestResult {
  if (request.version !== NATIVE_COMPENDIUM_MANIFEST_VERSION) throw new Error(`Unsupported compendium manifest version: ${request.version}.`);
  if (!isNativeCompendiumCategory(request.category)) throw new Error(`Unknown compendium category: ${request.category}.`);
  if (!CONTENT_HASH_TABLE_NAMES[request.category]) throw new Error(`Compendium category "${request.category}" does not support manifest diffing.`);
  const stored = resolveNativeContentHashes(db, request.category);
  return { upload: Object.entries(request.hashes).filter(([key, hash]) => stored.get(key) !== hash).map(([key]) => key) };
}

export function previewNativeCompendiumDocument(db: Database.Database, input: NativeCompendiumDocument | unknown): NativeCompendiumPreview {
  const batches = parseNativeCompendiumDocument(input);
  assertNativeCompendiumGuardrails(db, batches);
  return previewValidatedNativeCompendiumBatches(db, batches);
}

export function previewValidatedNativeCompendiumBatches(db: Database.Database, batches: NativeCompendiumBatch[]): NativeCompendiumPreview {
  const cache = new Map<NativeCompendiumCategory, Map<string, string | null>>();
  const previewBatches = batches.map((batch) => {
    const existing = cache.get(batch.category) ?? existingNativeContent(db, batch.category);
    cache.set(batch.category, existing);
    let additions = 0, changed = 0, unchanged = 0;
    for (const entry of batch.entries) {
      const key = nativeEntryKey(batch.category, { id: String(entry.id), ruleset: entry.ruleset ? String(entry.ruleset) : undefined });
      if (!existing.has(key)) additions++;
      else if (existing.get(key) !== null && existing.get(key) === JSON.stringify(entry)) unchanged++;
      else changed++;
    }
    return { category: batch.category, entries: batch.entries.length, additions, replacements: changed + unchanged, changed, unchanged };
  });
  return {
    entries: previewBatches.reduce((sum, batch) => sum + batch.entries, 0),
    additions: previewBatches.reduce((sum, batch) => sum + batch.additions, 0),
    replacements: previewBatches.reduce((sum, batch) => sum + batch.replacements, 0),
    changed: previewBatches.reduce((sum, batch) => sum + batch.changed, 0),
    unchanged: previewBatches.reduce((sum, batch) => sum + batch.unchanged, 0),
    batches: previewBatches,
  };
}
