import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { zodErrorMiddleware } from "../lib/validate.js";
import type { ServerContext } from "../server/context.js";
import { registerAdventureRoutes } from "./adventures.js";

const DM = { userId: "dm", username: "dm", isAdmin: false };

function seedDb() {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES ('dm', 'dm', 'h', 'DM', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaigns (id, name, ruleset, created_at, updated_at) VALUES ('camp', 'Campaign', '5.5e', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('member', 'camp', 'dm', 'dm', ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, status, sort, created_at, updated_at) VALUES ('adv', 'camp', 'Chapter', 'active', 1, ?, ?)").run(t, t);
  return db;
}

async function withServer(db: Database.Database, run: (call: (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>) => Promise<void>) {
  let counter = 0;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = DM; next(); });
  registerAdventureRoutes(app, {
    db,
    broadcast: () => {},
    helpers: { now: () => Date.now(), uid: () => `generated-${++counter}` },
  } as unknown as ServerContext);
  app.use(zodErrorMiddleware);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  const call = (method: string, path: string, body?: unknown) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = http.request({ hostname: "127.0.0.1", port, method, path, headers: {
      "x-test-actor": "dm",
      ...(payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {}),
    } }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
  try { await run(call); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test("an exported adventure is accepted by the import schema", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const exported = await call("GET", "/api/adventures/adv/export");
    assert.equal(exported.status, 200);
    assert.equal(exported.body.version, 2);
    const imported = await call("POST", "/api/campaigns/camp/adventures/import", exported.body);
    assert.equal(imported.status, 200);
    assert.equal(imported.body.name, "Chapter (Imported)");
    const importedAgain = await call("POST", "/api/campaigns/camp/adventures/import", exported.body);
    assert.equal(importedAgain.status, 200);
    assert.equal(importedAgain.body.name, "Chapter (Imported 2)");
  });
  db.close();
});

test("deleting an adventure cascades through all owned records", async () => {
  const db = seedDb();
  const t = Date.now();
  db.prepare("INSERT INTO encounters (id,campaign_id,adventure_id,name,status,sort,created_at,updated_at) VALUES ('enc','camp','adv','Fight','Open',1,?,?)").run(t, t);
  db.prepare("INSERT INTO notes (id,campaign_id,adventure_id,title,text,sort,created_at,updated_at) VALUES ('note','camp','adv','Note','Text',1,?,?)").run(t, t);
  db.prepare("INSERT INTO treasure (id,campaign_id,adventure_id,source,name,text,qty,sort,created_at,updated_at) VALUES ('loot','camp','adv','custom','Loot','',1,1,?,?)").run(t, t);
  await withServer(db, async (call) => assert.equal((await call("DELETE", "/api/adventures/adv")).status, 200));
  for (const table of ["adventures", "encounters", "notes", "treasure"]) {
    assert.equal(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get(), 0, table);
  }
  db.close();
});

test("import rejects destination-campaign links that do not exist", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const base = { format: "beholden.adventure", version: 2, compendium: [], adventure: { name: "Imported", encounters: [], notes: [], treasure: [] } };
    const player = structuredClone(base);
    player.adventure.encounters = [{ name: "Fight", combatants: [{ baseType: "player", baseId: "missing", name: "Missing", label: "Missing" }] }] as any;
    assert.equal((await call("POST", "/api/campaigns/camp/adventures/import", player)).status, 400);
    const item = structuredClone(base);
    item.adventure.treasure = [{ source: "compendium", itemId: "missing", name: "Missing item" }] as any;
    assert.equal((await call("POST", "/api/campaigns/camp/adventures/import", item)).status, 400);
  });
  db.close();
});
