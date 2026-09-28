/**
 * The JSON half of the "points at nothing" guard. Columns are checked against the schema by
 * referenceRegistry.test.ts; JSON has no schema, so this reads stored data - checking the references
 * we know about, and naming any id-shaped key nobody has classified so a new one is noticed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { scanJsonReferences } from "./jsonReferences.js";

function seed(sheet: Record<string, unknown>, conditions: unknown[] = []): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES ('u', 'u', 'h', 'U', ?, ?)").run(t, t);
  db.prepare("INSERT INTO user_characters (id, user_id, name, character_data_json, created_at, updated_at) VALUES ('c', 'u', 'C', ?, ?, ?)")
    .run(JSON.stringify(sheet), t, t);
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp', 'Camp', ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv', 'camp', 'A', 1, ?, ?)").run(t, t);
  db.prepare("INSERT INTO encounters (id, campaign_id, adventure_id, name, sort, created_at, updated_at) VALUES ('enc', 'camp', 'adv', 'E', 1, ?, ?)").run(t, t);
  db.prepare(`INSERT INTO combatants (id, encounter_id, base_type, base_id, snapshot_json, live_json, sort, created_at, updated_at)
    VALUES ('goblin', 'enc', 'monster', 'm', '{}', ?, 1, ?, ?)`).run(JSON.stringify({ conditions }), t, t);
  return db;
}

const check = (report: ReturnType<typeof scanJsonReferences>, fragment: string) =>
  report.checks.find((entry) => entry.reference.includes(fragment))!;

test("references inside a sheet are checked against that same sheet", () => {
  const db = seed({
    inventoryContainers: [{ id: "bag" }],
    inventory: [
      { id: "bow", name: "Longbow", linkedAmmoId: "arrows-gone" },
      { id: "rope", name: "Rope", containerId: "bag" },
      { id: "torch", name: "Torch", containerId: "backpack-default" },
      { id: "gem", name: "Gem", containerId: "chest-gone" },
    ],
    classes: [{ id: "class-1", classId: "c_wizard" }],
    proficiencies: { skills: [{ name: "Arcana", classEntryId: "class-1" }, { name: "Athletics", classEntryId: "class-gone" }] },
  });
  const report = scanJsonReferences(db);
  assert.deepEqual([check(report, "linkedAmmoId").checked, check(report, "linkedAmmoId").dangling], [1, 1]);
  // The default backpack need not be listed to be real.
  assert.deepEqual([check(report, "containerId").checked, check(report, "containerId").dangling], [3, 1]);
  assert.deepEqual([check(report, "classEntryId").checked, check(report, "classEntryId").dangling], [2, 1]);
  db.close();
});

test("a condition whose caster has left the encounter is counted", () => {
  const db = seed({}, [{ key: "hexed", casterId: "warlock-gone" }, { key: "prone" }]);
  assert.deepEqual([check(scanJsonReferences(db), "casterId").checked, check(scanJsonReferences(db), "casterId").dangling], [1, 1]);
  db.close();
});

test("an id-shaped key nobody has classified is named, so a new reference gets a decision", () => {
  const db = seed({ bgId: "bg-sage", inventory: [{ id: "x", itemId: "longsword" }], familiarCompanionId: "someone" });
  const report = scanJsonReferences(db);
  assert.deepEqual(report.unclassified, ["familiarCompanionId"], "compendium ids and checked keys are not reported");
  db.close();
});
