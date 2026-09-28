/**
 * Treasure: loot the DM places at the campaign, adventure or encounter level, and hands out to a
 * player's sheet or the party stash. `routes/treasure/` - ten endpoints - was loaded by no test.
 *
 * The award is where things move between systems, so that is where most of this looks: that it
 * cannot hand out more than exists, that coins join the stack a character already has instead of
 * starting a second one (the thing that broke a player's gold before), and that loot belonging to
 * an encounter goes when the encounter does - which on an upgraded database it did not.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { zodErrorMiddleware } from "../../lib/validate.js";
import { ensureTreasureFollowsEncounterDelete } from "../../lib/migrations/treasureEncounterCascadeMigration.js";
import type { ServerContext } from "../../server/context.js";
import { registerTreasureRoutes } from "./core.js";

const DM = { userId: "dm", username: "dm", isAdmin: false };
const PLAYER = { userId: "player", username: "player", isAdmin: false };

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  db.pragma("foreign_keys = ON");
  const t = Date.now();
  for (const actor of [DM, PLAYER]) {
    db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES (?, ?, 'h', ?, ?, ?)")
      .run(actor.userId, actor.username, actor.username, t, t);
  }
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-1', 'Ours', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-2', 'Theirs', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m1', 'camp-1', 'dm', 'dm', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m2', 'camp-1', 'player', 'player', ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv-1', 'camp-1', 'One', 1, ?, ?)").run(t, t);
  db.prepare("INSERT INTO encounters (id, campaign_id, adventure_id, name, sort, created_at, updated_at) VALUES ('enc-1', 'camp-1', 'adv-1', 'Lair', 1, ?, ?)").run(t, t);

  // A player with a sheet that already has some gold, a hand-made player with none, and a player
  // from somebody else's campaign.
  db.prepare(`
    INSERT INTO user_characters (id, user_id, name, character_data_json, created_at, updated_at)
    VALUES ('char-1', 'player', 'Alarion', ?, ?, ?)
  `).run(JSON.stringify({ inventory: [{ id: "coins", name: "GP", quantity: 40 }, { id: "rope", name: "Rope", quantity: 1 }] }), t, t);
  db.prepare(`INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, level, live_json, created_at, updated_at)
    VALUES ('p-1', 'camp-1', 'player', 'char-1', 'Sam', 'Alarion', 3, '{}', ?, ?)`).run(t, t);
  db.prepare(`INSERT INTO players (id, campaign_id, player_name, character_name, level, live_json, created_at, updated_at)
    VALUES ('p-handmade', 'camp-1', 'NPC', 'Hireling', 1, '{}', ?, ?)`).run(t, t);
  db.prepare(`INSERT INTO players (id, campaign_id, player_name, character_name, level, live_json, created_at, updated_at)
    VALUES ('p-elsewhere', 'camp-2', 'Other', 'Stranger', 1, '{}', ?, ?)`).run(t, t);
  return db;
}

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

async function withServer(db: Database.Database, run: (call: (actor: typeof DM) => Call) => Promise<void>) {
  let counter = 0;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = String(req.headers["x-test-actor"] ?? "dm");
    req.user = { ...([DM, PLAYER].find((actor) => actor.userId === id) ?? DM) };
    next();
  });
  registerTreasureRoutes(app, {
    db,
    broadcast: () => {},
    helpers: { now: () => Date.now(), uid: () => `gen-${++counter}` },
  } as unknown as ServerContext);
  app.use(zodErrorMiddleware);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;

  const call = (actor: typeof DM): Call => (method, path, body) => new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          "x-test-actor": actor.userId,
          ...(payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = text;
          try { parsed = JSON.parse(text); } catch { /* keep the text */ }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });

  try {
    await run(call);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const inventoryOf = (db: Database.Database) =>
  (JSON.parse((db.prepare("SELECT character_data_json AS j FROM user_characters WHERE id = 'char-1'").get() as { j: string }).j)
    .inventory as Array<{ name: string; quantity: number }>);

const custom = (name: string, qty: number) => ({ source: "custom", qty, custom: { name } });

test("an award moves loot to the sheet and takes it off the pile", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const sword = (await dm("POST", "/api/adventures/adv-1/treasure", custom("Longsword", 3))).body;

    const first = await dm("POST", `/api/treasure/${sword.id}/award`, { playerId: "p-1", quantity: 2 });
    assert.equal(first.status, 200);
    assert.equal(first.body.remaining, 1);
    assert.equal(inventoryOf(db).find((item) => item.name === "Longsword")?.quantity, 2);

    // The last one goes, and the pile goes with it.
    const last = await dm("POST", `/api/treasure/${sword.id}/award`, { playerId: "p-1", quantity: 1 });
    assert.equal(last.body.remaining, 0);
    assert.equal(db.prepare("SELECT 1 FROM treasure WHERE id = ?").get(sword.id), undefined);
  });
  db.close();
});

test("an award cannot hand out more than there is", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const gem = (await dm("POST", "/api/campaigns/camp-1/treasure", custom("Ruby", 2))).body;

    const greedy = await dm("POST", `/api/treasure/${gem.id}/award`, { playerId: "p-1", quantity: 3 });
    assert.equal(greedy.status, 400);
    assert.ok(!inventoryOf(db).some((item) => item.name === "Ruby"), "nothing reached the sheet");
    assert.equal((db.prepare("SELECT qty FROM treasure WHERE id = ?").get(gem.id) as { qty: number }).qty, 2);

    // Two quick presses of Award for the last one: the second finds nothing left. The pile is gone,
    // so the guard cannot place it in a campaign and refuses before the route runs.
    await dm("POST", `/api/treasure/${gem.id}/award`, { playerId: "p-1", quantity: 2 });
    assert.equal((await dm("POST", `/api/treasure/${gem.id}/award`, { playerId: "p-1", quantity: 2 })).status, 403);
    assert.equal(inventoryOf(db).find((item) => item.name === "Ruby")?.quantity, 2);
  });
  db.close();
});

test("coins join the stack the character already has instead of starting a second one", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const hoard = (await dm("POST", "/api/adventures/adv-1/treasure", custom("gp", 150))).body;
    assert.equal((await dm("POST", `/api/treasure/${hoard.id}/award`, { playerId: "p-1", quantity: 150 })).status, 200);

    const stacks = inventoryOf(db).filter((item) => item.name.trim().toUpperCase() === "GP");
    assert.equal(stacks.length, 1, "one stack of gold, whatever case the treasure was written in");
    assert.equal(stacks[0]!.quantity, 190);

    // A denomination the character has none of yet starts its own stack, as it should.
    const silver = (await dm("POST", "/api/adventures/adv-1/treasure", custom("SP", 25))).body;
    await dm("POST", `/api/treasure/${silver.id}/award`, { playerId: "p-1", quantity: 25 });
    assert.equal(inventoryOf(db).find((item) => item.name === "SP")?.quantity, 25);
  });
  db.close();
});

test("loot for the party goes to the stash", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const tent = (await dm("POST", "/api/campaigns/camp-1/treasure", custom("Tent", 1))).body;
    assert.equal((await dm("POST", `/api/treasure/${tent.id}/award`, { playerId: "party", quantity: 1 })).status, 200);
    const stash = db.prepare("SELECT name, quantity FROM party_inventory WHERE campaign_id = 'camp-1'").all() as Array<{ name: string; quantity: number }>;
    assert.deepEqual(stash, [{ name: "Tent", quantity: 1 }]);
  });
  db.close();
});

test("an award refuses a player it cannot actually give to", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const coin = (await dm("POST", "/api/campaigns/camp-1/treasure", custom("Lucky coin", 1))).body;

    assert.equal((await dm("POST", `/api/treasure/${coin.id}/award`, { playerId: "p-handmade", quantity: 1 })).status, 400,
      "a hand-made player has no sheet to put it on");
    assert.equal((await dm("POST", `/api/treasure/${coin.id}/award`, { playerId: "p-elsewhere", quantity: 1 })).status, 404,
      "and a player from another campaign is not in this one");
    assert.equal((db.prepare("SELECT qty FROM treasure WHERE id = ?").get(coin.id) as { qty: number }).qty, 1, "still there");
  });
  db.close();
});

test("players can see the loot but not hand it out or change it", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const pile = (await call(DM)("POST", "/api/adventures/adv-1/treasure", custom("Gold idol", 1))).body;
    const player = call(PLAYER);
    assert.equal((await player("GET", "/api/adventures/adv-1/treasure")).status, 200);
    assert.equal((await player("POST", `/api/treasure/${pile.id}/award`, { playerId: "p-1", quantity: 1 })).status, 403);
    assert.equal((await player("PATCH", `/api/treasure/${pile.id}/qty`, { qty: 99 })).status, 403);
    assert.equal((await player("DELETE", `/api/treasure/${pile.id}`)).status, 403);
    assert.ok(!inventoryOf(db).some((item) => item.name === "Gold idol"));
  });
  db.close();
});

test("an encounter's loot goes when the encounter does, on an upgraded database too", () => {
  // The shape an older install really has: `encounter_id` added later by ALTER TABLE, with no
  // foreign key, so SQLite has no reason to remove the loot when the encounter goes.
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE campaigns (id TEXT PRIMARY KEY);
    CREATE TABLE adventures (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE);
    CREATE TABLE encounters (id TEXT PRIMARY KEY, adventure_id TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE);
    CREATE TABLE treasure (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, adventure_id TEXT REFERENCES adventures(id) ON DELETE CASCADE);
    ALTER TABLE treasure ADD COLUMN encounter_id TEXT;
    INSERT INTO campaigns VALUES ('c');
    INSERT INTO adventures VALUES ('a', 'c');
    INSERT INTO encounters VALUES ('e1', 'a');
    INSERT INTO encounters VALUES ('e2', 'a');
    INSERT INTO treasure VALUES ('loot-1', 'c', 'a', 'e1');
    INSERT INTO treasure VALUES ('loot-2', 'c', 'a', 'e2');
    INSERT INTO treasure VALUES ('adventure-loot', 'c', 'a', NULL);
    INSERT INTO treasure VALUES ('stranded', 'c', 'a', 'already-deleted');
  `);

  ensureTreasureFollowsEncounterDelete(db);
  const left = () => (db.prepare("SELECT id FROM treasure ORDER BY id").all() as { id: string }[]).map((row) => row.id);
  assert.deepEqual(left(), ["adventure-loot", "loot-1", "loot-2"], "loot for a fight that no longer exists is cleared");

  db.prepare("DELETE FROM encounters WHERE id = 'e1'").run();
  assert.deepEqual(left(), ["adventure-loot", "loot-2"], "deleting an encounter takes its loot");

  // Deleting the adventure cascades to its encounters, and the trigger follows the cascade.
  db.prepare("DELETE FROM adventures WHERE id = 'a'").run();
  assert.deepEqual(left(), []);

  // Running it again is harmless.
  ensureTreasureFollowsEncounterDelete(db);
  db.close();
});
