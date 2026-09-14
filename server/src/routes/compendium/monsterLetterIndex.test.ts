/**
 * HTTP-level tests for the monster A-Z jump index.
 *
 * The browser now virtualises the monster list over the server's total and fetches rows by window,
 * so it can no longer work out where "M" starts by scanning the rows it holds. These indices are
 * what the jump bar scrolls to, which makes two things load-bearing: they must count from the same
 * filtered set the list renders, and they must be in the same sort order.
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
import { registerMonsterRoutes } from "./monsters.js";
import type { ServerContext } from "../../server/context.js";

type SeedMonster = { id: string; name: string; cr: number; type: string };

// Deliberately inserted out of order, so a passing test means the endpoint sorted rather than
// echoing insertion order.
const SEED_MONSTERS: SeedMonster[] = [
  { id: "m_mimic", name: "Mimic", cr: 2, type: "monstrosity" },
  { id: "m_the_abbot", name: "The Abbot", cr: 20, type: "celestial" },
  { id: "m_aboleth", name: "Aboleth", cr: 10, type: "aberration" },
  { id: "m_zombie", name: "Zombie", cr: 1, type: "undead" },
  { id: "m_ape", name: "Ape", cr: 1, type: "beast" },
  { id: "m_manticore", name: "Manticore", cr: 3, type: "monstrosity" },
  // Guards the LIKE-wildcard trap in the sort key: a bare "the_%" would also match this one and
  // sort it under O.
  { id: "m_theodore", name: "Theodore", cr: 5, type: "humanoid" },
];

describe("GET /api/compendium/monsters/letters", () => {
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
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null }));
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  async function letters(query = ""): Promise<Record<string, number>> {
    const result = await get(`/api/compendium/monsters/letters?${query}`);
    assert.equal(result.status, 200);
    const body = result.body as { letters: { letter: string; index: number }[] };
    return Object.fromEntries(body.letters.map((entry) => [entry.letter, entry.index]));
  }

  async function names(query = ""): Promise<string[]> {
    const result = await get(`/api/compendium/search?limit=100&withTotal=1&fields=name&${query}`);
    const body = result.body as { rows: { name: string }[] };
    return body.rows.map((row) => row.name);
  }

  before(async () => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    const insert = db.prepare(
      `INSERT INTO compendium_monsters (id, ruleset, name, name_key, cr, cr_numeric, type_key, size, environment, data_json)
       VALUES (?, '5.5e', ?, ?, ?, ?, ?, 'M', 'forest', '{}')`,
    );
    for (const monster of SEED_MONSTERS) {
      insert.run(
        monster.id,
        monster.name,
        monster.name.toLowerCase().replace(/[^\w]+/g, "_"),
        String(monster.cr),
        monster.cr,
        monster.type,
      );
    }

    const app = express();
    app.use(express.json());
    app.use("/api", requireAuth);
    registerMonsterRoutes(app, { db } as ServerContext, (_req, _res, next) => next());

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    db.close();
  });

  it("indexes the first row under each letter, in name order", async () => {
    assert.deepEqual(await names("sort=az"), ["The Abbot", "Aboleth", "Ape", "Manticore", "Mimic", "Theodore", "Zombie"]);
    assert.deepEqual(await letters("sort=az"), { A: 0, M: 3, T: 5, Z: 6 });
  });

  it("sorts a leading 'The' under the following word, where the jump bar files it", async () => {
    // "The Abbot" sorts as "Abbot", so it heads the A run rather than sitting among the Ts. The bar
    // and the list have to agree here, or clicking A lands on the wrong row.
    const [first] = await names("sort=az");
    assert.equal(first, "The Abbot");
    assert.equal((await letters("sort=az")).A, 0);
  });

  it("does not treat 'The' as a prefix of names that merely begin with those letters", async () => {
    // Theodore keeps its own sort position and stays under T.
    const ordered = await names("sort=az");
    assert.equal(ordered.indexOf("Theodore"), 5);
    assert.equal((await letters("sort=az")).T, 5);
  });

  it("indexes positions in the requested sort order, not always alphabetically", async () => {
    // cr ascending: Ape(1), Zombie(1), Mimic(2), Manticore(3), Theodore(5), Aboleth(10), The Abbot(20)
    assert.deepEqual(await names("sort=crAsc"), ["Ape", "Zombie", "Mimic", "Manticore", "Theodore", "Aboleth", "The Abbot"]);
    assert.deepEqual(await letters("sort=crAsc"), { A: 0, Z: 1, M: 2, T: 4 });
  });

  it("counts only rows that pass the filters, so indices match the list on screen", async () => {
    assert.deepEqual(await names("sort=az&types=monstrosity"), ["Manticore", "Mimic"]);
    assert.deepEqual(await letters("sort=az&types=monstrosity"), { M: 0 });
  });

  it("narrows with a text query the same way the search does", async () => {
    assert.deepEqual(await names("sort=az&q=a"), ["The Abbot", "Aboleth", "Ape", "Manticore"]);
    assert.deepEqual(await letters("sort=az&q=a"), { A: 0, M: 3 });
  });

  it("returns an empty index when nothing matches", async () => {
    const result = await get("/api/compendium/monsters/letters?q=notamonster");
    const body = result.body as { letters: unknown[]; total: number };
    assert.deepEqual(body.letters, []);
    assert.equal(body.total, 0);
  });

  // /search and /letters build their WHERE clauses from one shared helper, so these also guard the
  // search route against the refactor that introduced it.
  describe("shared filter clauses", () => {
    it("filters by size", async () => {
      assert.equal((await names("sort=az&sizes=M")).length, SEED_MONSTERS.length);
      assert.deepEqual(await names("sort=az&sizes=L"), []);
    });

    it("filters by environment, case-insensitively", async () => {
      assert.equal((await names("sort=az&env=Forest")).length, SEED_MONSTERS.length);
      assert.deepEqual(await names("sort=az&env=arctic"), []);
    });

    it("filters by challenge rating range", async () => {
      assert.deepEqual(await names("sort=az&crMin=3"), ["The Abbot", "Aboleth", "Manticore", "Theodore"]);
      assert.deepEqual(await names("sort=az&crMax=2"), ["Ape", "Mimic", "Zombie"]);
      assert.deepEqual(await names("sort=az&crMin=2&crMax=3"), ["Manticore", "Mimic"]);
    });

    it("filters by ruleset", async () => {
      assert.equal((await names("sort=az&ruleset=5.5e")).length, SEED_MONSTERS.length);
      assert.deepEqual(await names("sort=az&ruleset=5e"), []);
    });

    it("sorts by descending challenge rating", async () => {
      assert.deepEqual(await names("sort=crDesc"), ["The Abbot", "Aboleth", "Theodore", "Manticore", "Mimic", "Ape", "Zombie"]);
    });
  });
});
