type JsonRecord = Record<string, unknown>;

const monsterColumnKeys = new Set([
  "id", "name", "nameKey", "name_key", "cr", "crNumeric", "cr_numeric",
  "typeKey", "type_key", "typeFull", "type_full", "size", "environment",
]);

const spellColumnKeys = new Set([
  "id", "name", "nameKey", "name_key", "baseName", "baseKey", "base_key",
  "level", "school", "ritual", "concentration", "components", "classes",
]);

const itemColumnKeys = new Set([
  "id", "name", "nameKey", "name_key", "rarity", "type", "typeKey",
  "type_key", "attunement", "magic", "equippable", "proficiency", "weight", "value",
]);

const classColumnKeys = new Set(["id", "name", "nameKey", "name_key", "hd"]);
const raceColumnKeys = new Set(["id", "name", "nameKey", "name_key", "size", "speed"]);
const backgroundColumnKeys = new Set(["id", "name", "nameKey", "name_key"]);
const featColumnKeys = new Set(["id", "name", "nameKey", "name_key"]);

function pruneKeys(source: JsonRecord, keys: Set<string>): JsonRecord {
  const out: JsonRecord = { ...source };
  for (const key of keys) delete out[key];
  return out;
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
