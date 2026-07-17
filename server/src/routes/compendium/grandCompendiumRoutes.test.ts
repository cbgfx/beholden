/**
 * HTTP-level integration tests for Grand compendium routes.
 *
 * Tests that:
 *  - GET detail routes project Grand fields (source, action, spells) correctly.
 *  - PUT routes for monsters/items/spells preserve canonical-only fields that the
 *    edit body never carries (source, spellcasting, spells, recharge, attunement.requirements, rolls).
 *  - GET /api/compendium/classes/:id projects Grand for current screens.
 */
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import http from "node:http";
import net from "node:net";
import express from "express";
import Database from "better-sqlite3";
import multer from "multer";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { signToken } from "../../lib/jwtAuth.js";
import { requireAuth } from "../../middleware/auth.js";
import { registerCompendiumRoutes } from "../compendium.js";
import { importNativeCompendiumBatch } from "../../services/compendium/nativeCompendium.js";
import { compactClassEntry } from "../../services/compendium/classCompaction.js";
import { compactItemEntry } from "../../services/compendium/itemCompaction.js";
import { compactMonsterEntry } from "../../services/compendium/monsterCompaction.js";
import { compactSpellEntry } from "../../services/compendium/spellCompaction.js";
import type { ServerContext } from "../../server/context.js";

// ---------------------------------------------------------------------------
// Test data — Grand records with fields that should survive a PUT edit
// ---------------------------------------------------------------------------

const CANONICAL_MONSTER = {
  schemaVersion: 2,
  id: "m_compat_cave_bear",
  name: "Cave Bear",
  source: "PHB",
  classification: {
    size: "L",
    type: "beast",
    description: "Large beast",
    sortName: null,
    alignment: null,
    ancestry: null,
    environment: ["arctic"],
  },
  description: "A large bear that lives in caves.",
  initiativeBonus: null,
  passivePerception: 13,
  npc: false,
  challenge: { rating: "2", xp: 450 },
  armorClass: { value: 12, source: null },
  hitPoints: { average: 42, formula: "5d10 + 15" },
  movement: { walk: 40, burrow: null, climb: 30, fly: null, swim: null, hover: false },
  abilities: { str: 20, dex: 10, con: 16, int: 2, wis: 13, cha: 7 },
  proficiencies: { savingThrows: [], skills: [{ name: "Perception", bonus: 3 }] },
  defenses: {
    vulnerabilities: [],
    resistances: [],
    damageImmunities: [],
    conditionImmunities: [],
  },
  senses: ["Darkvision 60 ft."],
  languages: [],
  traits: [],
  actions: [
    {
      id: "multiattack",
      name: "Multiattack",
      description: "The cave bear makes two attacks: one bite and one claws.",
      category: null,
      recharge: null,
      attack: null,
      attacks: [],
    },
    {
      id: "bite",
      name: "Bite",
      description: "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 9 (1d8+5) piercing damage.",
      category: null,
      // RechargeSchema object — this is the canonical-only field PUT must preserve
      recharge: { roll: 5 },
      attack: {
        toHit: 7,
        reach: "5 ft.",
        range: null,
        melee: true,
        ranged: false,
        damage: "1d8+5",
        damageType: "piercing",
      },
      attacks: [],
    },
  ],
  reactions: [],
  legendaryActions: [],
  // spellcasting entries use ActionEntrySchema (same shape as actions)
  spellcasting: [
    {
      id: "sc_innate",
      name: "Innate Spellcasting",
      description: "The cave bear's innate spellcasting ability is Wisdom (spell save DC 11).",
      category: null,
      recharge: null,
      attack: null,
      attacks: [],
    },
  ],
  spells: [{ id: "s_compat_fireball" }],
};

const CANONICAL_ITEM = {
  schemaVersion: 2,
  id: "i_compat_amulet_health",
  name: "Amulet of Health",
  source: "DMG",
  classification: {
    type: "Wondrous Item",
    typeKey: "wondrous_item",
    rarity: "rare",
    magical: true,
  },
  attunement: { required: true, requirements: "requires attunement" },
  equipment: { equippable: true, weight: 1, value: null, proficiency: null },
  armor: { armorClass: null, stealthDisadvantage: false, strengthRequirement: null },
  weapon: {
    oneHandedDamage: null,
    twoHandedDamage: null,
    damageType: null,
    range: null,
    properties: [],
  },
  detail: null,
  modifiers: [{ target: "saving_throws", amount: 1 }],
  effects: [{ type: "ability_score", mode: "set_minimum", ability: "con", choiceCount: 1, amount: 19, gate: { duration: "while_equipped" } }],
  uses: { max: 7, recover: "1d6+1", depletion: { destroy: 1 } },
  spells: { s_compat_fireball: { cost: 5, level: 5 } },
  spellcasting: { dc: 17 },
  // ItemRollSchema: { description, formula } — no name field
  rolls: [{ description: "Quick heal", formula: "2d8+2" }],
  description: ["While wearing this amulet, your Constitution score is 19."],
};

const CANONICAL_SPELL = {
  schemaVersion: 2,
  id: "s_compat_fireball",
  name: "Compat Fireball",
  source: "XGE",
  level: 3,
  school: "Evocation",
  casting: {
    time: "1 Action",
    range: "150 feet",
    components: { verbal: true, somatic: true, material: { required: true, description: "a tiny ball of bat guano" } },
    duration: { description: "Instantaneous", concentration: false },
  },
  ritual: false,
  access: ["sl_sorcerer", "sl_wizard"],
  // SpellRollSchema: { description, scaling, level, formula } — no name field
  rolls: [{ description: "Fire damage on hit", scaling: null, level: null, formula: "8d6" }],
  description: ["Each creature in a 20-foot-radius sphere must make a Dexterity saving throw."],
};

const CANONICAL_CLASS_TALENT = {
  id: "ct_invocation_compat_test",
  name: "Invocation: Compat Test",
  kind: "invocation",
  prerequisite: { level: 2, cantrip: "damage" },
  repeatable: true,
  effects: [{ type: "spell_grant", spellName: "Mage Armor", mode: "at_will", castsWithoutSlot: true }],
  description: ["A test invocation."],
};

const CANONICAL_BACKGROUND = {
  id: "bg_compat_acolyte",
  name: "Compat Acolyte",
  description: "A compact test background.",
  proficiencies: { skills: ["Insight", "Religion"] },
  equipment: {
    options: [{
      id: "A",
      entries: [
        // Stored without a display label — the route projects the catalog name at read time.
        { kind: "item", itemId: "i_compat_amulet_health", quantity: 1 },
        // Stored WITH a label because it intentionally differs from the catalog name.
        { kind: "item", itemId: "i_compat_amulet_health", quantity: 1, sourceLabel: "Amulet (blessed)" },
        { kind: "currency", denomination: "GP", amount: 8 },
      ],
    }],
  },
};

// Full Grand class — includes all current Grand fields.
const CANONICAL_CLASS = {
  schemaVersion: 2,
  id: "c_compat_fighter",
  name: "Compat Fighter",
  spellLists: { sl_sorcerer: "Sorcerer", sl_wizard: "Wizard" },
  description: "A warrior skilled in all forms of combat.",
  hitDie: 10,
  startingWealth: null,
  proficiencies: {
    savingThrows: ["str", "con"],
    skills: { choose: 2, from: ["Athletics", "Acrobatics", "History"] },
    armor: ["All Armor"],
    weapons: ["Martial Weapons", "Simple Weapons"],
    tools: { fixed: [], choices: [], notes: [] },
  },
  spellcasting: { ability: null, slotRecovery: "long_rest" },
  levels: [
    {
      level: 1,
      abilityScoreImprovement: false,
      cantripsKnown: null,
      spellSlots: {},
      features: [
        {
          id: "fighter_1_second_wind",
          name: "Second Wind",
          description: "You can use a Bonus Action to regain 1d10 + fighter level hit points.",
          optional: false,
          effects: [],
          scalingRolls: [],
          preparedSpellProgression: [],
        },
      ],
      resources: [{ name: "Second Wind", uses: 1, recovery: "short_rest", subclass: null }],
    },
    {
      level: 2,
      abilityScoreImprovement: false,
      cantripsKnown: null,
      spellSlots: {},
      features: [
        {
          id: "fighter_2_action_surge",
          name: "Action Surge",
          description: "You can take one additional action.",
          optional: false,
          effects: [],
          scalingRolls: [],
          preparedSpellProgression: [],
        },
      ],
      resources: [{ name: "Action Surge", uses: 1, recovery: "short_rest", subclass: null }],
    },
  ],
};

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

function makeTestBatch(
  category: string,
  entries: Record<string, unknown>[],
) {
  const converters: Record<string, (entry: Record<string, unknown>) => Record<string, unknown>> = {
    monsters: compactMonsterEntry,
    items: compactItemEntry,
    spells: compactSpellEntry,
    classes: compactClassEntry,
  };
  return {
    format: "beholden.compendium",
    schema: "grand",
    category,
    exportedAt: "2026-06-28T00:00:00.000Z",
    entries: entries.map((entry) => converters[category]?.(entry) ?? entry),
  };
}

describe("Grand compendium routes — HTTP integration", () => {
  let server: http.Server;
  let port: number;
  let db: Database.Database;

  const adminToken = signToken({
    userId: "test-admin",
    username: "admin",
    isAdmin: true,
  });

  function request(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: url,
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
            ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk; });
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: data });
            }
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async function grandEntry(url: string): Promise<Record<string, unknown>> {
    const result = await request("GET", `${url}?view=grand`);
    assert.equal(result.status, 200);
    return result.body as Record<string, unknown>;
  }

  function requestBuffer(url: string): Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
  }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: url,
          method: "GET",
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }));
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  before(async () => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);

    const upload = multer({ storage: multer.memoryStorage() });
    const ctx: ServerContext = {
      runtime: { appName: "test", host: "127.0.0.1", port: 0, dataDir: "" },
      paths: {
        dataDir: "",
        dbPath: ":memory:",
        webDistDir: "",
        hasWebDist: false,
        webPlayerDistDir: "",
        hasWebPlayerDist: false,
        repoRootDir: "",
      },
      os,
      fs,
      path,
      db,
      broadcast: (() => {}) as ServerContext["broadcast"],
      upload,
      helpers: {
        now: () => Date.now(),
        uid: () => Math.random().toString(36).slice(2),
        normalizeKey: (s: string) =>
          s.toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, ""),
        parseLeadingInt: () => null,
        normalizeHp: (v: unknown) => v,
        ensureCombat: () => {},
        nextLabelNumber: () => 1,
        createPlayerCombatant: ((() => ({})) as unknown) as ServerContext["helpers"]["createPlayerCombatant"],
        seedDefaultConditions: () => {},
      },
    };

    const app = express();
    app.use(express.json());
    // Apply auth to all /api routes (mirrors createServer.ts without health/login exemptions)
    app.use("/api", requireAuth);
    registerCompendiumRoutes(app, ctx);

    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as net.AddressInfo).port;

    // Seed Grand records via the native import service
    importNativeCompendiumBatch(
      db,
      makeTestBatch("monsters", [CANONICAL_MONSTER]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("items", [CANONICAL_ITEM]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("spells", [CANONICAL_SPELL]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("classTalents", [CANONICAL_CLASS_TALENT]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("classes", [CANONICAL_CLASS]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("backgrounds", [CANONICAL_BACKGROUND]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );

  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    db.close();
  });

  describe("GET /api/compendium/native/export-all.zip", () => {
    it("returns one ZIP containing a JSON file for every category", async () => {
      const response = await requestBuffer("/api/compendium/native/export-all.zip");
      assert.equal(response.status, 200);
      assert.equal(response.headers["content-type"], "application/zip");
      assert.match(
        String(response.headers["content-disposition"]),
        /filename=beholden-compendium-all\.zip/,
      );
      assert.equal(response.body.subarray(0, 2).toString("ascii"), "PK");
      for (const category of [
        "monsters",
        "items",
        "spells",
        "classTalents",
        "classes",
        "species",
        "backgrounds",
        "feats",
        "decks",
        "bastions",
      ]) {
        assert.ok(
          response.body.includes(Buffer.from(`beholden-compendium-${category}.json`)),
          `archive must contain the ${category} batch`,
        );
      }
    });
  });

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
  });

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
      assert.deepEqual(body.uses, { max: 7, recover: "1d6+1", depletion: { destroy: 1 } });
      assert.deepEqual(body.spells, { s_compat_fireball: { cost: 5, level: 5 } });
      assert.deepEqual(body.spellcasting, { dc: 17 });
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
      assert.deepEqual(exported.uses, { max: 7, recover: "1d6+1", depletion: { destroy: 1 } }, "uses must survive PUT");
      assert.deepEqual(exported.spells, { s_compat_fireball: { cost: 5, level: 5 } }, "spells must survive PUT");
      assert.deepEqual(exported.spellcasting, { dc: 17 }, "spellcasting must survive PUT");
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
        `/api/compendium/canonical/classes/${CANONICAL_CLASS.id}`,
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
        `/api/compendium/canonical/backgrounds/${CANONICAL_BACKGROUND.id}`,
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

});
