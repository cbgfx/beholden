import { Readable } from "node:stream";
import type Database from "better-sqlite3";
import type { NativeCompendiumBundle, NativeCompendiumCategory } from "./nativeCompendium.js";
import {
  BEHOLDEN_COMPENDIUM_FORMAT,
  BEHOLDEN_COMPENDIUM_SCHEMA,
  iterateNativeCompendiumEntries,
  NATIVE_COMPENDIUM_CATEGORIES,
} from "./nativeCompendium.js";
import type { JsonRecord } from "../../lib/jsonRecord.js";

function* serializeDocumentHeader(exportedAt: string): Generator<string> {
  yield "{\n";
  yield `  \"format\": ${JSON.stringify(BEHOLDEN_COMPENDIUM_FORMAT)},\n`;
  yield `  \"schema\": ${JSON.stringify(BEHOLDEN_COMPENDIUM_SCHEMA)},\n`;
  yield `  \"exportedAt\": ${JSON.stringify(exportedAt)}`;
}

function* serializeEntries(category: NativeCompendiumCategory, entries: Iterable<JsonRecord>): Generator<string> {
  yield `,\n  ${JSON.stringify(category)}: [`;
  let count = 0;
  for (const entry of entries) {
    yield `${count === 0 ? "\n" : ",\n"}    ${JSON.stringify(entry)}`;
    count += 1;
  }
  if (count > 0) yield "\n  ";
  yield "]";
}

function* serializeNativeCompendiumBundle(document: NativeCompendiumBundle): Generator<string> {
  yield* serializeDocumentHeader(document.exportedAt);

  for (const category of NATIVE_COMPENDIUM_CATEGORIES) {
    const entries = document[category];
    if (!entries) continue;
    yield* serializeEntries(category, entries);
  }
  yield "\n}\n";
}

function* serializeNativeCompendiumCategory(
  db: Database.Database,
  category: NativeCompendiumCategory,
): Generator<string> {
  yield* serializeDocumentHeader(new Date().toISOString());
  yield* serializeEntries(category, iterateNativeCompendiumEntries(db, category));
  yield "\n}\n";
}

/** Serializes entries incrementally, avoiding one category-sized JSON string allocation. */
export function streamNativeCompendiumBundle(document: NativeCompendiumBundle): Readable {
  return Readable.from(serializeNativeCompendiumBundle(document), { encoding: "utf8" });
}

/** Reads and serializes one category row-by-row from SQLite. */
export function streamNativeCompendiumCategory(db: Database.Database, category: NativeCompendiumCategory): Readable {
  return Readable.from(serializeNativeCompendiumCategory(db, category), { encoding: "utf8" });
}

export function nativeCompendiumExportFilename(category: NativeCompendiumCategory): string {
  return `beholden-compendium-${category}.json`;
}
