/**
 * The campaign roster. `routes/players.ts` - nine endpoints - was loaded by no test at all.
 *
 * Two kinds of row live here: a player the DM typed in by hand, whose numbers are the DM's to set,
 * and a player linked to someone's character sheet, whose sheet belongs to that player and whose
 * row is only a projection of it. The second is the one that matters most: a DM editing the roster
 * must be able to damage, heal and condition a linked player without being able to rewrite their
 * character.
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
import { registerPlayerRoutes } from "./players.js";

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

  // A player's own sheet, and the roster row that mirrors it.
  db.prepare(`
    INSERT INTO user_characters (id, user_id, name, level, hp_max, hp_current, ac, speed, character_data_json, created_at, updated_at)
    VALUES ('char-1', 'player', 'Alarion', 5, 38, 38, 16, 30, '{}', ?, ?)
  `).run(t, t);
  db.prepare(`
    INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, class_name, species, level, hp_max, hp_current, ac, speed, live_json, created_at, updated_at)
    VALUES ('p-linked', 'camp-1', 'player', 'char-1', 'Sam', 'Alarion', 'Wizard', 'Elf', 5, 38, 38, 16, 30, '{}', ?, ?)
  `).run(t, t);
  return db;
}

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

/**
 * The roster sends `{ sheet, live }`. Both apps flatten it on arrival; reading the two halves here
 * pins the shape as it goes over the wire.
 */
const flat = (dto: any): any => ({ id: dto.id, ...dto.sheet, ...dto.live });

async function withServer(db: Database.Database, run: (call: (actor: typeof DM) => Call) => Promise<void>) {
  let counter = 0;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = String(req.headers["x-test-actor"] ?? "dm");
    req.user = { ...([DM, PLAYER, OUTSIDER].find((actor) => actor.userId === id) ?? DM) };
    next();
  });
  registerPlayerRoutes(app, {
    db,
    broadcast: () => {},
    helpers: { now: () => Date.now(), uid: () => `new-${++counter}` },
    imageUpload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
    path: { join: (...parts: string[]) => parts.join("/") },
    paths: { dataDir: "." },
    fs: { existsSync: () => false, unlinkSync: () => {} },
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

test("a hand-made player goes through its whole life for the DM", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);

    const created = await dm("POST", "/api/campaigns/camp-1/players", { characterName: "Hireling", hpMax: 12, ac: 13 });
    assert.equal(created.status, 200);
    assert.equal(flat(created.body).characterName, "Hireling");
    assert.equal(flat(created.body).hpCurrent, 12, "a new player starts at full health");
    const id = created.body.id;

    assert.equal((await dm("GET", "/api/campaigns/camp-1/players")).body.length, 2);

    const edited = await dm("PUT", `/api/players/${id}`, { characterName: "Brave Hireling", hpCurrent: 5, level: 2 });
    assert.equal(flat(edited.body).characterName, "Brave Hireling", "a hand-made row is the DM's to rename");
    assert.equal(flat(edited.body).hpCurrent, 5);
    assert.equal(flat(edited.body).level, 2);

    assert.equal((await dm("DELETE", `/api/players/${id}`)).status, 200);
    assert.equal((await dm("GET", "/api/campaigns/camp-1/players")).body.length, 1);
  });
  db.close();
});

test("the DM can hurt, heal and condition a linked player, but not rewrite their character", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const edited = await dm("PUT", "/api/players/p-linked", {
      // The fight's business: allowed.
      hpCurrent: 12,
      conditions: [{ key: "poisoned" }],
      // The player's sheet: ignored, because the sheet is theirs.
      characterName: "Renamed By The DM",
      level: 20,
      hpMax: 999,
      ac: 30,
    });
    assert.equal(edited.status, 200);
    const after = flat(edited.body);
    assert.equal(after.hpCurrent, 12);
    assert.deepEqual(after.conditions.map((c: { key: string }) => c.key), ["poisoned"]);
    assert.equal(after.characterName, "Alarion");
    assert.equal(after.level, 5);
    assert.equal(after.hpMax, 38);
    assert.equal(after.ac, 16);
  });
  db.close();
});

test("numbers that could not exist at the table are refused", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    for (const body of [{ level: -5 }, { level: 0 }, { level: 31 }, { str: 900 }, { dex: 0 }, { ac: -1 }, { hpMax: -10 }, { speed: -30 }]) {
      assert.equal((await dm("POST", "/api/campaigns/camp-1/players", body)).status, 400, `create ${JSON.stringify(body)}`);
      assert.equal((await dm("PUT", "/api/players/p-linked", body)).status, 400, `update ${JSON.stringify(body)}`);
    }
    assert.equal((await dm("GET", "/api/campaigns/camp-1/players")).body.length, 1, "nothing was created");

    // Generous enough for homebrew: level 25 and a 28 Strength are fine.
    assert.equal((await dm("POST", "/api/campaigns/camp-1/players", { level: 25, str: 28 })).status, 200);
  });
  db.close();
});

test("damage past zero leaves a player at zero rather than refusing the hit", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const hit = await call(DM)("PUT", "/api/players/p-linked", { hpCurrent: -14 });
    assert.equal(hit.status, 200, "a damage roll mid-fight is not an error");
    assert.equal(flat(hit.body).hpCurrent, 0);
  });
  db.close();
});

test("the party sees how hurt someone is, not their hit points", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    await call(DM)("PUT", "/api/players/p-linked", { hpCurrent: 19, overrides: { tempHp: 0, acBonus: 2, hpMaxBonus: 0 } });
    const player = call(PLAYER);

    const party = await player("GET", "/api/campaigns/camp-1/party");
    assert.equal(party.status, 200);
    const member = party.body[0];
    assert.equal(member.hpPercent, 50);
    assert.equal(member.hpCurrent, undefined);
    assert.equal(member.ac, 18, "AC arrives with its bonus folded in");
    assert.equal(member.characterData, undefined, "the full sheet only when asked for");

    // The single-member view is the same projection, sheet included.
    const one = await player("GET", "/api/campaigns/camp-1/party/p-linked");
    assert.equal(one.body.hpPercent, 50);
    assert.equal(one.body.ac, 18);
    assert.deepEqual(one.body.characterData, {});
    assert.equal((await player("GET", "/api/campaigns/camp-1/party/nobody")).status, 404);
  });
  db.close();
});

test("players read the roster; only the DM changes it; outsiders see none of it", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const player = call(PLAYER);
    assert.equal((await player("GET", "/api/campaigns/camp-1/party")).status, 200);
    assert.equal((await player("POST", "/api/campaigns/camp-1/players", { characterName: "Me Again" })).status, 403);
    assert.equal((await player("PUT", "/api/players/p-linked", { hpCurrent: 38 })).status, 403);
    assert.equal((await player("DELETE", "/api/players/p-linked")).status, 403);

    const outsider = call(OUTSIDER);
    assert.equal((await outsider("GET", "/api/campaigns/camp-1/players")).status, 403);
    assert.equal((await outsider("GET", "/api/campaigns/camp-1/party")).status, 403);

    assert.ok(db.prepare("SELECT 1 FROM players WHERE id = 'p-linked'").get(), "and the row survived");
  });
  db.close();
});
