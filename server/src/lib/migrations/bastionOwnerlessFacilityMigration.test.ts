import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../db.js";
import { grantOwnerlessBastionFacilities } from "./bastionOwnerlessFacilityMigration.js";

type StoredFacility = { id: string; source: string; ownerPlayerId: string | null; notes?: string };

test("repairs facilities whose owner is gone, leaves owned and granted ones alone, and runs once", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('c', 'Campaign', 1, 1)").run();
    db.prepare("INSERT INTO players (id, campaign_id, character_name, live_json, created_at, updated_at) VALUES ('p-kept', 'c', 'Kept', '{}', 1, 1)").run();
    const facilities: StoredFacility[] = [
      { id: "owned", source: "player", ownerPlayerId: "p-kept" },
      // The broken case: the owner's player row was deleted.
      { id: "orphan", source: "player", ownerPlayerId: "p-deleted", notes: "keep me" },
      { id: "granted", source: "dm_extra", ownerPlayerId: null },
    ];
    db.prepare("INSERT INTO bastions (id, campaign_id, name, notes, facilities_json, created_at, updated_at) VALUES ('b', 'c', 'Keep', '', ?, 1, 100)")
      .run(JSON.stringify(facilities));
    db.prepare("INSERT INTO bastion_players (bastion_id, player_id) VALUES ('b', 'p-kept')").run();

    grantOwnerlessBastionFacilities(db);

    const read = () => db.prepare("SELECT facilities_json, updated_at FROM bastions WHERE id = 'b'").get() as { facilities_json: string; updated_at: number };
    const repaired = read();
    const byId = Object.fromEntries((JSON.parse(repaired.facilities_json) as StoredFacility[]).map((entry) => [entry.id, entry]));
    assert.deepEqual(
      { source: byId.owned?.source, owner: byId.owned?.ownerPlayerId },
      { source: "player", owner: "p-kept" },
    );
    assert.deepEqual(
      { source: byId.orphan?.source, owner: byId.orphan?.ownerPlayerId, notes: byId.orphan?.notes },
      { source: "dm_extra", owner: null, notes: "keep me" },
    );
    assert.equal(byId.granted?.source, "dm_extra");
    assert.ok(repaired.updated_at > 100, "a repaired row gets a new version");

    grantOwnerlessBastionFacilities(db);
    assert.equal(read().updated_at, repaired.updated_at, "nothing left to repair, so no second write");
  } finally {
    db.close();
  }
});
