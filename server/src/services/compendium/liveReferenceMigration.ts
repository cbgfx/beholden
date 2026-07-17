import type Database from "better-sqlite3";
import { canonicalizeCompendiumId } from "../../lib/canonicalCompendiumId.js";

type Db = Database.Database;

export type LiveReferenceMigrationChange = {
  table: string;
  rowId: string;
  field: string;
  path: string;
  from: string;
  to: string;
};

export type LiveReferenceMigrationResult = {
  changedRows: number;
  changedReferences: number;
  changes: LiveReferenceMigrationChange[];
};

const catalogTables = [
  "compendium_monsters", "compendium_items", "compendium_spells", "compendium_class_talents",
  "compendium_classes", "compendium_races", "compendium_backgrounds", "compendium_feats",
] as const;

const jsonFields = [
  ["user_characters", "character_data_json"],
  ["players", "live_json"],
  ["combatants", "snapshot_json"],
  ["combatants", "live_json"],
  ["bastions", "facilities_json"],
] as const;

const scalarFields = [
  ["inpcs", "monster_id"],
  ["combatants", "base_id"],
  ["treasure", "item_id"],
  ["party_inventory", "item_id"],
] as const;

/** Non-derivable renames used only by the explicit one-time live migration.
 * Delete this table after the sole live instance reports a clean migration. */
const oneTimeKnownRenames: Record<string, string> = {
  "m_doppelganger [2024]": "m_doppelganger",
  "m_bandit lord": "m_bandit_crime_lord",
};

function catalogIds(db: Db): Set<string> {
  const ids = new Set<string>();
  for (const table of catalogTables) {
    const rows = db.prepare(`SELECT id FROM ${table}`).all() as Array<{ id: string }>;
    for (const row of rows) ids.add(row.id);
  }
  return ids;
}

function migrateToken(value: string, ids: Set<string>): string {
  const canonical = canonicalizeCompendiumId(value);
  return canonical !== value && ids.has(canonical) ? canonical : value;
}

function migrateReferenceString(value: string, ids: Set<string>): string {
  const alias = oneTimeKnownRenames[value];
  if (alias && ids.has(alias)) return alias;
  const direct = migrateToken(value, ids);
  if (direct !== value) return direct;
  if (!value.includes(":")) return value;
  return value.split(":").map((part) => migrateToken(part, ids)).join(":");
}

export function rewriteGrandCompendiumReferences(
  value: unknown,
  ids: Set<string>,
  onChange: (path: string, from: string, to: string) => void,
  path = "$",
): unknown {
  if (typeof value === "string") {
    const next = migrateReferenceString(value, ids);
    if (next !== value) onChange(path, value, next);
    return next;
  }
  if (Array.isArray(value)) return value.map((entry, index) => rewriteGrandCompendiumReferences(entry, ids, onChange, `${path}[${index}]`));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const nextKey = migrateReferenceString(key, ids);
    if (nextKey !== key) onChange(`${path}.{key}`, key, nextKey);
    out[nextKey] = rewriteGrandCompendiumReferences(entry, ids, onChange, `${path}.${nextKey}`);
  }
  return out;
}

export function migrateLiveCompendiumReferences(db: Db, apply: boolean): LiveReferenceMigrationResult {
  const ids = catalogIds(db);
  if (ids.size === 0) throw new Error("Import the canonical compendium before migrating live references.");
  const changes: LiveReferenceMigrationChange[] = [];
  const rowUpdates: Array<() => void> = [];
  const changedRowKeys = new Set<string>();

  for (const [table, field] of jsonFields) {
    const rows = db.prepare(`SELECT id, ${field} AS value FROM ${table} WHERE ${field} IS NOT NULL`).all() as Array<{ id: string; value: string }>;
    for (const row of rows) {
      let parsed: unknown;
      try { parsed = JSON.parse(row.value); }
      catch { throw new Error(`Cannot migrate invalid JSON in ${table}.${field} for row ${row.id}.`); }
      const rowChanges: LiveReferenceMigrationChange[] = [];
      const rewritten = rewriteGrandCompendiumReferences(parsed, ids, (path, from, to) => rowChanges.push({ table, rowId: row.id, field, path, from, to }));
      if (rowChanges.length === 0) continue;
      changes.push(...rowChanges);
      changedRowKeys.add(`${table}:${row.id}`);
      rowUpdates.push(() => db.prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`).run(JSON.stringify(rewritten), row.id));
    }
  }

  for (const [table, field] of scalarFields) {
    const rows = db.prepare(`SELECT id, ${field} AS value FROM ${table} WHERE ${field} IS NOT NULL AND ${field} <> ''`).all() as Array<{ id: string; value: string }>;
    for (const row of rows) {
      const next = migrateReferenceString(row.value, ids);
      if (next === row.value) continue;
      changes.push({ table, rowId: row.id, field, path: "$", from: row.value, to: next });
      changedRowKeys.add(`${table}:${row.id}`);
      rowUpdates.push(() => db.prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`).run(next, row.id));
    }
  }

  if (apply && rowUpdates.length > 0) db.transaction(() => rowUpdates.forEach((update) => update()))();
  return { changedRows: changedRowKeys.size, changedReferences: changes.length, changes };
}
