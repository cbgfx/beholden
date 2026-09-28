import type { Db } from "../db.js";
import { CATEGORY_SCHEMAS } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { computeContentHashSync } from "@beholden/shared/domain/compendium/computeContentHashSync";
import { compactClassEntry } from "../../services/compendium/classCompaction.js";
import { compactFeatEntry } from "../../services/compendium/featCompaction.js";

type JsonRecord = Record<string, unknown>;

const TABLES = [
  // Classes now store one `descriptions` array (the old `description` was a copy of its first paragraph).
  { category: "classes", table: "compendium_classes", canonicalize: compactClassEntry },
  // Feat metadata (prerequisite, resolution, source...) now lives only at the top level, not in `mechanics`.
  { category: "feats", table: "compendium_feats", canonicalize: compactFeatEntry },
] as const;

/**
 * Rewrites stored class and feat entries saved in the old shape into the current one.
 *
 * Pack imports already convert old entries on the way in, but rows imported before that change
 * are still in the database, and stored entries are validated on every read -- so without this,
 * every existing class and some feats would fail to load. Uses the same conversion as import, and
 * only touches rows that fail the current schema, so it is idempotent.
 *
 * Returns whether every row is now in the current shape. Rows it cannot read or convert are left
 * as they are and make it return false, so the migration ledger does not record it as finished.
 */
export function canonicalizeStoredClassesAndFeats(db: Db): boolean {
  let complete = true;
  for (const { category, table, canonicalize } of TABLES) {
    const schema = CATEGORY_SCHEMAS[category];
    const rows = db.prepare(`SELECT rowid, data_json FROM ${table}`).all() as Array<{ rowid: number; data_json: string }>;
    const update = db.prepare(`UPDATE ${table} SET data_json = ?, content_hash = ? WHERE rowid = ?`);
    db.transaction(() => {
      for (const row of rows) {
        let stored: unknown;
        try {
          stored = JSON.parse(row.data_json);
        } catch {
          // Unreadable JSON is a different problem; leave it for the read path to report.
          complete = false;
          continue;
        }
        if (stored && typeof stored === "object" && schema.safeParse(stored).success) continue;
        if (!stored || typeof stored !== "object") {
          complete = false;
          continue;
        }
        const converted = canonicalize(stored as JsonRecord);
        // Only write when conversion actually produces a valid entry; otherwise keep the original.
        if (!schema.safeParse(converted).success) {
          complete = false;
          continue;
        }
        update.run(JSON.stringify(converted), computeContentHashSync(converted), row.rowid);
      }
    })();
  }
  return complete;
}
