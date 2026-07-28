import type { Db } from "./db.js";

// The 8 content-comparable compendium tables (see CONTENT_COMPARABLE_QUERIES in
// nativeCompendium.ts) -- each carries a single `data_json` blob that a `content_hash` can be
// computed over.
const CONTENT_HASH_TABLES = [
  "compendium_monsters",
  "compendium_items",
  "compendium_spells",
  "compendium_class_talents",
  "compendium_classes",
  "compendium_races",
  "compendium_backgrounds",
  "compendium_feats",
] as const;

/** Adds the nullable `content_hash` column to databases created before this feature existed.
 * Deliberately does NOT backfill existing rows here -- that would mean hashing every compendium
 * entry on every startup for installs that may never use the manifest endpoint. Rows stay NULL
 * until first read through the manifest lookup, which computes and persists the hash on demand
 * (see the manifest route in routes/compendium/admin.ts). Old rows with NULL content_hash remain
 * fully valid in the meantime -- this is a strictly opportunistic optimization. */
export function ensureCompendiumContentHashColumns(db: Db): void {
  for (const table of CONTENT_HASH_TABLES) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "content_hash")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN content_hash TEXT`);
    }
  }
}
