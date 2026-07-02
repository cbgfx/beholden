import type Database from "better-sqlite3";
import { normalizeKey } from "../../lib/text.js";
import {
  assertCanonicalV2Entry,
  backgroundToV2,
  classToV2,
  featToV2,
  itemToV2,
  monsterToV2,
  spellFromV2,
  spellToV2,
  speciesToV2,
} from "./nativeCompendiumV2.js";
import { isCanonicalV2Entry } from "./nativeCompendiumV2.js";
import { CANONICAL_V2_SCHEMA_VERSION } from "./nativeCompendiumV2Schemas.js";
import { type JsonRecord, record } from "../../lib/jsonRecord.js";

export const BEHOLDEN_COMPENDIUM_FORMAT = "beholden.compendium";
export const BEHOLDEN_COMPENDIUM_VERSION = 2;

export const NATIVE_COMPENDIUM_CATEGORIES = [
  "monsters",
  "items",
  "spells",
  "classes",
  "species",
  "backgrounds",
  "feats",
  "decks",
  "bastions",
] as const;

export type NativeCompendiumCategory = (typeof NATIVE_COMPENDIUM_CATEGORIES)[number];

export type NativeCompendiumBatch = {
  format: typeof BEHOLDEN_COMPENDIUM_FORMAT;
  version: typeof BEHOLDEN_COMPENDIUM_VERSION;
  category: NativeCompendiumCategory;
  exportedAt: string;
  entries: JsonRecord[];
};

export type NativeCompendiumBundle = {
  format: typeof BEHOLDEN_COMPENDIUM_FORMAT;
  version: typeof BEHOLDEN_COMPENDIUM_VERSION;
  exportedAt: string;
  batches: Array<{
    category: NativeCompendiumCategory;
    entries: JsonRecord[];
  }>;
};

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
  replacements: number;
  batches: Array<{
    category: NativeCompendiumCategory;
    entries: number;
    additions: number;
    replacements: number;
  }>;
};

const categorySet = new Set<string>(NATIVE_COMPENDIUM_CATEGORIES);

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
  scalar: JsonRecord,
  allowSourceConversion: boolean,
): JsonRecord {
  const blob = parseJsonRecord(row.data_json);
  if (isCanonicalV2Entry(category, blob)) return blob;
  if (allowSourceConversion) return { ...blob, ...scalar };
  assertCanonicalV2Entry(category, blob, 0);
  return blob;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function isNativeCompendiumCategory(value: string): value is NativeCompendiumCategory {
  return categorySet.has(value);
}

export function parseNativeCompendiumBatch(value: unknown): NativeCompendiumBatch {
  const root = asRecord(value, "Compendium document");
  if (root.format !== BEHOLDEN_COMPENDIUM_FORMAT) {
    throw new Error(`Expected format "${BEHOLDEN_COMPENDIUM_FORMAT}".`);
  }
  if (root.version !== BEHOLDEN_COMPENDIUM_VERSION) {
    throw new Error(`Unsupported Beholden Compendium version: ${String(root.version ?? "missing")}.`);
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
    if (!isCanonicalV2Entry(category, parsed)) {
      assertCanonicalV2Entry(category, parsed, index);
    }
    return parsed;
  });
  entries.forEach((entry, index) => assertCanonicalV2Entry(category, entry, index));
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
    version: BEHOLDEN_COMPENDIUM_VERSION,
    category,
    exportedAt: optionalText(root.exportedAt) ?? new Date().toISOString(),
    entries,
  };
}

export function parseNativeCompendiumDocument(value: unknown): NativeCompendiumBatch[] {
  const root = asRecord(value, "Compendium document");
  if (Array.isArray(root.batches)) {
    if (root.format !== BEHOLDEN_COMPENDIUM_FORMAT) {
      throw new Error(`Expected format "${BEHOLDEN_COMPENDIUM_FORMAT}".`);
    }
    if (root.version !== BEHOLDEN_COMPENDIUM_VERSION) {
      throw new Error(`Unsupported Beholden Compendium version: ${String(root.version ?? "missing")}.`);
    }
    const exportedAt = optionalText(root.exportedAt) ?? new Date().toISOString();
    const batches = root.batches.map((rawBatch, index) => {
      const batch = asRecord(rawBatch, `Batch ${index + 1}`);
      return parseNativeCompendiumBatch({
        format: BEHOLDEN_COMPENDIUM_FORMAT,
        version: BEHOLDEN_COMPENDIUM_VERSION,
        category: batch.category,
        exportedAt,
        entries: batch.entries,
      });
    });
    const idsByCategory = new Map<NativeCompendiumCategory, Set<string>>();
    for (const batch of batches) {
      const seen = idsByCategory.get(batch.category) ?? new Set<string>();
      for (const entry of batch.entries) {
        const id = String(entry.id);
        if (seen.has(id)) {
          throw new Error(`Compendium bundle duplicates ${batch.category} id "${id}".`);
        }
        seen.add(id);
      }
      idsByCategory.set(batch.category, seen);
    }
    return batches;
  }
  return [parseNativeCompendiumBatch(root)];
}

function existingNativeIds(
  db: Database.Database,
  category: NativeCompendiumCategory,
): Set<string> {
  const queries: Record<NativeCompendiumCategory, string[]> = {
    monsters: ["SELECT id FROM compendium_monsters"],
    items: ["SELECT id FROM compendium_items"],
    spells: ["SELECT id FROM compendium_spells"],
    classes: ["SELECT id FROM compendium_classes"],
    species: ["SELECT id FROM compendium_races"],
    backgrounds: ["SELECT id FROM compendium_backgrounds"],
    feats: ["SELECT id FROM compendium_feats"],
    decks: ["SELECT id FROM compendium_deck_cards"],
    bastions: [
      "SELECT id FROM compendium_bastion_spaces",
      "SELECT id FROM compendium_bastion_orders",
      "SELECT id FROM compendium_bastion_facilities",
    ],
  };
  return new Set(
    queries[category].flatMap((sql) =>
      (db.prepare(sql).all() as Array<{ id: string }>).map((row) => row.id)
    ),
  );
}

export function previewNativeCompendiumDocument(
  db: Database.Database,
  input: NativeCompendiumDocument | unknown,
): NativeCompendiumPreview {
  const batches = parseNativeCompendiumDocument(input);
  const existingByCategory = new Map<NativeCompendiumCategory, Set<string>>();
  const previewBatches = batches.map((batch) => {
    const existing = existingByCategory.get(batch.category)
      ?? existingNativeIds(db, batch.category);
    existingByCategory.set(batch.category, existing);
    const replacements = batch.entries.reduce(
      (total, entry) => total + (existing.has(String(entry.id)) ? 1 : 0),
      0,
    );
    return {
      category: batch.category,
      entries: batch.entries.length,
      additions: batch.entries.length - replacements,
      replacements,
    };
  });
  return {
    entries: previewBatches.reduce((total, batch) => total + batch.entries, 0),
    additions: previewBatches.reduce((total, batch) => total + batch.additions, 0),
    replacements: previewBatches.reduce((total, batch) => total + batch.replacements, 0),
    batches: previewBatches,
  };
}

export function exportNativeCompendiumBundle(
  db: Database.Database,
  categories: Iterable<NativeCompendiumCategory> = NATIVE_COMPENDIUM_CATEGORIES,
  options: { includeEmpty?: boolean; allowSourceConversion?: boolean } = {},
): NativeCompendiumBundle {
  const exportedAt = new Date().toISOString();
  const batches = Array.from(categories)
    .map((category) => exportNativeCompendiumBatch(
      db,
      category,
      undefined,
      options.allowSourceConversion === undefined
        ? {}
        : { allowSourceConversion: options.allowSourceConversion },
    ))
    .filter((batch) => options.includeEmpty || batch.entries.length > 0)
    .map((batch) => ({ category: batch.category, entries: batch.entries }));
  return {
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    version: BEHOLDEN_COMPENDIUM_VERSION,
    exportedAt,
    batches,
  };
}

export function exportNativeCompendiumBatch(
  db: Database.Database,
  category: NativeCompendiumCategory,
  ids?: Iterable<string>,
  options: { allowSourceConversion?: boolean } = {},
): NativeCompendiumBatch {
  let entries: JsonRecord[];
  const allowSourceConversion = options.allowSourceConversion === true;

  switch (category) {
    case "monsters":
      entries = (db.prepare(
        "SELECT id, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json FROM compendium_monsters ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("monsters", row, {
        id: row.id,
        name: row.name,
        nameKey: row.name_key ?? null,
        cr: row.cr ?? null,
        crNumeric: row.cr_numeric ?? null,
        typeKey: row.type_key ?? null,
        typeFull: row.type_full ?? null,
        size: row.size ?? null,
        environment: row.environment ?? null,
      }, allowSourceConversion));
      break;
    case "items":
      entries = (db.prepare(
        "SELECT id, name, name_key, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json FROM compendium_items ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("items", row, {
        id: row.id,
        name: row.name,
        nameKey: row.name_key ?? null,
        rarity: row.rarity ?? null,
        type: row.type ?? null,
        typeKey: row.type_key ?? null,
        attunement: bool(row.attunement),
        magic: bool(row.magic),
        equippable: bool(row.equippable),
        weight: row.weight ?? null,
        value: row.value ?? null,
        proficiency: row.proficiency ?? null,
      }, allowSourceConversion));
      break;
    case "spells":
      entries = (db.prepare(
        "SELECT id, name, name_key, level, school, ritual, concentration, components, classes, data_json FROM compendium_spells ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("spells", row, {
        id: row.id,
        name: row.name,
        nameKey: row.name_key ?? null,
        level: row.level ?? null,
        school: row.school ?? null,
        ritual: bool(row.ritual),
        concentration: bool(row.concentration),
        components: row.components ?? null,
        classes: row.classes ?? null,
      }, allowSourceConversion));
      break;
    case "classes":
      entries = (db.prepare(
        "SELECT id, name, name_key, hd, data_json FROM compendium_classes ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("classes", row, {
        id: row.id,
        name: row.name,
        nameKey: row.name_key ?? null,
        hd: row.hd ?? null,
      }, allowSourceConversion));
      break;
    case "species":
      entries = (db.prepare(
        "SELECT id, name, name_key, size, speed, data_json FROM compendium_races ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("species", row, {
        id: row.id,
        name: row.name,
        nameKey: row.name_key ?? null,
        size: row.size ?? null,
        speed: row.speed ?? null,
      }, allowSourceConversion));
      break;
    case "backgrounds":
      entries = (db.prepare(
        "SELECT id, name, name_key, data_json FROM compendium_backgrounds ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("backgrounds", row, {
        id: row.id,
        name: row.name,
        nameKey: row.name_key ?? null,
      }, allowSourceConversion));
      break;
    case "feats":
      entries = (db.prepare(
        "SELECT id, name, name_key, data_json FROM compendium_feats ORDER BY name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => mergeExportEntry("feats", row, {
        id: row.id,
        name: row.name,
        nameKey: row.name_key ?? null,
      }, allowSourceConversion));
      break;
    case "decks":
      entries = (db.prepare(
        "SELECT id, deck_name, deck_key, card_name, card_key, card_text, sort_index FROM compendium_deck_cards ORDER BY deck_name COLLATE NOCASE, sort_index, card_name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => ({
        schemaVersion: CANONICAL_V2_SCHEMA_VERSION,
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
        "SELECT id, name, name_key, squares, label, sort_index FROM compendium_bastion_spaces ORDER BY sort_index, name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => ({
        schemaVersion: CANONICAL_V2_SCHEMA_VERSION,
        kind: "space",
        id: row.id,
        name: row.name,
        nameKey: row.name_key,
        squares: row.squares ?? null,
        label: row.label ?? null,
        sort: row.sort_index,
      }));
      const orders = (db.prepare(
        "SELECT id, order_name, order_key, sort_index FROM compendium_bastion_orders ORDER BY sort_index, order_name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => ({
        schemaVersion: CANONICAL_V2_SCHEMA_VERSION,
        kind: "order",
        id: row.id,
        name: row.order_name,
        nameKey: row.order_key,
        sort: row.sort_index,
      }));
      const facilities = (db.prepare(
        "SELECT id, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json FROM compendium_bastion_facilities ORDER BY facility_type, minimum_level, name COLLATE NOCASE",
      ).all() as JsonRecord[]).map((row) => ({
        schemaVersion: CANONICAL_V2_SCHEMA_VERSION,
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

  if (category === "monsters") entries = entries.map(monsterToV2);
  if (category === "items") entries = entries.map(itemToV2);
  if (category === "spells") entries = entries.map(spellToV2);
  if (category === "classes") entries = entries.map(classToV2);
  if (category === "species") entries = entries.map(speciesToV2);
  if (category === "backgrounds") entries = entries.map(backgroundToV2);
  if (category === "feats") entries = entries.map(featToV2);

  return {
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    version: BEHOLDEN_COMPENDIUM_VERSION,
    category,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export function importNativeCompendiumBatch(
  db: Database.Database,
  input: NativeCompendiumBatch | unknown,
): NativeCompendiumImportResult {
  const batch = parseNativeCompendiumBatch(input);
  const entries = batch.entries;

  db.transaction(() => {
    switch (batch.category) {
      case "monsters": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_monsters (id, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Monster ${index + 1} name`);
          const classification = record(entry.classification);
          const challenge = record(entry.challenge);
          const cr = optionalText(challenge.rating);
          const crNumeric = optionalNumber(challenge.numeric)
            ?? (cr?.includes("/") ? (() => {
              const [n, d] = cr.split("/").map(Number);
              return d ? (n ?? 0) / d : null;
            })() : optionalNumber(cr));
          stmt.run(
            idOrGenerated(entry, "m_", name),
            name,
            canonicalNameKey(entry, name),
            cr,
            crNumeric,
            optionalText(classification.type),
            optionalText(classification.description),
            optionalText(classification.size),
            stringList(classification.environment).join(", ") || null,
            JSON.stringify(entry),
          );
        }
        break;
      }
      case "items": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_items (id, name, name_key, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Item ${index + 1} name`);
          stmt.run(
            idOrGenerated(entry, "i_", name),
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
          );
        }
        break;
      }
      case "spells": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_spells (id, name, name_key, level, school, ritual, concentration, components, classes, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Spell ${index + 1} name`);
          const screenView = spellFromV2(entry);
          stmt.run(
            idOrGenerated(entry, "s_", name),
            name,
            canonicalNameKey(entry, name),
            optionalNumber(entry.level),
            optionalText(entry.school),
            bool(entry.ritual) ? 1 : 0,
            bool(screenView.concentration) ? 1 : 0,
            optionalText(screenView.components),
            optionalText(screenView.classes),
            JSON.stringify(entry),
          );
        }
        break;
      }
      case "classes": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_classes (id, name, name_key, hd, data_json) VALUES (?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Class ${index + 1} name`);
          stmt.run(
            idOrGenerated(entry, "c_", name),
            name,
            canonicalNameKey(entry, name),
            optionalNumber(entry.hitDie),
            JSON.stringify(entry),
          );
        }
        break;
      }
      case "species": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_races (id, name, name_key, size, speed, data_json) VALUES (?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Species ${index + 1} name`);
          stmt.run(
            idOrGenerated(entry, "r_", name),
            name,
            canonicalNameKey(entry, name),
            optionalText(entry.size),
            optionalNumber(entry.speed),
            JSON.stringify(entry),
          );
        }
        break;
      }
      case "backgrounds": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_backgrounds (id, name, name_key, data_json) VALUES (?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Background ${index + 1} name`);
          stmt.run(
            idOrGenerated(entry, "bg_", name),
            name,
            canonicalNameKey(entry, name),
            JSON.stringify(entry),
          );
        }
        break;
      }
      case "feats": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_feats (id, name, name_key, data_json) VALUES (?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const name = requiredText(entry.name, `Feat ${index + 1} name`);
          stmt.run(
            idOrGenerated(entry, "f_", name),
            name,
            canonicalNameKey(entry, name),
            JSON.stringify(entry),
          );
        }
        break;
      }
      case "decks": {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_deck_cards (id, deck_name, deck_key, card_name, card_key, card_text, sort_index) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
          "INSERT OR REPLACE INTO compendium_bastion_spaces (id, name, name_key, squares, label, sort_index) VALUES (?, ?, ?, ?, ?, ?)",
        );
        const orderStmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_bastion_orders (id, order_name, order_key, sort_index) VALUES (?, ?, ?, ?)",
        );
        const facilityStmt = db.prepare(
          "INSERT OR REPLACE INTO compendium_bastion_facilities (id, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const [index, entry] of entries.entries()) {
          const kind = requiredText(entry.kind, `Bastion entry ${index + 1} kind`);
          const name = requiredText(entry.name, `Bastion entry ${index + 1} name`);
          const nameKey = canonicalNameKey(entry, name);
          if (kind === "space") {
            spaceStmt.run(
              idOrGenerated(entry, "bastion-space:", name),
              name,
              nameKey,
              optionalNumber(entry.squares),
              optionalText(entry.label),
              integer(entry.sort ?? entry.sortIndex, index),
            );
          } else if (kind === "order") {
            orderStmt.run(
              idOrGenerated(entry, "bastion-order:", name),
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
    imported: batch.entries.length,
    total: countNativeCategory(db, batch.category),
  };
}

export function importNativeCompendiumDocument(
  db: Database.Database,
  input: NativeCompendiumDocument | unknown,
): NativeCompendiumDocumentImportResult {
  const batches = parseNativeCompendiumDocument(input);
  const results = db.transaction(() =>
    batches.map((batch) => importNativeCompendiumBatch(db, batch))
  )();
  return {
    imported: results.reduce((total, result) => total + result.imported, 0),
    total: results.reduce((total, result) => total + result.total, 0),
    batches: results,
  };
}

export function countNativeCategory(
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
    classes: "compendium_classes",
    species: "compendium_races",
    backgrounds: "compendium_backgrounds",
    feats: "compendium_feats",
    decks: "compendium_deck_cards",
  }[category];
  return (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
}
