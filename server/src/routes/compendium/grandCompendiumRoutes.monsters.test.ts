import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importNativeCompendiumBatch } from "../../services/compendium/nativeCompendium.js";
import { CANONICAL_MONSTER, makeTestBatch, db, request, grandEntry } from './grandCompendiumRoutes.fixtures.js';

// ---------------------------------------------------------------------------
  // Monster — GET detail
  // ---------------------------------------------------------------------------

  describe("GET /api/compendium/monsters/:id", () => {
    it("returns 200 for a seeded Grand monster", async () => {
      const { status } = await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`);
      assert.equal(status, 200);
    });

    it("projects source from Grand metadata", async () => {
      const { body } = await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`) as { body: Record<string, unknown> };
      assert.equal(body.source, "PHB");
    });

    it("returns the screen action array with all seeded actions", async () => {
      const { body } = await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`) as { body: Record<string, unknown> };
      const actions = body.action as Array<Record<string, unknown>>;
      assert.ok(Array.isArray(actions), "action should be an array");
      assert.equal(actions.length, 2, "both seeded actions should appear");
      assert.equal(actions[0]?.name, "Multiattack");
      assert.equal(actions[1]?.name, "Bite");
    });

    it("returns the spells array from Grand storage", async () => {
      const { body } = await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`) as { body: Record<string, unknown> };
      const spells = body.spells as unknown[];
      assert.ok(Array.isArray(spells), "spells should be an array");
      assert.ok(spells.length > 0, "canonical spells should be present");
    });

    it("returns 404 for an unknown monster id", async () => {
      const { status } = await request("GET", "/api/compendium/monsters/m_does_not_exist");
      assert.equal(status, 404);
    });
  });


  // ---------------------------------------------------------------------------
  // Monster — PUT preserves canonical-only fields
  // ---------------------------------------------------------------------------

  describe("PUT /api/compendium/monsters/:id", () => {
    it("returns 200 for a valid edit", async () => {
      const grand = await grandEntry(`/api/compendium/monsters/${CANONICAL_MONSTER.id}`);
      const { status, body } = await request(
        "PUT",
        `/api/compendium/monsters/${CANONICAL_MONSTER.id}`,
        { ...grand, name: "Cave Bear (updated)" },
      ) as { status: number; body: Record<string, unknown> };
      assert.equal(status, 200);
      assert.equal(body.ok, true);
    });

    it("source from Grand metadata survives an edit", async () => {
      const grand = await grandEntry(`/api/compendium/monsters/${CANONICAL_MONSTER.id}`);
      // Include actions so the canonical action data is never zeroed by the PUT
      await request("PUT", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`, {
        ...grand,
        name: "Cave Bear",
      });
      const { body } = await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`) as { body: Record<string, unknown> };
      assert.equal(body.source, "PHB", "source must survive PUT");
    });

    it("spellcasting and spells survive an edit via native export", async () => {
      const grand = await grandEntry(`/api/compendium/monsters/${CANONICAL_MONSTER.id}`);
      // Include actions so the canonical action data is never zeroed by the PUT
      await request("PUT", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`, {
        ...grand,
        name: "Cave Bear",
        hitPoints: { formula: "5d10+15" },
      });
      const { status, body } = await request(
        "GET",
        "/api/compendium/native/monsters/export",
      ) as { status: number; body: Record<string, unknown> };
      assert.equal(status, 200);
      const entries = body.monsters as Array<Record<string, unknown>>;
      const exported = entries.find((e) => e.id === CANONICAL_MONSTER.id);
      assert.ok(exported, "exported monster entry must exist");
      const spellcasting = exported.spellcasting as unknown[];
      const spells = exported.spells as unknown[];
      assert.ok(Array.isArray(spellcasting) && spellcasting.length > 0, "spellcasting must survive PUT");
      assert.ok(Array.isArray(spells) && spells.length > 0, "spells must survive PUT");
    });

    it("action recharge survives an edit via native export", async () => {
      // Re-seed so previous tests in this suite don't affect the canonical action state.
      importNativeCompendiumBatch(
        db,
        makeTestBatch("monsters", [CANONICAL_MONSTER]) as Parameters<typeof importNativeCompendiumBatch>[1],
      );
      const grand = await grandEntry(`/api/compendium/monsters/${CANONICAL_MONSTER.id}`);
      // PUT with both actions but no explicit recharge — mergeGrandCompendiumEdit should
      // merge the canonical recharge object from the stored Bite action into the result.
      await request("PUT", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`, {
        ...grand,
        name: "Cave Bear",
      });
      const { body } = await request(
        "GET",
        "/api/compendium/native/monsters/export",
      ) as { body: Record<string, unknown> };
      const entries = body.monsters as Array<Record<string, unknown>>;
      const exported = entries.find((e) => e.id === CANONICAL_MONSTER.id);
      assert.ok(exported, "exported monster entry must exist");
      const actions = exported.actions as Array<Record<string, unknown>>;
      const biteAction = actions.find((a) => a.name === "Bite");
      assert.ok(biteAction, "Bite action must be present in canonical export");
      // recharge is stored as a RechargeSchema object, not a plain string
      const recharge = biteAction.recharge as Record<string, unknown> | null;
      assert.ok(recharge != null, "recharge must survive a complete Grand PUT");
      assert.equal(recharge.roll, 5, "recharge.roll must survive");
    });

    it("requires ruleset identity when the same monster id exists in both editions", async () => {
      const legacy = { ...structuredClone(CANONICAL_MONSTER), ruleset: "5e", name: "Cave Bear (2014)" };
      importNativeCompendiumBatch(
        db,
        makeTestBatch("monsters", [legacy]) as Parameters<typeof importNativeCompendiumBatch>[1],
      );

      assert.equal((await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`)).status, 409);
      const legacyRead = await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}?ruleset=5e`);
      const currentRead = await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}?ruleset=5.5e`);
      assert.equal((legacyRead.body as Record<string, unknown>).name, "Cave Bear (2014)");
      assert.equal((currentRead.body as Record<string, unknown>).name, "Cave Bear");

      const ambiguousDelete = await request("DELETE", `/api/compendium/monsters/${CANONICAL_MONSTER.id}`);
      assert.equal(ambiguousDelete.status, 409);
      const scopedDelete = await request("DELETE", `/api/compendium/monsters/${CANONICAL_MONSTER.id}?ruleset=5e`);
      assert.equal(scopedDelete.status, 200);
      assert.equal((await request("GET", `/api/compendium/monsters/${CANONICAL_MONSTER.id}?ruleset=5.5e`)).status, 200);
    });
  });
