/**
 * The DM's party-wide rest is a Long Rest, so it has to follow the same condition rules as the
 * player's own Long Rest button. It used to wipe state wholesale -- every condition, every override
 * -- which quietly destroyed two things a night's sleep should never touch: a petrified character's
 * condition, and the AC/HP maximum a polymorph is holding on the character's behalf.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import type { ServerContext } from "../../server/context.js";
import { registerCampaignRoutes } from "./core.js";

type LiveState = {
  overrides?: Record<string, unknown>;
  // Conditions carry per-key payloads (polymorph stashes the numbers it replaced), so this stays
  // open rather than being narrowed to the key alone.
  conditions?: Array<{ key: string } & Record<string, unknown>>;
};

function seedPlayer(
  db: Database.Database,
  id: string,
  live: LiveState,
  hpMax = 30,
  hpCurrent = 4,
) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO players (id, campaign_id, player_name, character_name, level, hp_max, hp_current, ac, live_json, created_at, updated_at)
    VALUES (?, 'campaign-1', 'P', 'C', 1, ?, ?, 10, ?, ?, ?)
  `).run(id, hpMax, hpCurrent, JSON.stringify(live), now, now);
}

/**
 * Read a player's live state back through the same defaults the serializer strips: it drops
 * `conditions` when empty and `overrides` when every value is a default, so a raw parse would
 * report undefined where the meaning is "none" and "all zero".
 */
function readLive(db: Database.Database, id: string): Required<LiveState> & { hpCurrent: number } {
  const row = db.prepare("SELECT hp_current, live_json FROM players WHERE id = ?").get(id) as {
    hp_current: number;
    live_json: string;
  };
  const live = JSON.parse(row.live_json) as LiveState;
  return {
    conditions: live.conditions ?? [],
    overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0, ...(live.overrides ?? {}) },
    hpCurrent: row.hp_current,
  };
}

async function withServer(
  db: Database.Database,
  run: (post: (path: string) => Promise<number>) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: "admin", username: "admin", isAdmin: true };
    next();
  });
  registerCampaignRoutes(app, {
    db,
    broadcast: () => {},
    path: { join: (...parts: string[]) => parts.join("/") },
    paths: { dataDir: "." },
    helpers: { now: () => Date.now(), uid: () => "uid" },
    // Only the rest route is under test; the image routes registered alongside it just need
    // their middleware to exist.
    upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
  } as unknown as ServerContext);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  const post = (path: string) => new Promise<number>((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path, method: "POST", headers: { "Content-Length": "0" } },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.on("error", reject);
    req.end();
  });

  try {
    await run(post);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  const now = Date.now();
  db.prepare(`
    INSERT INTO campaigns (id, name, color, image_url, shared_notes, created_at, updated_at)
    VALUES ('campaign-1', 'Test', NULL, NULL, '', ?, ?)
  `).run(now, now);
  return db;
}

test("party rest ends the conditions a night outlasts and heals to full", async (t) => {
  const db = freshDb();
  t.after(() => db.close());
  seedPlayer(db, "p1", {
    overrides: { tempHp: 7, acBonus: 2, hpMaxBonus: 3 },
    conditions: [{ key: "poisoned" }, { key: "stunned" }, { key: "charmed" }],
  });

  await withServer(db, async (post) => {
    assert.equal(await post("/api/campaigns/campaign-1/fullRest"), 200);
  });

  const live = readLive(db, "p1");
  assert.deepEqual(live.conditions, []);
  assert.equal(live.hpCurrent, 30);
  assert.equal(live.overrides.tempHp, 0);
});

test("party rest leaves petrified in place", async (t) => {
  const db = freshDb();
  t.after(() => db.close());
  seedPlayer(db, "p1", { conditions: [{ key: "petrified" }, { key: "prone" }] });

  await withServer(db, async (post) => {
    assert.equal(await post("/api/campaigns/campaign-1/fullRest"), 200);
  });

  // Only Greater Restoration ends it -- sleeping it off would be a free cure.
  assert.deepEqual(readLive(db, "p1").conditions, [{ key: "petrified" }]);
});

test("party rest reverts a polymorph rather than stranding the form's numbers", async (t) => {
  const db = freshDb();
  t.after(() => db.close());
  seedPlayer(db, "p1", {
    // Mid-polymorph: the live AC/HP-max bonuses belong to the form, and the condition is holding
    // the character's own values.
    overrides: { tempHp: 0, acBonus: 9, hpMaxBonus: 40 },
    conditions: [
      { key: "polymorphed", originalAcBonus: 1, originalHpMaxBonus: 2, originalHpCurrent: 12 },
    ],
  });

  await withServer(db, async (post) => {
    assert.equal(await post("/api/campaigns/campaign-1/fullRest"), 200);
  });

  const live = readLive(db, "p1");
  assert.deepEqual(live.conditions, []);
  // The form's +9/+40 are gone, and so are the character's own bonuses -- they weren't permanent.
  assert.equal(live.overrides.acBonus, 0);
  assert.equal(live.overrides.hpMaxBonus, 0);
});

test("party rest keeps manual bonuses that were marked permanent", async (t) => {
  const db = freshDb();
  t.after(() => db.close());
  seedPlayer(db, "p1", {
    overrides: {
      tempHp: 5,
      acBonus: 2,
      hpMaxBonus: 4,
      permanent: { acBonus: true },
    },
    conditions: [],
  });

  await withServer(db, async (post) => {
    assert.equal(await post("/api/campaigns/campaign-1/fullRest"), 200);
  });

  const live = readLive(db, "p1");
  assert.equal(live.overrides.acBonus, 2, "permanent AC bonus survives the rest");
  assert.equal(live.overrides.hpMaxBonus, 0, "non-permanent HP-max bonus does not");
  assert.equal(live.overrides.tempHp, 0);
});
