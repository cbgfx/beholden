/**
 * HTTP-level tests for the item search magic filters.
 *
 * `magic=1` (magic only) and `nonmagic=1` (mundane only) are separate params because callers
 * already send `magic=0` to mean "don't filter on magic at all". The DM item picker used to narrow
 * to mundane items in the browser, which stopped working once results were paged.
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
import { registerItemRoutes } from "./items.js";
import type { ServerContext } from "../../server/context.js";

const SEED_ITEMS: { id: string; name: string; magic: 0 | 1 }[] = [
  { id: "i_longsword", name: "Longsword", magic: 0 },
  { id: "i_backpack", name: "Backpack", magic: 0 },
  { id: "i_flame_tongue", name: "Flame Tongue", magic: 1 },
  { id: "i_bag_of_holding", name: "Bag of Holding", magic: 1 },
];

describe("GET /api/compendium/items magic filters", () => {
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

  async function searchNames(query: string): Promise<string[]> {
    const result = await get(`/api/compendium/items?compact=1&withTotal=1&limit=100&${query}`);
    assert.equal(result.status, 200);
    const rows = (result.body as { rows: { name: string }[] }).rows;
    return rows.map((row) => row.name).sort();
  }

  before(async () => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    const insert = db.prepare(
      `INSERT INTO compendium_items (id, ruleset, name, name_key, magic, attunement, data_json)
       VALUES (?, '5.5e', ?, ?, ?, 0, '{}')`,
    );
    for (const item of SEED_ITEMS) {
      insert.run(item.id, item.name, item.name.toLowerCase().replace(/[^\w]+/g, "_"), item.magic);
    }

    const app = express();
    app.use(express.json());
    app.use("/api", requireAuth);
    registerItemRoutes(app, { db } as ServerContext, (_req, _res, next) => next());

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    db.close();
  });

  it("returns everything when neither magic flag is set", async () => {
    assert.deepEqual(await searchNames("magic=0&nonmagic=0"), ["Backpack", "Bag of Holding", "Flame Tongue", "Longsword"]);
  });

  it("returns only magic items for magic=1", async () => {
    assert.deepEqual(await searchNames("magic=1&nonmagic=0"), ["Bag of Holding", "Flame Tongue"]);
  });

  it("returns only mundane items for nonmagic=1", async () => {
    assert.deepEqual(await searchNames("magic=0&nonmagic=1"), ["Backpack", "Longsword"]);
  });

  it("counts the filtered set in the reported total, so paging can rely on it", async () => {
    const result = await get("/api/compendium/items?compact=1&withTotal=1&limit=1&nonmagic=1");
    const body = result.body as { rows: unknown[]; total: number };
    assert.equal(body.rows.length, 1);
    assert.equal(body.total, 2);
  });
});
