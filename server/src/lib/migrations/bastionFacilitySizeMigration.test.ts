import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../db.js";
import { fillMissingBastionFacilitySizes } from "./bastionFacilitySizeMigration.js";

type FacilityRow = { space: string | null; hirelings: number | null; data_json: string };

function insertFacility(db: ReturnType<typeof openDb>, name: string, type: string, space: string | null, hirelings: number | null) {
  const key = name.toLowerCase().replace(/\s+/g, "-");
  db.prepare(`
    INSERT INTO compendium_bastion_facilities
      (id, ruleset, name, name_key, facility_type, minimum_level, orders_json, space, hirelings, allow_multiple, data_json)
    VALUES (?, '5.5e', ?, ?, ?, 5, '[]', ?, ?, 0, ?)
  `).run(`bf_${key}`, name, key, type, space, hirelings, JSON.stringify({ name, space, hirelings }));
}

function readFacility(db: ReturnType<typeof openDb>, name: string): FacilityRow {
  return db.prepare("SELECT space, hirelings, data_json FROM compendium_bastion_facilities WHERE name = ?").get(name) as FacilityRow;
}

test("fills null space and hirelings on the six affected facilities, columns and data_json alike", () => {
  const db = openDb(":memory:");
  try {
    insertFacility(db, "Reliquary", "special", null, null);
    insertFacility(db, "Sanctum", "special", null, null);
    fillMissingBastionFacilitySizes(db);

    const reliquary = readFacility(db, "Reliquary");
    assert.equal(reliquary.space, "Cramped");
    assert.equal(reliquary.hirelings, 1);
    assert.deepEqual(JSON.parse(reliquary.data_json), { name: "Reliquary", space: "Cramped", hirelings: 1 });

    const sanctum = readFacility(db, "Sanctum");
    assert.equal(sanctum.space, "Roomy");
    assert.equal(sanctum.hirelings, 4);
  } finally {
    db.close();
  }
});

test("keeps values that were already filled in and leaves unrelated facilities alone", () => {
  const db = openDb(":memory:");
  try {
    // A DM who already typed a space in keeps it; only the missing hireling count is filled.
    insertFacility(db, "Demiplane", "special", "Roomy", null);
    // Basic facilities legitimately have no space; the fixup must not touch them.
    insertFacility(db, "Bedroom", "basic", null, 0);
    fillMissingBastionFacilitySizes(db);
    fillMissingBastionFacilitySizes(db); // idempotent

    const demiplane = readFacility(db, "Demiplane");
    assert.equal(demiplane.space, "Roomy");
    assert.equal(demiplane.hirelings, 1);
    assert.equal(JSON.parse(demiplane.data_json).space, "Roomy");

    const bedroom = readFacility(db, "Bedroom");
    assert.equal(bedroom.space, null);
    assert.equal(bedroom.hirelings, 0);
  } finally {
    db.close();
  }
});
