import type Database from "better-sqlite3";
import { canonicalizeCompendiumId } from "../../lib/canonicalCompendiumId.js";

type JsonRecord = Record<string, unknown>;

export function spellAccessId(label: string): string {
  return `sl_${canonicalizeCompendiumId(label)}`;
}

export function readSpellAccessRegistry(db: Database.Database): Map<string, string> {
  const registry = new Map<string, string>();
  const rows = db.prepare("SELECT data_json FROM compendium_classes").all() as Array<{ data_json: string }>;
  for (const row of rows) {
    let parsed: JsonRecord;
    try { parsed = JSON.parse(row.data_json) as JsonRecord; } catch { continue; }
    const lists = parsed.spellLists;
    if (!lists || typeof lists !== "object" || Array.isArray(lists)) continue;
    for (const [id, label] of Object.entries(lists as JsonRecord)) registry.set(id, String(label));
  }
  return registry;
}

export function resolveSpellAccessFilters(db: Database.Database, values: string[]): string[] {
  const registry = readSpellAccessRegistry(db);
  const byLabel = new Map([...registry].map(([id, label]) => [label.toLowerCase(), id]));
  return values.map((value) => value.startsWith("sl_") ? value : byLabel.get(value.toLowerCase()) ?? spellAccessId(value));
}
