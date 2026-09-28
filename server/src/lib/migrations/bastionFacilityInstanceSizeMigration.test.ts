import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../db.js";
import { fillBastionFacilityInstanceSizes } from "./bastionFacilityInstanceSizeMigration.js";

type StoredFacility = { id: string; facilityKey: string; size?: string };

test("gives stored facilities their starting size, keeps existing sizes, and runs once", () => {
  const db = openDb(":memory:");
  try {
    const insertFacility = db.prepare(`
      INSERT INTO compendium_bastion_facilities
        (id, ruleset, name, name_key, facility_type, minimum_level, orders_json, space, hirelings, allow_multiple, data_json)
      VALUES (?, '5.5e', ?, ?, ?, 0, '[]', ?, 1, 0, '{}')
    `);
    insertFacility.run("bf_bedroom", "Bedroom", "bedroom", "basic", null);
    insertFacility.run("bf_barrack", "Barrack", "barrack", "special", "Roomy");

    db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('c', 'Campaign', 1, 1)").run();
    const facilities: StoredFacility[] = [
      { id: "basic", facilityKey: "bedroom" },
      { id: "special", facilityKey: "barrack" },
      // Already upgraded by the DM: must not be reset.
      { id: "sized", facilityKey: "barrack", size: "vast" },
      // No definition to take a size from.
      { id: "unknown", facilityKey: "moat" },
    ];
    db.prepare("INSERT INTO bastions (id, campaign_id, name, notes, facilities_json, created_at, updated_at) VALUES ('b', 'c', 'Keep', '', ?, 1, 100)")
      .run(JSON.stringify(facilities));

    fillBastionFacilityInstanceSizes(db);

    const read = () => db.prepare("SELECT facilities_json, updated_at FROM bastions WHERE id = 'b'").get() as { facilities_json: string; updated_at: number };
    const filled = read();
    const sizes = Object.fromEntries((JSON.parse(filled.facilities_json) as StoredFacility[]).map((entry) => [entry.id, entry.size]));
    assert.deepEqual(sizes, { basic: "cramped", special: "roomy", sized: "vast", unknown: undefined });
    assert.ok(filled.updated_at > 100, "a changed row gets a new version");

    fillBastionFacilityInstanceSizes(db);
    assert.equal(read().updated_at, filled.updated_at, "nothing left to fill, so no second write");
  } finally {
    db.close();
  }
});
