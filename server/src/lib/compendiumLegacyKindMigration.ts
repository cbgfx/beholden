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

const LEGACY_KIND_PREFIX = "legacy_";
const SOURCE_KIND_PREFIX = "source_";

/** Renames any `kind: "legacy_*"` effect entries (in place) to the current `"source_*"` kind —
 * identical shape, just an old label from before the importer was renamed (e.g. "legacy_special"
 * -> "source_special", "legacy_modifier" -> "source_modifier", "legacy_proficiency" ->
 * "source_proficiency"). Returns whether anything changed, so callers only write back rows that
 * actually needed it. */
function renameLegacyKinds(value: unknown): boolean {
  if (Array.isArray(value)) {
    let changed = false;
    for (const entry of value) {
      if (renameLegacyKinds(entry)) changed = true;
    }
    return changed;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    let changed = false;
    if (typeof record.kind === "string" && record.kind.startsWith(LEGACY_KIND_PREFIX)) {
      record.kind = SOURCE_KIND_PREFIX + record.kind.slice(LEGACY_KIND_PREFIX.length);
      changed = true;
    }
    for (const key of Object.keys(record)) {
      if (renameLegacyKinds(record[key])) changed = true;
    }
    return changed;
  }
  return false;
}

/**
 * Self-healing startup fixup: some compendium rows were imported before effect kinds like
 * "legacy_special"/"legacy_modifier"/"legacy_proficiency" were renamed to their current
 * "source_*" equivalents (identical shape). The current schema only recognizes the "source_*"
 * names, so any stored row still using an old name fails validation on read — which previously
 * caused silent proficiency loss when the character editor submitted without a fully-loaded
 * class/race/background detail. Idempotent and cheap (no-op once fixed).
 */
export function normalizeLegacyCompendiumEffectKinds(db: Db): void {
  for (const table of COMPENDIUM_TABLES) {
    // classes/races/backgrounds/feats can have two rows sharing the same `id` (one per
    // ruleset, composite PRIMARY KEY (id, ruleset)) -- always scope the UPDATE by both
    // columns, or this would silently overwrite both rulesets' rows with one's content.
    const rows = db
      .prepare(`SELECT id, ruleset, data_json FROM ${table} WHERE data_json LIKE '%legacy_%'`)
      .all() as Array<{ id: string; ruleset: string; data_json: string }>;
    if (rows.length === 0) continue;
    const update = db.prepare(`UPDATE ${table} SET data_json = ? WHERE id = ? AND ruleset = ?`);
    for (const row of rows) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.data_json);
      } catch {
        continue;
      }
      if (!renameLegacyKinds(parsed)) continue;
      update.run(JSON.stringify(parsed), row.id, row.ruleset);
    }
  }
}
