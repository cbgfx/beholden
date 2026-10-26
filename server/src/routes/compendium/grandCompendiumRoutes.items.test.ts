import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CANONICAL_ITEM, request, grandEntry } from './grandCompendiumRoutes.fixtures.js';

// ---------------------------------------------------------------------------
  // Item — GET detail
  // ---------------------------------------------------------------------------

  describe("GET /api/compendium/items/:itemId", () => {
    it("returns 200 for a seeded Grand item", async () => {
      const { status } = await request("GET", `/api/compendium/items/${CANONICAL_ITEM.id}`);
      assert.equal(status, 200);
    });

    it("returns the item's name and rarity from Grand projection", async () => {
      const { body } = await request("GET", `/api/compendium/items/${CANONICAL_ITEM.id}`) as { body: Record<string, unknown> };
      assert.equal(body.name, "Amulet of Health");
      assert.equal(body.rarity, "rare");
      assert.equal(body.ruleset, "5.5e");
      assert.equal(body.source, CANONICAL_ITEM.source);
      assert.deepEqual(body.uses, { max: 7, recover: "1d6+1" });
      assert.deepEqual(body.spells, { s_compat_fireball: { cost: 5, level: 5 } });
      assert.deepEqual(body.spellcasting, { dc: 17 });
    });

    it("returns bundle and container facts required by the inventory picker", async () => {
      const grand = await grandEntry(`/api/compendium/items/${CANONICAL_ITEM.id}`);
      await request("PUT", `/api/compendium/items/${CANONICAL_ITEM.id}`, {
        ...grand,
        bundle: { container: "i_backpack", items: { i_torch: 10 } },
      });
      const { body } = await request("GET", `/api/compendium/items/${CANONICAL_ITEM.id}`) as { body: Record<string, unknown> };
      assert.deepEqual(body.bundle, { container: "i_backpack", items: { i_torch: 10 } });
      assert.equal(body.container, false);
      assert.equal(body.ignoreWeight, false);
    });

    it("returns 404 for an unknown item id", async () => {
      const { status } = await request("GET", "/api/compendium/items/i_does_not_exist");
      assert.equal(status, 404);
    });
  });


  // ---------------------------------------------------------------------------
  // Item — PUT preserves canonical-only fields
  // ---------------------------------------------------------------------------

  describe("PUT /api/compendium/items/:itemId", () => {
    it("returns 200 for a valid edit", async () => {
      const grand = await grandEntry(`/api/compendium/items/${CANONICAL_ITEM.id}`);
      const { status, body } = await request(
        "PUT",
        `/api/compendium/items/${CANONICAL_ITEM.id}`,
        { ...grand, name: "Amulet of Health" },
      ) as { status: number; body: Record<string, unknown> };
      assert.equal(status, 200);
      assert.equal(body.ok, true);
    });

    it("source and attunement.requirements survive an edit via native export", async () => {
      const grand = await grandEntry(`/api/compendium/items/${CANONICAL_ITEM.id}`);
      await request("PUT", `/api/compendium/items/${CANONICAL_ITEM.id}`, {
        ...grand,
        name: "Amulet of Health",
      });
      const { status, body } = await request(
        "GET",
        "/api/compendium/native/items/export",
      ) as { status: number; body: Record<string, unknown> };
      assert.equal(status, 200);
      const entries = body.items as Array<Record<string, unknown>>;
      const exported = entries.find((e) => e.id === CANONICAL_ITEM.id);
      assert.ok(exported, "exported item entry must exist");
      assert.equal(exported.source, "DMG", "source must survive PUT");
      assert.equal(
        exported.attunement,
        "requires attunement",
        "attunement requirements must survive PUT",
      );
    });

    it("canonical rolls survive an edit via native export", async () => {
      const grand = await grandEntry(`/api/compendium/items/${CANONICAL_ITEM.id}`);
      await request("PUT", `/api/compendium/items/${CANONICAL_ITEM.id}`, {
        ...grand,
        name: "Amulet of Health",
      });
      const { body } = await request(
        "GET",
        "/api/compendium/native/items/export",
      ) as { body: Record<string, unknown> };
      const entries = body.items as Array<Record<string, unknown>>;
      const exported = entries.find((e) => e.id === CANONICAL_ITEM.id);
      assert.ok(exported, "exported item entry must exist");
      const rolls = exported.rolls as unknown[];
      assert.ok(Array.isArray(rolls) && rolls.length > 0, "rolls must survive PUT");
      assert.deepEqual(exported.uses, { max: 7, recover: "1d6+1" }, "uses must survive PUT");
      assert.deepEqual(exported.spells, { s_compat_fireball: { cost: 5, level: 5 } }, "spells must survive PUT");
      assert.deepEqual(exported.spellcasting, { dc: 17 }, "spellcasting must survive PUT");
    });
  });
