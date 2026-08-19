import fs from "node:fs";
import type Database from "better-sqlite3";
import { nativeEntryKey } from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import { importValidatedNativeCompendiumBatches } from "./nativeCompendiumImport.js";
import { assertNativeCompendiumGuardrails } from "./nativeCompendiumGuardrails.js";
import { existingNativeContent } from "./nativeCompendiumManifest.js";
import { parseNativeCompendiumDocument } from "./nativeCompendiumParsing.js";
import type { NativeCompendiumDocumentImportResult } from "./nativeCompendiumShared.js";

const DEFAULT_SRD_URL = new URL("../../../../shared/src/srd/default_compendium_5.5e.json", import.meta.url);
const DEFAULT_SRD_IMPORT_KEY = "default_srd_5_2_1_imported";

/**
 * Adds the distributable SRD baseline once per database without replacing any
 * records already present. The completion marker is written atomically with the
 * import so later launches preserve local edits and intentional deletions.
 */
export function seedDefaultSrdCompendium(db: Database.Database): NativeCompendiumDocumentImportResult {
  const alreadyImported = db.prepare("SELECT 1 FROM application_metadata WHERE key = ?").get(DEFAULT_SRD_IMPORT_KEY);
  if (alreadyImported) return { imported: 0, total: 0, batches: [] };

  return generateDefaultSrdCompendium(db);
}

/**
 * Adds every bundled SRD entry that is currently missing. Unlike startup
 * seeding, this can be run again after a compendium has been cleared.
 */
export function generateDefaultSrdCompendium(db: Database.Database): NativeCompendiumDocumentImportResult {

  return db.transaction(() => {
    const document: unknown = JSON.parse(fs.readFileSync(DEFAULT_SRD_URL, "utf8"));
    const missingBatches = parseNativeCompendiumDocument(document)
      .map((batch) => {
        const existing = existingNativeContent(db, batch.category);
        return {
          ...batch,
          entries: batch.entries.filter((entry) => !existing.has(nativeEntryKey(batch.category, {
            id: String(entry.id),
            ruleset: entry.ruleset ? String(entry.ruleset) : undefined,
          }))),
        };
      })
      .filter((batch) => batch.entries.length > 0);

    let result: NativeCompendiumDocumentImportResult = { imported: 0, total: 0, batches: [] };
    if (missingBatches.length > 0) {
      assertNativeCompendiumGuardrails(db, missingBatches);
      result = importValidatedNativeCompendiumBatches(db, missingBatches);
    }
    db.prepare("INSERT OR REPLACE INTO application_metadata (key, value) VALUES (?, ?)").run(DEFAULT_SRD_IMPORT_KEY, "complete");
    return result;
  })();
}
