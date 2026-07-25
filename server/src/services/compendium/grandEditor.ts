import type Database from "better-sqlite3";
import { canonicalizeCompendiumId } from "../../lib/canonicalCompendiumId.js";
import {
  BEHOLDEN_COMPENDIUM_FORMAT,
  BEHOLDEN_COMPENDIUM_SCHEMA,
  importNativeCompendiumDocument,
  type NativeCompendiumCategory,
} from "./nativeCompendium.js";
import { CATEGORY_SCHEMAS } from "./grandCompendiumSchemas.js";

type JsonRecord = Record<string, unknown>;

export function grandEntryId(prefix: string, name: unknown): string {
  const slug = canonicalizeCompendiumId(String(name ?? ""));
  if (!slug) throw new Error("A name is required to create a compendium entry.");
  return `${prefix}_${slug}`;
}

/** The editor boundary accepts the same cold-fact record that Grand JSON stores.
 * No legacy body, prose parser, or partial-field preservation merge is involved. */
export function saveGrandEntry(
  db: Database.Database,
  category: NativeCompendiumCategory,
  body: unknown,
  id: string,
): JsonRecord {
  const candidate = {
    ...(body && typeof body === "object" && !Array.isArray(body) ? body as JsonRecord : {}),
    id,
  };
  const entry = CATEGORY_SCHEMAS[category].parse(candidate) as JsonRecord;
  importNativeCompendiumDocument(db, {
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    schema: BEHOLDEN_COMPENDIUM_SCHEMA,
    exportedAt: new Date().toISOString(),
    [category]: [entry],
  });
  return entry;
}
