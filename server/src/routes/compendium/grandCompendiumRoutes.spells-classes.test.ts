import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CANONICAL_SPELL, CANONICAL_CLASS_TALENT, CANONICAL_BACKGROUND, CANONICAL_CLASS, request, grandEntry } from './grandCompendiumRoutes.fixtures.js';

describe("GET /api/class-talents/search", () => {
    it("returns canonical talents independently from spells", async () => {
      const { status, body } = await request("GET", "/api/class-talents/search?kind=invocation&includeText=1") as { status: number; body: Array<Record<string, unknown>> };
      assert.equal(status, 200);
      assert.equal(body.length, 1);
      assert.equal(body[0]?.id, CANONICAL_CLASS_TALENT.id);
      assert.equal(body[0]?.kind, "invocation");
      assert.equal(body[0]?.text, "A test invocation.");
      assert.deepEqual(body[0]?.prerequisite, { level: 2, cantrip: "damage" });
      assert.equal(body[0]?.repeatable, true);
      assert.deepEqual(body[0]?.effects, CANONICAL_CLASS_TALENT.effects);
    });
  });



  // ---------------------------------------------------------------------------
  // Spell — GET detail
  // ---------------------------------------------------------------------------

  describe("GET /api/spells/:spellId", () => {
    it("returns 200 for a seeded Grand spell", async () => {
      const { status } = await request("GET", `/api/spells/${CANONICAL_SPELL.id}`);
      assert.equal(status, 200);
    });

    it("returns the spell level from Grand projection", async () => {
      const { body } = await request("GET", `/api/spells/${CANONICAL_SPELL.id}`) as { body: Record<string, unknown> };
      assert.equal(body.level, 3);
      assert.equal(body.school, "Evocation");
    });

    it("renders stable spell access IDs as class labels", async () => {
      const { body } = await request("GET", `/api/spells/${CANONICAL_SPELL.id}`) as { body: Record<string, unknown> };
      assert.equal(body.classes, "Sorcerer, Wizard");
    });

    it("returns 404 for an unknown spell id", async () => {
      const { status } = await request("GET", "/api/spells/s_does_not_exist");
      assert.equal(status, 404);
    });
  });


  // ---------------------------------------------------------------------------
  // Spell — PUT preserves canonical-only fields
  // ---------------------------------------------------------------------------

  describe("PUT /api/spells/:spellId", () => {
    it("returns 200 for a valid edit", async () => {
      const grand = await grandEntry(`/api/spells/${CANONICAL_SPELL.id}`);
      const { status, body } = await request(
        "PUT",
        `/api/spells/${CANONICAL_SPELL.id}`,
        { ...grand, name: "Compat Fireball", level: 3, school: "Evocation" },
      ) as { status: number; body: Record<string, unknown> };
      assert.equal(status, 200);
      assert.equal(body.ok, true);
    });

    it("source survives an edit via native export", async () => {
      const grand = await grandEntry(`/api/spells/${CANONICAL_SPELL.id}`);
      await request("PUT", `/api/spells/${CANONICAL_SPELL.id}`, {
        ...grand,
        name: "Compat Fireball",
      });
      const { status, body } = await request(
        "GET",
        "/api/compendium/native/spells/export",
      ) as { status: number; body: Record<string, unknown> };
      assert.equal(status, 200);
      const entries = body.spells as Array<Record<string, unknown>>;
      const exported = entries.find((e) => e.id === CANONICAL_SPELL.id);
      assert.ok(exported, "exported spell entry must exist");
      assert.equal(exported.source, "XGE", "source must survive PUT");
    });

    it("canonical rolls survive an edit via native export", async () => {
      const grand = await grandEntry(`/api/spells/${CANONICAL_SPELL.id}`);
      await request("PUT", `/api/spells/${CANONICAL_SPELL.id}`, {
        ...grand,
        name: "Compat Fireball",
        description: ["Each creature in a 20-foot-radius sphere must make a Dexterity saving throw."],
      });
      const { body } = await request(
        "GET",
        "/api/compendium/native/spells/export",
      ) as { body: Record<string, unknown> };
      const entries = body.spells as Array<Record<string, unknown>>;
      const exported = entries.find((e) => e.id === CANONICAL_SPELL.id);
      assert.ok(exported, "exported spell entry must exist");
      const rolls = exported.rolls as unknown[];
      assert.ok(Array.isArray(rolls) && rolls.length > 0, "rolls must survive PUT");
    });
  });


  describe("GET /api/compendium/canonical/classes/:id", () => {
    it("returns the canonical class shape for Grand consumers", async () => {
      const { status, body } = await request(
        "GET",
        `/api/compendium/canonical/classes/${CANONICAL_CLASS.id}?ruleset=5.5e`,
      ) as { status: number; body: Record<string, unknown> };
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.levels));
      assert.equal(body.autolevels, undefined);
    });
  });


  describe("GET /api/compendium/canonical/backgrounds/:id", () => {
    it("projects equipment item display names from the item catalog at read time", async () => {
      const { status, body } = await request(
        "GET",
        `/api/compendium/canonical/backgrounds/${CANONICAL_BACKGROUND.id}?ruleset=5.5e`,
      ) as { status: number; body: Record<string, unknown> };
      assert.equal(status, 200);
      const options = (body.equipment as { options: Array<{ entries: Array<Record<string, unknown>> }> }).options;
      const entries = options[0]?.entries ?? [];
      assert.equal(entries.length, 3);
      const [plain, labeled, currency] = entries as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];
      // No stored label → the catalog name is projected into `name` (one fact, one home in storage).
      assert.equal(plain.name, "Amulet of Health");
      assert.equal(plain.sourceLabel, undefined);
      // A stored label that intentionally differs wins, and no projected name is added beside it.
      assert.equal(labeled.sourceLabel, "Amulet (blessed)");
      assert.equal(labeled.name, undefined);
      assert.equal(currency.kind, "currency");
    });
  });
