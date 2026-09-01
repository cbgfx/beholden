import fs from "node:fs";
import type Database from "better-sqlite3";
import { nativeEntryKey } from "@beholden/shared/domain/compendium/nativeCompendiumKey";
import { importValidatedNativeCompendiumBatches } from "./nativeCompendiumImport.js";
import { assertNativeCompendiumGuardrails } from "./nativeCompendiumGuardrails.js";
import { existingNativeContent } from "./nativeCompendiumManifest.js";
import { parseNativeCompendiumDocument } from "./nativeCompendiumParsing.js";
import type { NativeCompendiumDocumentImportResult } from "./nativeCompendiumShared.js";
import { computeContentHashSync } from "@beholden/shared/domain/compendium/computeContentHashSync";

const DEFAULT_SRD_URL = new URL("../../../../shared/src/srd/default_compendium_5.5e.json", import.meta.url);
const DEFAULT_SRD_IMPORT_KEY = "default_srd_5_2_1_imported";
const DEFAULT_SRD_MODIFIER_SCOPES_KEY = "default_srd_modifier_metadata_v2";
const RETIRED_DEFAULT_SRD_MODIFIERS = new Map([
  ["i_quarterstaff_of_the_acrobat", [{ target: "ac", amount: 5 }]],
  ["i_rod_of_alertness", [{ target: "ac", amount: 1 }, { target: "saving_throws", amount: 1 }]],
]);

/** Add newly-authored modifier scopes to matching legacy SRD modifiers without replacing locally
 * edited items. This is data-driven across every bundled item: target and amount must still match,
 * and an existing scope is never overwritten. */
function backfillDefaultSrdModifierScopes(db: Database.Database): void {
  if (db.prepare("SELECT 1 FROM application_metadata WHERE key = ?").get(DEFAULT_SRD_MODIFIER_SCOPES_KEY)) return;
  const document = JSON.parse(fs.readFileSync(DEFAULT_SRD_URL, "utf8")) as { items?: Array<Record<string, unknown>> };
  const select = db.prepare("SELECT data_json FROM compendium_items WHERE id = ? AND ruleset = ?");
  const update = db.prepare("UPDATE compendium_items SET data_json = ?, content_hash = ? WHERE id = ? AND ruleset = ?");
  db.transaction(() => {
    for (const bundled of document.items ?? []) {
      const id = String(bundled.id ?? "");
      const ruleset = String(bundled.ruleset ?? "5.5e");
      const corrected = (bundled.modifiers as Array<Record<string, unknown>> | undefined)?.filter((modifier) =>
        Array.isArray(modifier.weaponNames) || modifier.requiresNoArmor === true || modifier.requiresNoShield === true
      ) ?? [];
      const retired = RETIRED_DEFAULT_SRD_MODIFIERS.get(id) ?? [];
      if (corrected.length === 0 && retired.length === 0) continue;
      const row = select.get(id, ruleset) as { data_json: string } | undefined;
      if (!row) continue;
      const existing = JSON.parse(row.data_json) as Record<string, unknown>;
      const modifiers = (existing.modifiers as Array<Record<string, unknown>> | undefined) ?? [];
      let changed = false;
      for (const source of corrected) {
        const target = modifiers.find((modifier) => modifier.target === source.target && modifier.amount === source.amount);
        if (!target) continue;
        for (const field of ["weaponNames", "requiresNoArmor", "requiresNoShield"] as const) {
          if (source[field] !== undefined && target[field] === undefined) target[field] = source[field];
        }
        changed = true;
      }
      for (const obsolete of retired) {
        const index = modifiers.findIndex((modifier) => modifier.target === obsolete.target && modifier.amount === obsolete.amount && Object.keys(modifier).length === 2);
        if (index >= 0) {
          modifiers.splice(index, 1);
          changed = true;
        }
      }
      if (modifiers.length === 0) delete existing.modifiers;
      if (changed) update.run(JSON.stringify(existing), computeContentHashSync(existing), id, ruleset);
    }
    db.prepare("INSERT OR REPLACE INTO application_metadata (key, value) VALUES (?, ?)").run(DEFAULT_SRD_MODIFIER_SCOPES_KEY, "complete");
  })();
}

/**
 * Adds the distributable SRD baseline once per database without replacing any
 * records already present. The completion marker is written atomically with the
 * import so later launches preserve local edits and intentional deletions.
 */
export function seedDefaultSrdCompendium(db: Database.Database): NativeCompendiumDocumentImportResult {
  const alreadyImported = db.prepare("SELECT 1 FROM application_metadata WHERE key = ?").get(DEFAULT_SRD_IMPORT_KEY);
  if (alreadyImported) {
    backfillDefaultSrdModifierScopes(db);
    return { imported: 0, total: 0, batches: [] };
  }

  const result = generateDefaultSrdCompendium(db);
  backfillDefaultSrdModifierScopes(db);
  return result;
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
