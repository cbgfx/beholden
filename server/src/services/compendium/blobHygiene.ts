import type Database from "better-sqlite3";

type JsonRecord = Record<string, unknown>;

const monsterColumnKeys = new Set([
  "id",
  "name",
  "nameKey",
  "name_key",
  "cr",
  "cr_numeric",
  "typeKey",
  "type_key",
  "typeFull",
  "type_full",
  "size",
  "environment",
]);

const spellColumnKeys = new Set([
  "id",
  "name",
  "nameKey",
  "name_key",
  "baseName",
  "baseKey",
  "base_key",
  "level",
  "school",
  "ritual",
  "concentration",
  "components",
  "classes",
]);

const itemColumnKeys = new Set([
  "weight",
  "value",
]);

function pruneKeys(source: JsonRecord, keys: Set<string>): JsonRecord {
  const out: JsonRecord = { ...source };
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      delete out[key];
    }
  }
  return out;
}

function parseJsonObject(json: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as JsonRecord;
  } catch {
    return null;
  }
}

export function pruneMonsterBlob(data: JsonRecord): JsonRecord {
  return pruneKeys(data, monsterColumnKeys);
}

export function pruneSpellBlob(data: JsonRecord): JsonRecord {
  return pruneKeys(data, spellColumnKeys);
}

export function pruneItemBlob(data: JsonRecord): JsonRecord {
  return pruneKeys(data, itemColumnKeys);
}

export function trimCompendiumBlobColumns(db: Database.Database): {
  updatedMonsters: number;
  updatedSpells: number;
  updatedItems: number;
} {
  const updateMonster = db.prepare("UPDATE compendium_monsters SET data_json = ? WHERE id = ?");
  const updateSpell = db.prepare("UPDATE compendium_spells SET data_json = ? WHERE id = ?");
  const updateItem = db.prepare("UPDATE compendium_items SET data_json = ? WHERE id = ?");

  let updatedMonsters = 0;
  let updatedSpells = 0;
  let updatedItems = 0;

  for (const row of db.prepare("SELECT id, data_json FROM compendium_monsters").all() as Array<{ id: string; data_json: string }>) {
    const parsed = parseJsonObject(row.data_json);
    if (!parsed) continue;
    const pruned = pruneMonsterBlob(parsed);
    const nextJson = JSON.stringify(pruned);
    if (nextJson !== row.data_json) {
      updateMonster.run(nextJson, row.id);
      updatedMonsters += 1;
    }
  }

  for (const row of db.prepare("SELECT id, data_json FROM compendium_spells").all() as Array<{ id: string; data_json: string }>) {
    const parsed = parseJsonObject(row.data_json);
    if (!parsed) continue;
    const pruned = pruneSpellBlob(parsed);
    const nextJson = JSON.stringify(pruned);
    if (nextJson !== row.data_json) {
      updateSpell.run(nextJson, row.id);
      updatedSpells += 1;
    }
  }

  for (const row of db.prepare("SELECT id, data_json FROM compendium_items").all() as Array<{ id: string; data_json: string }>) {
    const parsed = parseJsonObject(row.data_json);
    if (!parsed) continue;
    const pruned = pruneItemBlob(parsed);
    const nextJson = JSON.stringify(pruned);
    if (nextJson !== row.data_json) {
      updateItem.run(nextJson, row.id);
      updatedItems += 1;
    }
  }

  return { updatedMonsters, updatedSpells, updatedItems };
}
