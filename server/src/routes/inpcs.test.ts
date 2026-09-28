import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { zodErrorMiddleware } from "../lib/validate.js";
import type { ServerContext } from "../server/context.js";
import { registerInpcRoutes } from "./inpcs.js";

const DM = { userId: "dm", username: "dm", isAdmin: false };
const PLAYER = { userId: "player", username: "player", isAdmin: false };

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  for (const actor of [DM, PLAYER]) {
    db.prepare("INSERT INTO users (id,username,passhash,name,created_at,updated_at) VALUES (?,?,'h',?,1,1)")
      .run(actor.userId, actor.username, actor.username);
  }
  db.prepare("INSERT INTO campaigns (id,name,created_at,updated_at) VALUES ('camp','Campaign',1,1)").run();
  db.prepare("INSERT INTO campaign_membership (id,campaign_id,user_id,role,created_at,updated_at) VALUES ('dm-m','camp','dm','dm',1,1)").run();
  db.prepare("INSERT INTO campaign_membership (id,campaign_id,user_id,role,created_at,updated_at) VALUES ('p-m','camp','player','player',1,1)").run();
  db.prepare("INSERT INTO adventures (id,campaign_id,name,created_at,updated_at) VALUES ('adv','camp','Adventure',1,1)").run();
  db.prepare("INSERT INTO encounters (id,campaign_id,adventure_id,name,created_at,updated_at) VALUES ('enc','camp','adv','Fight',1,1)").run();
  db.prepare(`INSERT INTO compendium_monsters (id,ruleset,name,name_key,data_json,content_hash)
    VALUES ('goblin','5.5e','Goblin','goblin',?,'hash')`).run(JSON.stringify({ name: "Goblin", hp: "7 (2d6)", ac: "15 (leather)" }));
  return db;
}

async function withServer(db: Database.Database, run: (call: (actor: typeof DM) => (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>) => Promise<void>) {
  let sequence = 10;
  const broadcasts: Array<{ type: string; payload: any }> = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = String(req.headers["x-test-actor"] ?? "dm") === "player" ? PLAYER : DM;
    next();
  });
  registerInpcRoutes(app, {
    db,
    broadcast: (type: string, payload: unknown) => broadcasts.push({ type, payload }),
    helpers: { now: () => ++sequence, uid: () => `inpc-${sequence}` , normalizeKey: (value: string) => value.toLowerCase() },
  } as unknown as ServerContext);
  app.use(zodErrorMiddleware);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  const call = (actor: typeof DM) => (method: string, path: string, body?: unknown) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = http.request({ hostname: "127.0.0.1", port, path, method, headers: {
      "x-test-actor": actor.userId,
      ...(payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {}),
    } }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "null") }));
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
  try { await run(call); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test("INPC routes accept nullable monster defaults but remain DM-only", async () => {
  const db = seedDb();
  try {
    await withServer(db, async (call) => {
      const forbidden = await call(PLAYER)("GET", "/api/campaigns/camp/inpcs");
      assert.equal(forbidden.status, 403);
      const created = await call(DM)("POST", "/api/campaigns/camp/inpcs", {
        monsterId: "goblin", name: null, hpMax: null, hpCurrent: null, ac: null, hpDetails: null, acDetails: null,
      });
      assert.equal(created.status, 200);
      assert.equal(created.body.name, "Goblin");
      assert.equal(created.body.hpMax, 7);
      assert.equal(created.body.hpCurrent, 7);
      assert.equal(created.body.ac, 15);
    });
  } finally { db.close(); }
});

test("INPC updates reject stale editors and synchronize active encounter copies", async () => {
  const db = seedDb();
  try {
    await withServer(db, async (call) => {
      const created = await call(DM)("POST", "/api/campaigns/camp/inpcs", { monsterId: "goblin" });
      assert.equal(created.status, 200);
      db.prepare(`INSERT INTO combatants (id,encounter_id,base_type,base_id,snapshot_json,live_json,created_at,updated_at)
        VALUES ('actor','enc','inpc',?,?,?,1,1)`).run(created.body.id, JSON.stringify({ name: "Goblin", label: "Goblin", friendly: true, hpMax: 7, ac: 15 }), JSON.stringify({ hpCurrent: 7 }));

      const saved = await call(DM)("PUT", `/api/inpcs/${created.body.id}`, {
        expectedUpdatedAt: created.body.updatedAt, name: "Sprocket", friendly: false, hpMax: 12, hpCurrent: 5, ac: 17,
      });
      assert.equal(saved.status, 200);
      const combatant = db.prepare("SELECT snapshot_json snapshot, live_json live FROM combatants WHERE id='actor'").get() as { snapshot: string; live: string };
      assert.deepEqual(JSON.parse(combatant.snapshot), { name: "Sprocket", label: "Sprocket", friendly: 0, hpMax: 12, ac: 17, hpDetails: "2d6", acDetails: "leather" });
      assert.equal(JSON.parse(combatant.live).hpCurrent, 5);

      const stale = await call(DM)("PUT", `/api/inpcs/${created.body.id}`, { expectedUpdatedAt: created.body.updatedAt, name: "Old copy" });
      assert.equal(stale.status, 409);
      assert.equal(stale.body.code, "stale-inpc");
      assert.equal((db.prepare("SELECT name FROM inpcs WHERE id=?").get(created.body.id) as { name: string }).name, "Sprocket");
    });
  } finally { db.close(); }
});
