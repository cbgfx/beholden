import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { ensurePartyInventoryPayloadColumn } from "./partyInventoryPayloadColumnMigration.js";

test("adds party_inventory.payload_json to an existing database, idempotently", () => {
  const db = new Database(":memory:");
  try {
    // A pre-payload_json party_inventory table (mirrors the old schema).
    db.exec(`CREATE TABLE party_inventory (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'New Item',
      quantity INTEGER NOT NULL DEFAULT 1, weight REAL, notes TEXT NOT NULL DEFAULT '',
      source TEXT, item_id TEXT, rarity TEXT, type TEXT, description TEXT,
      sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`);
    db.prepare("INSERT INTO party_inventory (id, campaign_id, name, created_at, updated_at) VALUES ('r1', 'c1', 'Rope', 1, 1)").run();

    const hasColumn = () =>
      (db.prepare("PRAGMA table_info(party_inventory)").all() as Array<{ name: string }>).some((c) => c.name === "payload_json");
    assert.equal(hasColumn(), false);

    ensurePartyInventoryPayloadColumn(db);
    ensurePartyInventoryPayloadColumn(db); // second run is a no-op
    assert.equal(hasColumn(), true);

    // Existing rows read back with a NULL payload; new rows can store one.
    assert.equal(db.prepare("SELECT payload_json FROM party_inventory WHERE id = 'r1'").pluck().get(), null);
    db.prepare("UPDATE party_inventory SET payload_json = ? WHERE id = 'r1'").run(JSON.stringify({ charges: 2 }));
    assert.equal(db.prepare("SELECT payload_json FROM party_inventory WHERE id = 'r1'").pluck().get(), '{"charges":2}');
  } finally {
    db.close();
  }
});
