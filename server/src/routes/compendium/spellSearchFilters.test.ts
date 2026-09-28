/**
 * HTTP-level tests for the server-side spell search filters.
 *
 * These filters (school, class access, components, concentration, ritual) used to run in the
 * browser over the fully-downloaded catalogue. Now that they run in SQL, a single page of results
 * has to be correct on its own -- and the /facets dropdown options have to stay complete even when
 * only one row has been fetched.
 */
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import http from "node:http";
import net from "node:net";
import express from "express";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { signToken } from "../../lib/jwtAuth.js";
import { requireAuth } from "../../middleware/auth.js";
import { registerSpellRoutes } from "./spells.js";
import type { ServerContext } from "../../server/context.js";

type SeedSpell = {
  id: string;
  name: string;
  level: number;
  school: string;
  components: string | null;
  classes: string;
  concentration?: 0 | 1;
  ritual?: 0 | 1;
};

// Components follow the exact grammar projectGrandSpell emits: "V", "S" and "M"/"M (materials)"
// joined by ", " in that order. The material text below deliberately contains commas, which is the
// case that makes naive comma-splitting in SQL go wrong.
const SEED_SPELLS: SeedSpell[] = [
  { id: "s_acid_splash", name: "Acid Splash", level: 0, school: "Evocation", components: "V, S", classes: "sl_wizard" },
  { id: "s_vicious_mockery", name: "Vicious Mockery", level: 0, school: "Enchantment", components: "V", classes: "sl_bard" },
  { id: "s_thunderclap", name: "Thunderclap", level: 0, school: "Transmutation", components: "S", classes: "sl_wizard" },
  { id: "s_dust_trick", name: "Dust Trick", level: 0, school: "Illusion", components: "M (a pinch of dust)", classes: "sl_wizard" },
  { id: "s_alarm", name: "Alarm", level: 1, school: "Abjuration", components: "V, S, M (a bell, silver wire, and a chime)", classes: "sl_wizard, sl_ranger", ritual: 1 },
  { id: "s_bless", name: "Bless", level: 1, school: "Enchantment", components: "V, S, M (a sprinkling of holy water)", classes: "sl_cleric", concentration: 1 },
  { id: "s_silent_step", name: "Silent Step", level: 2, school: "Illusion", components: null, classes: "sl_wizard" },
];

describe("GET /api/spells/search filters", () => {
  let server: http.Server;
  let port: number;
  let db: Database.Database;

  const token = signToken({ userId: "test-dm", username: "dm", isAdmin: true });

  function get(url: string): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port, path: url, method: "GET", headers: { Authorization: `Bearer ${token}` } },
        (res) => {
          let raw = "";
          res.on("data", (chunk) => { raw += chunk; });
          res.on("end", () => {
            resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null });
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  async function searchNames(query: string): Promise<string[]> {
    const result = await get(`/api/spells/search?${query}&compact=1&limit=100&withTotal=1`);
    assert.equal(result.status, 200);
    const rows = (result.body as { rows: { name: string }[] }).rows;
    return rows.map((row) => row.name).sort();
  }

  before(async () => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);

    const insert = db.prepare(
      `INSERT INTO compendium_spells (id, ruleset, name, name_key, level, school, ritual, concentration, components, classes, data_json)
       VALUES (?, '5.5e', ?, ?, ?, ?, ?, ?, ?, ?, '{}')`,
    );
    for (const spell of SEED_SPELLS) {
      insert.run(
        spell.id,
        spell.name,
        spell.name.toLowerCase().replace(/[^\w]+/g, "_"),
        spell.level,
        spell.school,
        spell.ritual ?? 0,
        spell.concentration ?? 0,
        spell.components,
        spell.classes,
      );
    }

    // The class-access registry turns the stored sl_* ids into the labels the browser displays.
    db.prepare("INSERT INTO compendium_classes (id, ruleset, name, name_key, data_json) VALUES (?, '5.5e', ?, ?, ?)").run(
      "c_registry",
      "Registry",
      "registry",
      JSON.stringify({
        spellLists: {
          sl_wizard: "Wizard",
          sl_bard: "Bard",
          sl_cleric: "Cleric",
          sl_ranger: "Ranger",
        },
      }),
    );

    const app = express();
    app.use(express.json());
    app.use("/api", requireAuth);
    registerSpellRoutes(app, { db } as ServerContext, (_req, _res, next) => next());

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    db.close();
  });

  describe("component exclusions", () => {
    it("excludes verbal spells without touching somatic- or material-only ones", async () => {
      assert.deepEqual(await searchNames("excludeComponents=V"), ["Dust Trick", "Silent Step", "Thunderclap"]);
    });

    it("excludes somatic spells", async () => {
      assert.deepEqual(await searchNames("excludeComponents=S"), ["Dust Trick", "Silent Step", "Vicious Mockery"]);
    });

    it("excludes material spells even when the material text contains commas", async () => {
      assert.deepEqual(await searchNames("excludeComponents=M"), [
        "Acid Splash",
        "Silent Step",
        "Thunderclap",
        "Vicious Mockery",
      ]);
    });

    it("combines exclusions, leaving only spells with no components at all", async () => {
      assert.deepEqual(await searchNames("excludeComponents=V,S,M"), ["Silent Step"]);
    });

    it("ignores unknown component letters rather than failing", async () => {
      assert.deepEqual(await searchNames("excludeComponents=X"), SEED_SPELLS.map((s) => s.name).sort());
    });
  });

  describe("school matching", () => {
    it("matches a school by its full name", async () => {
      assert.deepEqual(await searchNames("school=Abjuration"), ["Alarm"]);
    });

    it("matches a school by its legacy single-letter code", async () => {
      assert.deepEqual(await searchNames("school=A"), ["Alarm"]);
    });

    it("does not let a single-letter code match schools that merely contain that letter", async () => {
      // "T" (Transmutation) must not also pull in Enchantment, Illusion or Evocation.
      assert.deepEqual(await searchNames("school=T"), ["Thunderclap"]);
    });
  });

  describe("other filters", () => {
    it("filters by concentration", async () => {
      assert.deepEqual(await searchNames("concentration=1"), ["Bless"]);
    });

    it("filters by ritual", async () => {
      assert.deepEqual(await searchNames("ritual=1"), ["Alarm"]);
    });

    it("filters by class access label", async () => {
      assert.deepEqual(await searchNames("classes=Ranger"), ["Alarm"]);
    });

    it("applies filters before paging, so the reported total reflects the filter", async () => {
      const result = await get("/api/spells/search?excludeComponents=M&compact=1&limit=1&withTotal=1");
      const body = result.body as { rows: unknown[]; total: number };
      assert.equal(body.rows.length, 1);
      assert.equal(body.total, 4);
    });
  });

  describe("GET /api/spells/facets", () => {
    it("lists every school and class in the catalogue, not just the fetched page", async () => {
      const result = await get("/api/spells/facets");
      assert.equal(result.status, 200);
      const body = result.body as { schools: string[]; classes: string[] };
      assert.deepEqual(body.schools, ["Abjuration", "Enchantment", "Evocation", "Illusion", "Transmutation"]);
      assert.deepEqual(body.classes, ["Bard", "Cleric", "Ranger", "Wizard"]);
    });

    it("narrows options by the rest of the search", async () => {
      const result = await get("/api/spells/facets?level=1");
      const body = result.body as { schools: string[]; classes: string[] };
      assert.deepEqual(body.schools, ["Abjuration", "Enchantment"]);
      assert.deepEqual(body.classes, ["Cleric", "Ranger", "Wizard"]);
    });

    it("does not narrow the school list by the selected school", async () => {
      const result = await get("/api/spells/facets?school=Abjuration");
      const body = result.body as { schools: string[] };
      assert.deepEqual(body.schools, ["Abjuration", "Enchantment", "Evocation", "Illusion", "Transmutation"]);
    });

    it("does not narrow the class list by the selected class", async () => {
      const result = await get("/api/spells/facets?classes=Bard");
      const body = result.body as { classes: string[] };
      assert.deepEqual(body.classes, ["Bard", "Cleric", "Ranger", "Wizard"]);
    });
  });
});
