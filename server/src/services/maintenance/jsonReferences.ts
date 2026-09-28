// server/src/services/maintenance/jsonReferences.ts
//
// References stored inside JSON, which no schema check can see.
//
// The column side of the "points at nothing" problem is guarded by referenceRegistry.test.ts, which
// reads the schema. JSON has no schema to read, so this reads the data instead: it checks every
// JSON reference we know about against what it should point at, and - the part that keeps this
// honest over time - reports any id-shaped key it finds that nobody has classified yet. A new JSON
// reference therefore shows up in `npm run db:maintenance` the first time it is stored, instead of
// the first time it breaks.

import type Database from "better-sqlite3";

/** Where the character sheet's default container lives; items in it may name it without it being listed. */
const DEFAULT_CONTAINER_ID = "backpack-default";

type JsonReferenceCheck = {
  /** Human description of where the reference lives and what it points at. */
  reference: string;
  checked: number;
  dangling: number;
  /** What a dangling one does, so the report says whether it matters. */
  effect: string;
};

export type JsonReferenceReport = {
  checks: JsonReferenceCheck[];
  /** Id-shaped keys found in stored JSON that are not classified below. Each needs a decision. */
  unclassified: string[];
};

// Keys that end in "Id" but are not references to anything that can disappear: labels, local keys,
// and compendium ids (which are denormalized - the sheet keeps its own copy of what it needs).
const NOT_REFERENCES = new Set([
  // `instanceId` names one stored spell inside an item on the same sheet - a local identity for
  // that entry, not a pointer at another row.
  "sourceFeatureId", "occurrenceId", "valueId", "activeId", "concentrationId", "instanceId",
]);
// Compendium ids on a character sheet (background, species, class, feats, inventory items). Not
// checked: the sheet keeps its own copy of what it needs, so a missing compendium row is tolerated
// by design and the compendium can be cleared and reimported.
const COMPENDIUM_KEYS = new Set([
  "bgId", "raceId", "classId", "featId", "chosenBgOriginFeatId", "chosenRaceFeatId", "itemId", "monsterId", "spellId",
  "chosenClassFeatIds", "extraFeatIds",
]);
// Keys checked by the rules below.
const CHECKED_KEYS = new Set(["casterId", "containerId", "linkedAmmoId", "classEntryId"]);

function parse(json: unknown): Record<string, unknown> | null {
  if (typeof json !== "string" || !json) return null;
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function collectIdKeys(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) { for (const item of value) collectIdKeys(item, into); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/(Id|Ids|_id)$/.test(key)) into.add(key);
    collectIdKeys(child, into);
  }
}

function eachClassEntryRef(sheet: Record<string, unknown>, visit: (id: string) => void): void {
  const lists: unknown[] = [
    ...Object.values((sheet.proficiencies ?? {}) as Record<string, unknown>),
    sheet.chosenLevelUpFeats,
    sheet.hpProgressionHistory,
    sheet.progressionSelectionOccurrences,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const id = (entry as { classEntryId?: unknown } | null)?.classEntryId;
      if (typeof id === "string" && id) visit(id);
    }
  }
}

export function scanJsonReferences(db: Database.Database): JsonReferenceReport {
  const seenKeys = new Set<string>();

  // --- combat: a condition's caster must be in the same encounter ---------------------------
  // Kept valid by: removeCombatant ends Hex, Hunter's Mark and concentration effects with their
  // caster, and checkCombatIntegrity strips any left stranded at startup.
  const caster: JsonReferenceCheck = {
    reference: "combatants.live_json conditions[].casterId -> a combatant in the same encounter",
    checked: 0,
    dangling: 0,
    effect: "Hex or Hunter's Mark outlives its caster; checkCombatIntegrity ends these at startup",
  };
  const inEncounter = db.prepare("SELECT 1 FROM combatants WHERE id = ? AND encounter_id = ?");
  for (const row of db.prepare("SELECT encounter_id AS encounterId, live_json AS json FROM combatants").all() as { encounterId: string; json: string }[]) {
    const live = parse(row.json);
    if (!live) continue;
    collectIdKeys(live, seenKeys);
    for (const condition of Array.isArray(live.conditions) ? live.conditions : []) {
      const casterId = (condition as { casterId?: unknown } | null)?.casterId;
      if (typeof casterId !== "string" || !casterId) continue;
      caster.checked += 1;
      if (!inEncounter.get(casterId, row.encounterId)) caster.dangling += 1;
    }
  }

  // --- character sheets: references between entries of the same sheet ------------------------
  // Kept valid by:
  // - containerId: removing a container moves its contents to the default backpack.
  // - linkedAmmoId: inventoryWithout unlinks it whenever the ammo leaves the sheet, and readers
  //   treat a missing target as unlinked.
  // - classEntryId: character progression (Codex's area); this report is the check.
  const container: JsonReferenceCheck = {
    reference: "character inventory[].containerId -> that sheet's inventoryContainers[].id",
    checked: 0, dangling: 0,
    effect: "an item in a container that is not listed; removing a container moves its contents out",
  };
  const ammo: JsonReferenceCheck = {
    reference: "character inventory[].linkedAmmoId -> another item in that inventory",
    checked: 0, dangling: 0,
    effect: "none on screen - the sheet treats missing ammo as unlinked - but the stale link stays",
  };
  const classEntry: JsonReferenceCheck = {
    reference: "character *.classEntryId -> that sheet's classes[].id",
    checked: 0, dangling: 0,
    effect: "a proficiency, feat or HP record tied to a class the character no longer has (progression)",
  };
  for (const row of db.prepare("SELECT character_data_json AS json FROM user_characters").all() as { json: string }[]) {
    const sheet = parse(row.json);
    if (!sheet) continue;
    collectIdKeys(sheet, seenKeys);
    const inventory = Array.isArray(sheet.inventory) ? sheet.inventory as Array<Record<string, unknown>> : [];
    const containers = new Set((Array.isArray(sheet.inventoryContainers) ? sheet.inventoryContainers as Array<{ id?: unknown }> : []).map((c) => c?.id));
    const itemIds = new Set(inventory.map((item) => item?.id));
    for (const item of inventory) {
      if (typeof item?.containerId === "string" && item.containerId) {
        container.checked += 1;
        if (item.containerId !== DEFAULT_CONTAINER_ID && !containers.has(item.containerId)) container.dangling += 1;
      }
      if (typeof item?.linkedAmmoId === "string" && item.linkedAmmoId) {
        ammo.checked += 1;
        if (!itemIds.has(item.linkedAmmoId)) ammo.dangling += 1;
      }
    }
    const classIds = new Set((Array.isArray(sheet.classes) ? sheet.classes as Array<{ id?: unknown }> : []).map((c) => c?.id));
    eachClassEntryRef(sheet, (id) => {
      classEntry.checked += 1;
      if (!classIds.has(id)) classEntry.dangling += 1;
    });
  }

  // Every other JSON column in the database is swept for keys, so a reference added anywhere is
  // noticed - not just in the tables above. The compendium is reference data and is skipped.
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'compendium_%'").all() as { name: string }[])
    .map((row) => row.name);
  for (const table of tables) {
    const jsonColumns = (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[])
      .map((column) => column.name)
      .filter((name) => name.endsWith("_json"));
    for (const column of jsonColumns) {
      for (const row of db.prepare(`SELECT "${column}" AS json FROM "${table}"`).all() as { json: string }[]) {
        const value = parse(row.json);
        if (value) collectIdKeys(value, seenKeys);
      }
    }
  }

  const unclassified = [...seenKeys]
    .filter((key) => !NOT_REFERENCES.has(key) && !COMPENDIUM_KEYS.has(key) && !CHECKED_KEYS.has(key))
    .sort();

  return { checks: [caster, container, ammo, classEntry], unclassified };
}
