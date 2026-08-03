import type Database from "better-sqlite3";
import { normalizeKey } from "../../lib/text.js";
import { crRatingToNumber } from "@beholden/shared/domain/monsters";
import { computeContentHashSync } from "@beholden/shared/domain/compendium/computeContentHashSync";
import { nativeEntryKey, type NativeCompendiumCategory } from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import { record, type JsonRecord } from "../../lib/jsonRecord.js";
import { projectGrandSpell } from "./grandCompendium.js";
import { assertNativeCompendiumGuardrails } from "./nativeCompendiumGuardrails.js";
import { existingNativeContent } from "./nativeCompendiumManifest.js";
import { parseNativeCompendiumBatch, parseNativeCompendiumDocument } from "./nativeCompendiumParsing.js";
import {
  bool, canonicalNameKey, idOrGenerated, integer, makeId, optionalNumber, optionalText,
  requiredText, stringList, type NativeCompendiumBatch, type NativeCompendiumDocument,
  type NativeCompendiumDocumentImportResult, type NativeCompendiumImportResult,
} from "./nativeCompendiumShared.js";

type BlobCategory = Exclude<NativeCompendiumCategory, "decks" | "bastions">;
type ImportContext = { entry: JsonRecord; index: number; name: string; id: string };
type BlobImportConfig = {
  sql: string;
  label: string;
  idPrefix: string;
  values: (context: ImportContext) => unknown[];
  beforeWrite?: (db: Database.Database, context: ImportContext) => void;
};

const ruleset = (entry: JsonRecord, label: string, index: number) => requiredText(entry.ruleset, `${label} ${index + 1} ruleset`);
const blobTail = (entry: JsonRecord) => [JSON.stringify(entry), computeContentHashSync(entry)];

const BLOB_IMPORT_CONFIG: Record<BlobCategory, BlobImportConfig> = {
  monsters: {
    sql: "INSERT OR REPLACE INTO compendium_monsters (id, ruleset, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    label: "Monster", idPrefix: "m_",
    values: ({ entry, index, name, id }) => {
      const classification = record(entry.classification);
      const challenge = record(entry.challenge);
      const cr = optionalText(challenge.rating);
      return [id, ruleset(entry, "Monster", index), name, canonicalNameKey(entry, name), cr, crRatingToNumber(cr), optionalText(classification.type), optionalText(classification.description), optionalText(classification.size), stringList(classification.environment).join(", ") || null, ...blobTail(entry)];
    },
  },
  items: {
    sql: "INSERT OR REPLACE INTO compendium_items (id, ruleset, name, name_key, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    label: "Item", idPrefix: "i_",
    values: ({ entry, index, name, id }) => [id, ruleset(entry, "Item", index), name, canonicalNameKey(entry, name), optionalText(entry.rarity)?.toLowerCase() ?? null, optionalText(entry.type), normalizeKey(entry.type), entry.attunement === true || typeof entry.attunement === "string" ? 1 : 0, entry.magical === true ? 1 : 0, entry.equippable === true ? 1 : 0, optionalNumber(entry.weight), optionalNumber(entry.value), optionalText(entry.proficiency), ...blobTail(entry)],
  },
  spells: {
    sql: "INSERT OR REPLACE INTO compendium_spells (id, ruleset, name, name_key, level, school, ritual, concentration, components, classes, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    label: "Spell", idPrefix: "s_",
    values: ({ entry, index, name, id }) => {
      const screen = projectGrandSpell(entry);
      return [id, ruleset(entry, "Spell", index), name, canonicalNameKey(entry, name), optionalNumber(entry.level), optionalText(entry.school), bool(entry.ritual) ? 1 : 0, bool(screen.concentration) ? 1 : 0, optionalText(screen.components), optionalText(screen.classes), ...blobTail(entry)];
    },
  },
  classTalents: {
    sql: "INSERT OR REPLACE INTO compendium_class_talents (id, ruleset, name, name_key, kind, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
    label: "Class talent", idPrefix: "ct_",
    beforeWrite: (db, { id }) => { db.prepare("DELETE FROM compendium_spells WHERE id = ?").run(id); },
    values: ({ entry, index, name, id }) => [id, ruleset(entry, "Class talent", index), name, canonicalNameKey(entry, name), requiredText(entry.kind, `Class talent ${index + 1} kind`), ...blobTail(entry)],
  },
  classes: {
    sql: "INSERT OR REPLACE INTO compendium_classes (id, ruleset, name, name_key, hd, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
    label: "Class", idPrefix: "c_",
    values: ({ entry, index, name, id }) => [id, ruleset(entry, "Class", index), name, canonicalNameKey(entry, name), optionalNumber(entry.hitDie), ...blobTail(entry)],
  },
  species: {
    sql: "INSERT OR REPLACE INTO compendium_races (id, ruleset, name, name_key, size, speed, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    label: "Species", idPrefix: "r_",
    values: ({ entry, index, name, id }) => [id, ruleset(entry, "Species", index), name, canonicalNameKey(entry, name), optionalText(entry.size), optionalNumber(entry.speed), ...blobTail(entry)],
  },
  backgrounds: {
    sql: "INSERT OR REPLACE INTO compendium_backgrounds (id, ruleset, name, name_key, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?)",
    label: "Background", idPrefix: "bg_",
    values: ({ entry, index, name, id }) => [id, ruleset(entry, "Background", index), name, canonicalNameKey(entry, name), ...blobTail(entry)],
  },
  feats: {
    sql: "INSERT OR REPLACE INTO compendium_feats (id, ruleset, name, name_key, data_json, content_hash) VALUES (?, ?, ?, ?, ?, ?)",
    label: "Feat", idPrefix: "f_",
    values: ({ entry, index, name, id }) => [id, ruleset(entry, "Feat", index), name, canonicalNameKey(entry, name), ...blobTail(entry)],
  },
};

function isUnchanged(existing: Map<string, string | null>, category: NativeCompendiumCategory, entry: JsonRecord, id: string): boolean {
  const key = nativeEntryKey(category, { id, ruleset: entry.ruleset ? String(entry.ruleset) : undefined });
  const stored = existing.get(key);
  return stored != null && stored === JSON.stringify(entry);
}

function importBlobCategory(db: Database.Database, batch: NativeCompendiumBatch, category: BlobCategory): number {
  const config = BLOB_IMPORT_CONFIG[category];
  const existing = existingNativeContent(db, category);
  const statement = db.prepare(config.sql);
  let skipped = 0;
  batch.entries.forEach((entry, index) => {
    const name = requiredText(entry.name, `${config.label} ${index + 1} name`);
    const id = idOrGenerated(entry, config.idPrefix, name);
    const context = { entry, index, name, id };
    config.beforeWrite?.(db, context);
    if (isUnchanged(existing, category, entry, id)) { skipped++; return; }
    statement.run(...config.values(context));
  });
  return skipped;
}

function importDecks(db: Database.Database, entries: JsonRecord[]): void {
  const statement = db.prepare("INSERT OR REPLACE INTO compendium_deck_cards (id, ruleset, deck_name, deck_key, card_name, card_key, card_text, sort_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  entries.forEach((entry, index) => {
    const deckName = requiredText(entry.deckName ?? entry.deck_name, `Deck card ${index + 1} deckName`);
    const cardName = requiredText(entry.cardName ?? entry.card_name ?? entry.name, `Deck card ${index + 1} cardName`);
    const deckKey = optionalText(entry.deckKey ?? entry.deck_key) ?? makeId("", deckName).replace(/_/gu, "-");
    const cardKey = optionalText(entry.cardKey ?? entry.card_key) ?? makeId("", cardName).replace(/_/gu, "-");
    statement.run(optionalText(entry.id) ?? `deck:${deckKey}:${cardKey}`, ruleset(entry, "Deck card", index), deckName, deckKey, cardName, cardKey, optionalText(entry.text ?? entry.cardText ?? entry.card_text), integer(entry.sort ?? entry.sortIndex ?? entry.sort_index, index));
  });
}

function importBastions(db: Database.Database, entries: JsonRecord[]): void {
  const statements = {
    space: db.prepare("INSERT OR REPLACE INTO compendium_bastion_spaces (id, ruleset, name, name_key, squares, label, sort_index) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    order: db.prepare("INSERT OR REPLACE INTO compendium_bastion_orders (id, ruleset, order_name, order_key, sort_index) VALUES (?, ?, ?, ?, ?)"),
    facility: db.prepare("INSERT OR REPLACE INTO compendium_bastion_facilities (id, ruleset, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
  };
  entries.forEach((entry, index) => {
    const kind = requiredText(entry.kind, `Bastion entry ${index + 1} kind`);
    const name = requiredText(entry.name, `Bastion entry ${index + 1} name`);
    const nameKey = canonicalNameKey(entry, name);
    const entryRuleset = ruleset(entry, "Bastion entry", index);
    if (kind === "space") statements.space.run(idOrGenerated(entry, "bastion-space:", name), entryRuleset, name, nameKey, optionalNumber(entry.squares), optionalText(entry.label), integer(entry.sort ?? entry.sortIndex, index));
    else if (kind === "order") statements.order.run(idOrGenerated(entry, "bastion-order:", name), entryRuleset, name, nameKey, integer(entry.sort ?? entry.sortIndex, index));
    else if (kind === "facility") {
      const orders = Array.isArray(entry.orders) ? entry.orders.map(String).filter(Boolean) : [];
      statements.facility.run(idOrGenerated(entry, "bastion-facility:", name), entryRuleset, name, nameKey, optionalText(entry.facilityType ?? entry.type) ?? "special", integer(entry.minimumLevel, 0), optionalText(entry.prerequisite), JSON.stringify(orders), optionalText(entry.space), optionalNumber(entry.hirelings), bool(entry.allowMultiple) ? 1 : 0, optionalText(entry.description), JSON.stringify(entry));
    } else throw new Error(`Unknown bastion entry kind "${kind}" at entry ${index + 1}.`);
  });
}

function countNativeCategory(db: Database.Database, category: NativeCompendiumCategory): number {
  if (category === "bastions") return ["compendium_bastion_spaces", "compendium_bastion_orders", "compendium_bastion_facilities"].reduce((sum, table) => sum + (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n, 0);
  const table: Record<Exclude<NativeCompendiumCategory, "bastions">, string> = { monsters: "compendium_monsters", items: "compendium_items", spells: "compendium_spells", classTalents: "compendium_class_talents", classes: "compendium_classes", species: "compendium_races", backgrounds: "compendium_backgrounds", feats: "compendium_feats", decks: "compendium_deck_cards" };
  return (db.prepare(`SELECT count(*) AS n FROM ${table[category]}`).get() as { n: number }).n;
}

function importParsedNativeCompendiumBatch(db: Database.Database, batch: NativeCompendiumBatch): NativeCompendiumImportResult {
  let skipped = 0;
  db.transaction(() => {
    if (batch.category === "decks") importDecks(db, batch.entries);
    else if (batch.category === "bastions") importBastions(db, batch.entries);
    else skipped = importBlobCategory(db, batch, batch.category);
  })();
  return { category: batch.category, imported: batch.entries.length - skipped, total: countNativeCategory(db, batch.category) };
}

export function importNativeCompendiumBatch(db: Database.Database, input: NativeCompendiumBatch | unknown): NativeCompendiumImportResult {
  return importParsedNativeCompendiumBatch(db, parseNativeCompendiumBatch(input));
}

export function importValidatedNativeCompendiumBatches(db: Database.Database, batches: NativeCompendiumBatch[]): NativeCompendiumDocumentImportResult {
  const results = db.transaction(() => batches.map((batch) => importParsedNativeCompendiumBatch(db, batch)).map((result) => ({ ...result, total: countNativeCategory(db, result.category) })))();
  return { imported: results.reduce((sum, result) => sum + result.imported, 0), total: results.reduce((sum, result) => sum + result.total, 0), batches: results };
}

export function importNativeCompendiumDocument(db: Database.Database, input: NativeCompendiumDocument | unknown): NativeCompendiumDocumentImportResult {
  const batches = parseNativeCompendiumDocument(input);
  assertNativeCompendiumGuardrails(db, batches);
  return importValidatedNativeCompendiumBatches(db, batches);
}
