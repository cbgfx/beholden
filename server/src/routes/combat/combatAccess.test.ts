/**
 * What each side of the screen may see and do during a fight.
 *
 * The app is deliberate about this everywhere else: a player's own view of a fight reports enemies
 * as Down, Bloodied or Damaged, and the party view rounds hit points to a percentage. The combatant
 * roster handed any member of the campaign the real numbers - hit points, AC, conditions, and the
 * monsters in encounters the party had not reached yet. Neither player app ever asked for it.
 *
 * Also covers the XP award, which had the thinnest coverage of anything in this system.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { signToken } from "../../lib/jwtAuth.js";
import { zodErrorMiddleware } from "../../lib/validate.js";
import type { ServerContext } from "../../server/context.js";
import { registerCombatRoutes } from "./core.js";
import { registerEncounterRoutes } from "../encounters.js";

const DM = { userId: "dm", username: "dm", isAdmin: false };
const PLAYER = { userId: "player", username: "player", isAdmin: false };

type Broadcast = { type: string; payload: Record<string, unknown> };

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();

  for (const actor of [DM, PLAYER]) {
    db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES (?, ?, 'h', ?, ?, ?)")
      .run(actor.userId, actor.username, actor.username, t, t);
  }
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-1', 'Ours', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m1', 'camp-1', 'dm', 'dm', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m2', 'camp-1', 'player', 'player', ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv-1', 'camp-1', 'One', 1, ?, ?)").run(t, t);
  db.prepare("INSERT INTO encounters (id, campaign_id, adventure_id, name, status, sort, created_at, updated_at) VALUES ('enc-1', 'camp-1', 'adv-1', 'Ambush', 'Open', 1, ?, ?)").run(t, t);

  db.prepare(`
    INSERT INTO user_characters (id, user_id, name, level, character_data_json, created_at, updated_at)
    VALUES ('char-1', 'player', 'Alarion', 3, '{"xp":250}', ?, ?)
  `).run(t, t);
  db.prepare(`
    INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, level, hp_max, hp_current, ac, live_json, created_at, updated_at)
    VALUES ('p-1', 'camp-1', 'player', 'char-1', 'Player', 'Alarion', 3, 24, 9, 15, '{}', ?, ?)
  `).run(t, t);

  const addCombatant = db.prepare(`
    INSERT INTO combatants (id, encounter_id, base_type, base_id, snapshot_json, live_json, sort, created_at, updated_at)
    VALUES (?, 'enc-1', ?, ?, ?, ?, ?, ?, ?)
  `);
  addCombatant.run("c-player", "player", "p-1", JSON.stringify({ name: "Alarion", hpMax: 24 }),
    JSON.stringify({ hpCurrent: 9, initiative: 14 }), 1, t, t);
  addCombatant.run("c-boss", "monster", "mon-boss", JSON.stringify({ name: "Ancient Dragon", label: "Dragon", hpMax: 367, ac: 22, friendly: false }),
    JSON.stringify({ hpCurrent: 367, initiative: 20, engagedWithPlayers: 1, conditions: [] }), 2, t, t);
  return db;
}

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

async function withServer(
  db: Database.Database,
  run: (call: (actor: typeof DM) => Call, sent: Broadcast[]) => Promise<void>,
) {
  const sent: Broadcast[] = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = String(req.headers["x-test-actor"] ?? "dm");
    req.user = { ...([DM, PLAYER].find((actor) => actor.userId === id) ?? DM) };
    next();
  });
  const ctx = {
    db,
    broadcast: (type: string, payload: Record<string, unknown>) => { sent.push({ type, payload }); },
    helpers: { now: () => Date.now(), uid: () => `gen-${sent.length}-${Math.random().toString(36).slice(2, 8)}` },
  } as unknown as ServerContext;
  registerCombatRoutes(app, ctx);
  registerEncounterRoutes(app, ctx);
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
          authorization: `Bearer ${signToken({ ...actor, credentialVersion: "v" })}`,
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
    await run(call, sent);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("the monster's real numbers stay on the DM's side of the screen", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const player = call(PLAYER);

    const roster = await dm("GET", "/api/encounters/enc-1/combatants");
    assert.equal(roster.status, 200);
    assert.equal(roster.body.length, 2, "the DM sees everyone");

    for (const path of [
      "/api/encounters/enc-1/combatants",
      "/api/encounters/enc-1/combatants/c-boss",
      "/api/adventures/adv-1/encounters/combatantsSummary",
    ]) {
      const response = await player("GET", path);
      assert.equal(response.status, 403, `${path} is the DM's`);
      assert.ok(!JSON.stringify(response.body).includes("367"), "and says nothing about the dragon");
    }
  });
  db.close();
});

test("a player still gets their own view of the fight, in the terms it is meant to be told in", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const status = await call(PLAYER)("GET", "/api/me/characters/char-1/combat-status");
    assert.equal(status.status, 200);
    assert.equal(status.body.combat.encounterId, "enc-1");

    const enemy = status.body.combat.engagedEnemies[0];
    assert.equal(enemy.name, "Dragon");
    assert.deepEqual(Object.keys(enemy).sort(), ["conditions", "health", "id", "name"], "and nothing else");
    assert.equal(enemy.health, "Damaged", "how hurt it looks, not how many hit points it has");
    assert.equal(enemy.hpCurrent, undefined);
    assert.equal(enemy.hpMax, undefined);
    assert.ok(!JSON.stringify(status.body).includes("367"));

    // Whose turn it is stays readable: the player needs it to know when to act.
    assert.equal((await call(PLAYER)("GET", "/api/encounters/enc-1/combatState")).status, 200);
  });
  db.close();
});

test("XP goes to the characters who were in the fight", async () => {
  const db = seedDb();
  await withServer(db, async (call, sent) => {
    const dm = call(DM);

    const awarded = await dm("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 150 });
    assert.equal(awarded.status, 200);
    assert.equal(awarded.body.awarded, 1, "one character was in this fight; the dragon does not level up");

    const xpOf = () => {
      const row = db.prepare("SELECT json_extract(character_data_json, '$.xp') AS xp FROM user_characters WHERE id = 'char-1'").get() as { xp: number };
      return row.xp;
    };
    assert.equal(xpOf(), 400, "added to what was already there, not replacing it");
    assert.deepEqual(
      sent.filter((event) => event.type === "xp:awarded").map((event) => event.payload),
      [{ campaignId: "camp-1", characterId: "char-1", xpAdded: 150 }],
    );

    // A victory pays once. A second press - a double-click, a reconnecting tab, a DM who cannot
    // remember whether they already did it - is refused rather than quietly paying again.
    const again = await dm("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 150 });
    assert.equal(again.status, 409);
    assert.match(again.body.message, /already been awarded/i);
    assert.equal(xpOf(), 400, "and nothing was added");

    // Resetting the fight is what makes it winnable again, so it makes it payable again.
    await dm("PUT", "/api/encounters/enc-1", { status: "Complete" });
    assert.equal((await dm("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 150 })).status, 409,
      "finishing a fight is not resetting it");

    await dm("PUT", "/api/encounters/enc-1", { status: "Open" });
    assert.equal((await dm("GET", "/api/encounters/enc-1")).body.xpAwardedAt, null);
    assert.equal((await dm("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 150 })).status, 200);
    assert.equal(xpOf(), 550, "the party is paid for running it again");
  });
  db.close();
});

test("an XP award that makes no sense is refused, and changes nothing", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const xpOf = () => (db.prepare("SELECT json_extract(character_data_json, '$.xp') AS xp FROM user_characters WHERE id = 'char-1'").get() as { xp: number }).xp;

    for (const body of [{ xpPerCharacter: 0 }, { xpPerCharacter: -50 }, { xpPerCharacter: "lots" }, {}]) {
      const response = await dm("POST", "/api/encounters/enc-1/award-xp", body);
      assert.equal(response.status, 400, `${JSON.stringify(body)} is not an award`);
    }
    assert.equal(xpOf(), 250, "nothing was written");

    assert.equal((await dm("POST", "/api/encounters/no-such-encounter/award-xp", { xpPerCharacter: 10 })).status, 403);
    // A player cannot hand out experience, in their own fight or anyone else's.
    assert.equal((await call(PLAYER)("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 10 })).status, 403);
    assert.equal(xpOf(), 250);
  });
  db.close();
});

test("an encounter with nobody linked to a sheet awards nothing rather than failing", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    // A player row the DM made by hand, with no character behind it.
    db.prepare("UPDATE players SET character_id = NULL WHERE id = 'p-1'").run();

    const awarded = await call(DM)("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 150 });
    assert.equal(awarded.status, 200);
    assert.equal(awarded.body.awarded, 0);
  });
  db.close();
});

test("resetting a fight that was never marked finished still makes it payable again", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    assert.equal((await dm("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 100 })).status, 200);
    assert.notEqual((await dm("GET", "/api/encounters/enc-1")).body.xpAwardedAt, null);

    // Renaming, or anything else that says nothing about the status, leaves the award standing.
    await dm("PUT", "/api/encounters/enc-1", { name: "Ambush at the ford" });
    assert.equal((await dm("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 100 })).status, 409);

    // The DM app's reset sends Open whether or not the fight was ever marked Complete. The first
    // version of this rule only cleared the award on a change of status, so resetting a fight that
    // was still Open did nothing at all - which is the common case.
    await dm("PUT", "/api/encounters/enc-1", { status: "Open" });
    assert.equal((await dm("GET", "/api/encounters/enc-1")).body.xpAwardedAt, null);
    assert.equal((await dm("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 100 })).status, 200);
  });
  db.close();
});

test("a duplicated encounter is a fresh fight and has not been paid", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    await dm("POST", "/api/encounters/enc-1/award-xp", { xpPerCharacter: 100 });
    const copy = await dm("POST", "/api/encounters/enc-1/duplicate");
    assert.equal(copy.status, 200);
    assert.equal(copy.body.xpAwardedAt, null);
    assert.equal((await dm("POST", `/api/encounters/${copy.body.id}/award-xp`, { xpPerCharacter: 100 })).status, 200);
  });
  db.close();
});

// --- turn order ----------------------------------------------------------------

/** Four combatants in initiative order: dragon 20, goblin 15, player 14, ogre 8. */
function seedFight(db: Database.Database) {
  const t = Date.now();
  const add = db.prepare(`
    INSERT INTO combatants (id, encounter_id, base_type, base_id, snapshot_json, live_json, sort, created_at, updated_at)
    VALUES (?, 'enc-1', 'monster', ?, ?, ?, ?, ?, ?)
  `);
  add.run("c-goblin", "mon-gob", JSON.stringify({ name: "Goblin", hpMax: 7 }), JSON.stringify({ hpCurrent: 7, initiative: 15 }), 3, t, t);
  add.run("c-ogre", "mon-ogre", JSON.stringify({ name: "Ogre", hpMax: 59 }), JSON.stringify({ hpCurrent: 59, initiative: 8 }), 4, t, t);
}

const turnOf = (db: Database.Database) =>
  db.prepare("SELECT combat_round AS round, combat_active_combatant_id AS active FROM encounters WHERE id = 'enc-1'").get() as { round: number; active: string | null };

test("removing whoever's turn it is hands the turn to the next in initiative", async () => {
  const db = seedDb();
  seedFight(db);
  await withServer(db, async (call, sent) => {
    const dm = call(DM);
    // Round 2, the goblin is acting (second in the order).
    await dm("PUT", "/api/encounters/enc-1/combatState", { round: 2, activeCombatantId: "c-goblin" });

    const removed = await dm("DELETE", "/api/encounters/enc-1/combatants/c-goblin");
    assert.equal(removed.status, 200);
    // The player (14) is next - not the dragon at the top of the order, which is where the next
    // press of Next used to land.
    assert.deepEqual(turnOf(db), { round: 2, active: "c-player" });
    assert.ok(sent.some((event) => event.type === "encounter:combatStateChanged"), "clients are told the turn moved");
  });
  db.close();
});

test("removing the last to act in a round starts the next round", async () => {
  const db = seedDb();
  seedFight(db);
  await withServer(db, async (call) => {
    const dm = call(DM);
    await dm("PUT", "/api/encounters/enc-1/combatState", { round: 3, activeCombatantId: "c-ogre" });
    await dm("DELETE", "/api/encounters/enc-1/combatants/c-ogre");
    assert.deepEqual(turnOf(db), { round: 4, active: "c-boss" });
  });
  db.close();
});

test("removing someone whose turn it is not leaves the turn alone", async () => {
  const db = seedDb();
  seedFight(db);
  await withServer(db, async (call) => {
    const dm = call(DM);
    await dm("PUT", "/api/encounters/enc-1/combatState", { round: 2, activeCombatantId: "c-player" });
    await dm("DELETE", "/api/encounters/enc-1/combatants/c-goblin");
    assert.deepEqual(turnOf(db), { round: 2, active: "c-player" });
  });
  db.close();
});

test("the turn cannot be handed to someone who is not in the fight", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    await dm("PUT", "/api/encounters/enc-1/combatState", { round: 1, activeCombatantId: "c-player" });
    const refused = await dm("PUT", "/api/encounters/enc-1/combatState", { round: 1, activeCombatantId: "somebody-else" });
    assert.equal(refused.status, 400);
    assert.deepEqual(turnOf(db), { round: 1, active: "c-player" }, "nothing changed");
    // Clearing the turn (combat over) is still allowed.
    assert.equal((await dm("PUT", "/api/encounters/enc-1/combatState", { round: 1, activeCombatantId: null })).status, 200);
  });
  db.close();
});
