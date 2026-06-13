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
  "id",
  "name",
  "nameKey",
  "name_key",
  "rarity",
  "type",
  "typeKey",
  "type_key",
  "attunement",
  "magic",
  "equippable",
  "proficiency",
  "weight",
  "value",
]);

const classColumnKeys = new Set([
  "id",
  "name",
  "nameKey",
  "name_key",
  "hd",
]);

const raceColumnKeys = new Set([
  "id",
  "name",
  "nameKey",
  "name_key",
  "size",
  "speed",
]);

const backgroundColumnKeys = new Set([
  "id",
  "name",
  "nameKey",
  "name_key",
]);

const featColumnKeys = new Set([
  "id",
  "name",
  "nameKey",
  "name_key",
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

function utf8Bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
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

export function pruneClassBlob(data: JsonRecord): JsonRecord {
  return pruneKeys(data, classColumnKeys);
}

export function pruneRaceBlob(data: JsonRecord): JsonRecord {
  return pruneKeys(data, raceColumnKeys);
}

export function pruneBackgroundBlob(data: JsonRecord): JsonRecord {
  return pruneKeys(data, backgroundColumnKeys);
}

export function pruneFeatBlob(data: JsonRecord): JsonRecord {
  return pruneKeys(data, featColumnKeys);
}

export function trimCompendiumBlobColumns(db: Database.Database): {
  updatedMonsters: number;
  updatedSpells: number;
  updatedItems: number;
  updatedClasses: number;
  updatedRaces: number;
  updatedBackgrounds: number;
  updatedFeats: number;
} {
  const updateMonster = db.prepare("UPDATE compendium_monsters SET data_json = ? WHERE id = ?");
  const updateSpell = db.prepare("UPDATE compendium_spells SET data_json = ? WHERE id = ?");
  const updateItem = db.prepare("UPDATE compendium_items SET data_json = ? WHERE id = ?");
  const updateClass = db.prepare("UPDATE compendium_classes SET data_json = ? WHERE id = ?");
  const updateRace = db.prepare("UPDATE compendium_races SET data_json = ? WHERE id = ?");
  const updateBackground = db.prepare("UPDATE compendium_backgrounds SET data_json = ? WHERE id = ?");
  const updateFeat = db.prepare("UPDATE compendium_feats SET data_json = ? WHERE id = ?");

  let updatedMonsters = 0;
  let updatedSpells = 0;
  let updatedItems = 0;
  let updatedClasses = 0;
  let updatedRaces = 0;
  let updatedBackgrounds = 0;
  let updatedFeats = 0;

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

  for (const row of db.prepare("SELECT id, data_json FROM compendium_classes").all() as Array<{ id: string; data_json: string }>) {
    const parsed = parseJsonObject(row.data_json);
    if (!parsed) continue;
    const pruned = pruneClassBlob(parsed);
    const nextJson = JSON.stringify(pruned);
    if (nextJson !== row.data_json) {
      updateClass.run(nextJson, row.id);
      updatedClasses += 1;
    }
  }

  for (const row of db.prepare("SELECT id, data_json FROM compendium_races").all() as Array<{ id: string; data_json: string }>) {
    const parsed = parseJsonObject(row.data_json);
    if (!parsed) continue;
    const pruned = pruneRaceBlob(parsed);
    const nextJson = JSON.stringify(pruned);
    if (nextJson !== row.data_json) {
      updateRace.run(nextJson, row.id);
      updatedRaces += 1;
    }
  }

  for (const row of db.prepare("SELECT id, data_json FROM compendium_backgrounds").all() as Array<{ id: string; data_json: string }>) {
    const parsed = parseJsonObject(row.data_json);
    if (!parsed) continue;
    const pruned = pruneBackgroundBlob(parsed);
    const nextJson = JSON.stringify(pruned);
    if (nextJson !== row.data_json) {
      updateBackground.run(nextJson, row.id);
      updatedBackgrounds += 1;
    }
  }

  for (const row of db.prepare("SELECT id, data_json FROM compendium_feats").all() as Array<{ id: string; data_json: string }>) {
    const parsed = parseJsonObject(row.data_json);
    if (!parsed) continue;
    const pruned = pruneFeatBlob(parsed);
    const nextJson = JSON.stringify(pruned);
    if (nextJson !== row.data_json) {
      updateFeat.run(nextJson, row.id);
      updatedFeats += 1;
    }
  }

  return {
    updatedMonsters,
    updatedSpells,
    updatedItems,
    updatedClasses,
    updatedRaces,
    updatedBackgrounds,
    updatedFeats,
  };
}

type TableEstimate = {
  rows: number;
  bytesBefore: number;
  bytesAfter: number;
  bytesSaved: number;
  rowsChanged: number;
};

function estimateTableTrim(
  db: Database.Database,
  table: string,
  prune: (data: JsonRecord) => JsonRecord,
): TableEstimate {
  let rows = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;
  let rowsChanged = 0;
  for (const row of db.prepare(`SELECT data_json FROM ${table}`).all() as Array<{ data_json: string }>) {
    rows += 1;
    const before = String(row.data_json ?? "");
    bytesBefore += utf8Bytes(before);
    const parsed = parseJsonObject(before);
    if (!parsed) {
      bytesAfter += utf8Bytes(before);
      continue;
    }
    const after = JSON.stringify(prune(parsed));
    bytesAfter += utf8Bytes(after);
    if (after !== before) rowsChanged += 1;
  }
  return { rows, bytesBefore, bytesAfter, bytesSaved: Math.max(0, bytesBefore - bytesAfter), rowsChanged };
}

export function estimateCompendiumBlobTrim(db: Database.Database) {
  const monsters = estimateTableTrim(db, "compendium_monsters", pruneMonsterBlob);
  const spells = estimateTableTrim(db, "compendium_spells", pruneSpellBlob);
  const items = estimateTableTrim(db, "compendium_items", pruneItemBlob);
  const classes = estimateTableTrim(db, "compendium_classes", pruneClassBlob);
  const races = estimateTableTrim(db, "compendium_races", pruneRaceBlob);
  const backgrounds = estimateTableTrim(db, "compendium_backgrounds", pruneBackgroundBlob);
  const feats = estimateTableTrim(db, "compendium_feats", pruneFeatBlob);
  const totals = {
    rows: monsters.rows + spells.rows + items.rows + classes.rows + races.rows + backgrounds.rows + feats.rows,
    bytesBefore:
      monsters.bytesBefore +
      spells.bytesBefore +
      items.bytesBefore +
      classes.bytesBefore +
      races.bytesBefore +
      backgrounds.bytesBefore +
      feats.bytesBefore,
    bytesAfter:
      monsters.bytesAfter +
      spells.bytesAfter +
      items.bytesAfter +
      classes.bytesAfter +
      races.bytesAfter +
      backgrounds.bytesAfter +
      feats.bytesAfter,
    bytesSaved:
      monsters.bytesSaved +
      spells.bytesSaved +
      items.bytesSaved +
      classes.bytesSaved +
      races.bytesSaved +
      backgrounds.bytesSaved +
      feats.bytesSaved,
    rowsChanged:
      monsters.rowsChanged +
      spells.rowsChanged +
      items.rowsChanged +
      classes.rowsChanged +
      races.rowsChanged +
      backgrounds.rowsChanged +
      feats.rowsChanged,
  };
  return { monsters, spells, items, classes, races, backgrounds, feats, totals };
}
