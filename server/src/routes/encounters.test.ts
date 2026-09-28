/**
 * Encounters had no tests of their own: `routes/encounters.ts` was one of the modules no test ever
 * loaded, despite owning the thing a session is actually run out of.
 *
 * These cover the shape of the surface - who may read and write, what a duplicate copies and what
 * it deliberately does not, and what a delete takes with it.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { zodErrorMiddleware } from "../lib/validate.js";
import type { ServerContext } from "../server/context.js";
import { registerEncounterRoutes } from "./encounters.js";

const DM = { userId: "dm", username: "dm", isAdmin: false };
const PLAYER = { userId: "player", username: "player", isAdmin: false };
const OUTSIDER = { userId: "outsider", username: "outsider", isAdmin: false };

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();

  for (const actor of [DM, PLAYER, OUTSIDER]) {
    db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES (?, ?, 'h', ?, ?, ?)")
      .run(actor.userId, actor.username, actor.username, t, t);
  }
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-1', 'Ours', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m1', 'camp-1', 'dm', 'dm', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m2', 'camp-1', 'player', 'player', ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv-1', 'camp-1', 'Chapter One', 1, ?, ?)").run(t, t);
  db.prepare(`
    INSERT INTO players (id, campaign_id, player_name, character_name, level, hp_max, hp_current, ac, live_json, created_at, updated_at)
    VALUES ('p-1', 'camp-1', 'Player', 'Alarion', 3, 24, 9, 15, '{}', ?, ?)
  `).run(t, t);
  return db;
}

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

async function withServer(db: Database.Database, run: (call: (actor: typeof DM) => Call) => Promise<void>) {
  let counter = 0;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = String(req.headers["x-test-actor"] ?? "dm");
    req.user = { ...([DM, PLAYER, OUTSIDER].find((actor) => actor.userId === id) ?? DM) };
    next();
  });
  registerEncounterRoutes(app, {
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

const addCombatant = (db: Database.Database, id: string, encounterId: string, over: Partial<{ baseType: string; baseId: string; live: unknown }> = {}) => {
  const t = Date.now();
  db.prepare(`
    INSERT INTO combatants (id, encounter_id, base_type, base_id, snapshot_json, live_json, sort, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    encounterId,
    over.baseType ?? "monster",
    over.baseId ?? "mon-1",
    JSON.stringify({ name: "Goblin", hpMax: 7, ac: 15 }),
    JSON.stringify(over.live ?? { hpCurrent: 2, initiative: 17, conditions: [{ key: "prone" }] }),
    t,
    t,
  );
};

test("an encounter goes through its whole life for the DM", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);

    const created = await dm("POST", "/api/adventures/adv-1/encounters", { name: "Ambush" });
    assert.equal(created.status, 200);
    assert.equal(created.body.name, "Ambush");
    assert.equal(created.body.campaignId, "camp-1");
    assert.equal(created.body.adventureId, "adv-1");
    const encounterId = created.body.id;

    assert.equal((await dm("GET", `/api/encounters/${encounterId}`)).body.name, "Ambush");
    assert.equal((await dm("GET", "/api/adventures/adv-1/encounters")).body.length, 1);

    const renamed = await dm("PUT", `/api/encounters/${encounterId}`, { name: "Ambush at the ford" });
    assert.equal(renamed.body.name, "Ambush at the ford");

    assert.equal((await dm("DELETE", `/api/encounters/${encounterId}`)).status, 200);
    assert.equal((await dm("GET", "/api/adventures/adv-1/encounters")).body.length, 0);
    assert.equal((await dm("GET", `/api/encounters/${encounterId}`)).status, 403, "gone means the guard can no longer place it");
  });
  db.close();
});

test("deleting an encounter takes its combatants with it", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const encounterId = (await dm("POST", "/api/adventures/adv-1/encounters", { name: "Ambush" })).body.id;
    addCombatant(db, "c-1", encounterId);
    addCombatant(db, "c-2", encounterId, { baseType: "player", baseId: "p-1" });

    await dm("DELETE", `/api/encounters/${encounterId}`);
    const left = db.prepare("SELECT COUNT(*) AS n FROM combatants WHERE encounter_id = ?").get(encounterId) as { n: number };
    assert.equal(left.n, 0, "the foreign key cascade cleans the roster up");
    // The player row is not the encounter's to delete.
    assert.ok(db.prepare("SELECT 1 FROM players WHERE id = 'p-1'").get());
  });
  db.close();
});

test("a duplicate copies the roster but none of the fight", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const encounterId = (await dm("POST", "/api/adventures/adv-1/encounters", { name: "Ambush" })).body.id;
    addCombatant(db, "c-1", encounterId);
    addCombatant(db, "c-2", encounterId, { baseType: "player", baseId: "p-1" });
    await dm("PUT", `/api/encounters/${encounterId}`, { status: "Complete" });

    const copy = await dm("POST", `/api/encounters/${encounterId}/duplicate`);
    assert.equal(copy.status, 200);
    assert.equal(copy.body.name, "Ambush (copy)");
    assert.equal(copy.body.status, "Open", "a copy has not been run yet");
    assert.notEqual(copy.body.id, encounterId);

    const copied = db.prepare("SELECT id, base_type, base_id, live_json FROM combatants WHERE encounter_id = ? ORDER BY base_type")
      .all(copy.body.id) as { id: string; base_type: string; base_id: string; live_json: string }[];
    assert.equal(copied.length, 2, "everyone on the roster comes along");
    assert.deepEqual(copied.map((row) => row.base_type), ["monster", "player"]);
    assert.ok(copied.every((row) => row.id !== "c-1" && row.id !== "c-2"), "fresh combatant ids");

    for (const row of copied) {
      const live = JSON.parse(row.live_json) as { initiative?: unknown; conditions?: unknown[] };
      assert.equal(live.initiative ?? null, null, "initiative is rolled again, not inherited");
      assert.deepEqual(live.conditions ?? [], [], "nobody starts the copy still prone");
    }

    // The original is untouched by having been copied.
    assert.equal((await dm("GET", `/api/encounters/${encounterId}`)).body.status, "Complete");
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM combatants WHERE encounter_id = ?").get(encounterId) as { n: number }).n, 2);
  });
  db.close();
});

test("players can read the encounter list but cannot change it", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const encounterId = (await call(DM)("POST", "/api/adventures/adv-1/encounters", { name: "Ambush" })).body.id;

    const player = call(PLAYER);
    assert.equal((await player("GET", "/api/adventures/adv-1/encounters")).status, 200, "the party can see what is coming");
    assert.equal((await player("GET", `/api/encounters/${encounterId}`)).status, 200);

    assert.equal((await player("POST", "/api/adventures/adv-1/encounters", { name: "Mine" })).status, 403);
    assert.equal((await player("PUT", `/api/encounters/${encounterId}`, { name: "Mine" })).status, 403);
    assert.equal((await player("POST", `/api/encounters/${encounterId}/duplicate`)).status, 403);
    assert.equal((await player("DELETE", `/api/encounters/${encounterId}`)).status, 403);

    // Someone from outside the campaign sees none of it.
    const outsider = call(OUTSIDER);
    assert.equal((await outsider("GET", "/api/adventures/adv-1/encounters")).status, 403);
    assert.equal((await outsider("GET", `/api/encounters/${encounterId}`)).status, 403);

    assert.equal((await call(DM)("GET", `/api/encounters/${encounterId}`)).body.name, "Ambush", "and it survived all that");
  });
  db.close();
});

test("an encounter cannot be created under an adventure that does not exist", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    // The guard cannot resolve a campaign for an unknown adventure, so it refuses before the route.
    assert.equal((await dm("POST", "/api/adventures/nope/encounters", { name: "Ambush" })).status, 403);
    assert.equal((await dm("GET", "/api/adventures/nope/encounters")).status, 403);
  });
  db.close();
});
