import type { Db } from "./db.js";

const COMPENDIUM_TABLES = [
  "compendium_classes",
  "compendium_races",
  "compendium_backgrounds",
  "compendium_feats",
  "compendium_items",
  "compendium_spells",
  "compendium_monsters",
] as const;

/** Renames any `kind: "legacy_special"` effect entries (in place) to the current `"source_special"`
 * kind — same shape, just an old label from before the importer was renamed. Returns whether
 * anything changed, so callers only write back rows that actually needed it. */
function renameLegacySpecialKind(value: unknown): boolean {
  if (Array.isArray(value)) {
    let changed = false;
    for (const entry of value) {
      if (renameLegacySpecialKind(entry)) changed = true;
    }
    return changed;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    let changed = false;
    if (record.kind === "legacy_special") {
      record.kind = "source_special";
      changed = true;
    }
    for (const key of Object.keys(record)) {
      if (renameLegacySpecialKind(record[key])) changed = true;
    }
    return changed;
  }
  return false;
}

/**
 * Self-healing startup fixup: some compendium rows were imported before the effect kind
 * "legacy_special" was renamed to "source_special" (identical shape). The current schema only
 * recognizes "source_special", so any stored row still using the old name fails validation on
 * read — which previously caused silent proficiency loss when the character editor submitted
 * without a fully-loaded class/race/background detail. Idempotent and cheap (no-op once fixed).
 */
export function normalizeLegacyCompendiumEffectKinds(db: Db): void {
  for (const table of COMPENDIUM_TABLES) {
    const rows = db
      .prepare(`SELECT id, data_json FROM ${table} WHERE data_json LIKE '%legacy_special%'`)
      .all() as Array<{ id: string; data_json: string }>;
    if (rows.length === 0) continue;
    const update = db.prepare(`UPDATE ${table} SET data_json = ? WHERE id = ?`);
    for (const row of rows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.data_json);
      } catch {
        continue;
      }
      if (!renameLegacySpecialKind(parsed)) continue;
      update.run(JSON.stringify(parsed), row.id);
    }
  }
}
