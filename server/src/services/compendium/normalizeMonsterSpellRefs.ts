import type Database from "better-sqlite3";
import { normalizeKey } from "../../lib/text.js";

export type MonsterSpellRef = {
  spellId: string | null;
  name: string;
};

function extractMonsterSpellNames(value: unknown): string[] {
  const out: string[] = [];
  const push = (entry: unknown) => {
    const rawName =
      entry && typeof entry === "object" && "name" in (entry as Record<string, unknown>)
        ? (entry as Record<string, unknown>).name
        : entry;
    const text = String(rawName ?? "").trim();
    if (!text) return;
    for (const part of text.split(/[,;]/g)) {
      const name = part.trim();
      if (name) out.push(name);
    }
  };

  if (Array.isArray(value)) {
    for (const entry of value) push(entry);
  } else if (typeof value === "string") {
    push(value);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of out) {
    const key = normalizeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique;
}

function normalizeMonsterSpellRefs(
  names: string[],
  findSpellByKey: (key: string, baseKey: string) => { id: string; name: string } | undefined,
): MonsterSpellRef[] {
  return names.map((name) => {
    const displayName = String(name).trim();
    const fullKey = normalizeKey(displayName);
    const baseName = displayName.replace(/\s*\[[^\]]+\]\s*$/u, "").trim() || displayName;
    const baseKey = normalizeKey(baseName);
    const match = findSpellByKey(fullKey, baseKey);
    return {
      spellId: match?.id ?? null,
      name: match?.name ?? displayName,
    };
  });
}

export function backfillMonsterSpellRefs(db: Database.Database): void {
  const spellRows = db.prepare(
    `SELECT id, name, name_key, json_extract(data_json, '$.base_key') AS base_key FROM compendium_spells`
  ).all() as Array<{ id: string; name: string; name_key: string; base_key: string | null }>;

  const spellByFullKey = new Map<string, { id: string; name: string }>();
  const spellByBaseKey = new Map<string, { id: string; name: string }>();
  for (const row of spellRows) {
    spellByFullKey.set(String(row.name_key ?? ""), { id: row.id, name: row.name });
    if (row.base_key) spellByBaseKey.set(String(row.base_key), { id: row.id, name: row.name });
  }
  const findSpellByKey = (key: string, baseKey: string) =>
    spellByFullKey.get(key) ?? spellByBaseKey.get(baseKey);

  const monsters = db.prepare("SELECT id, data_json FROM compendium_monsters").all() as Array<{ id: string; data_json: string }>;
  const updateMonsterDataStmt = db.prepare(`
    UPDATE compendium_monsters
    SET data_json = ?
    WHERE id = ?
  `);

  for (const row of monsters) {
    const data = row.data_json ? JSON.parse(row.data_json) : null;
    if (!data || typeof data !== "object") continue;
    const names = extractMonsterSpellNames((data as { spells?: unknown }).spells);
    const nextSpells = normalizeMonsterSpellRefs(names, findSpellByKey);
    updateMonsterDataStmt.run(
      JSON.stringify({
        ...data,
        spells: nextSpells,
      }),
      row.id,
    );
  }
}

