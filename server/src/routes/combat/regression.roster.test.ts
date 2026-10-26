import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { broadcasts, encounterId, dmRequest } from './regression.fixtures.js';

describe("add-combatant encounter resolution and broadcast (shared helpers)", () => {
    it("returns 404 for an unknown encounter before doing any work", async () => {
      const res = await dmRequest(
        "POST",
        `/api/encounters/encounter-does-not-exist/combatants/addWorldAction`,
        { name: "Ghost hazard" },
      );
      assert.equal(res.status, 404);
      assert.equal((res.body as { message?: string }).message, "Encounter not found");
    });

    it("announces a newly added combatant with a full inline DTO", async () => {
      broadcasts.length = 0;
      const created = await dmRequest(
        "POST",
        `/api/encounters/${encounterId}/combatants/addWorldAction`,
        { name: "Lair Action" },
      );
      assert.equal(created.status, 200);
      const id = String((created.body.created as Record<string, unknown>).id);
      const delta = broadcasts.find(
        (e) => e.type === "encounter:combatantsDelta" && (e.payload as { combatantId?: string }).combatantId === id,
      );
      assert.ok(delta, "an upsert delta must be broadcast for the new combatant");
      assert.equal(delta!.payload.action, "upsert");
      assert.equal((delta!.payload.combatant as { id?: string } | undefined)?.id, id);
    });
  });


  describe("world actions", () => {
    it("creates a statless turn-order entry and preserves its reminder text", async () => {
      const created = await dmRequest(
        "POST",
        `/api/encounters/${encounterId}/combatants/addWorldAction`,
        { name: "Falling Meteors", description: "A meteor strikes a random quadrant." },
      );
      assert.equal(created.status, 200);
      const dto = created.body.created as Record<string, unknown>;
      assert.equal(dto.baseType, "world");
      const snapshot = dto.snapshot as Record<string, unknown>;
      const live = dto.live as Record<string, unknown>;
      assert.equal(snapshot.label, "Falling Meteors");
      assert.equal(snapshot.description, "A meteor strikes a random quadrant.");
      assert.equal(snapshot.hpMax, null);
      assert.equal(snapshot.ac, null);
      assert.equal(live.hpCurrent, null);
      assert.equal(live.initiative, null);

      const updated = await dmRequest(
        "PUT",
        `/api/encounters/${encounterId}/combatants/${String(dto.id)}`,
        { initiative: 17, label: "Meteor Shower", description: "Three impacts this round." },
      );
      assert.equal(updated.status, 200);
      const updatedSnapshot = updated.body.snapshot as Record<string, unknown>;
      const updatedLive = updated.body.live as Record<string, unknown>;
      assert.equal(updatedSnapshot.label, "Meteor Shower");
      assert.equal(updatedSnapshot.description, "Three impacts this round.");
      assert.equal(updatedLive.initiative, 17);
    });
  });
