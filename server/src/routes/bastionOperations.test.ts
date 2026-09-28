/**
 * Bastion operation endpoints: small writes that each change one thing on the current row.
 *
 * Permissions come first, because they were previously enforced by diffing a player's whole
 * facility array against the stored one. The rules: the DM changes anything; a player changes only
 * their own player facilities, on an active bastion they're assigned to.
 *
 * Requests run as real campaign members (not admins), so the campaign middleware is exercised too.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import type { ServerContext } from "../server/context.js";
import { registerBastionRoutes } from "./bastions.js";
import { zodErrorMiddleware } from "../lib/validate.js";

type Facility = { id: string; facilityKey: string; source: "player" | "dm_extra"; ownerPlayerId: string | null; order: string | null; notes: string; size: string | null; hirelings?: number };
type BastionBody = { id: string; name: string; notes: string; walled: boolean; facilities: Facility[] };
type Reply = { status: number; body: { ok?: boolean; message?: string; facilityId?: string; id?: string; bastion?: BastionBody } };
type Call = (userId: string, method: string, path: string, body?: unknown) => Promise<Reply>;

const CAMPAIGN = "camp-1";
const DM = "u-dm";
// Alice (level 5, two special slots) and Bob (level 9) are assigned; Carol is in the campaign but not on the bastion.
const ALICE = "u-alice";
const BOB = "u-bob";
const CAROL = "u-carol";

async function withServer(run: (args: { call: Call; db: Database.Database; broadcasts: Array<Record<string, unknown>> }) => Promise<void>) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  db.prepare("INSERT INTO campaigns (id, name, color, image_url, shared_notes, created_at, updated_at) VALUES (?, 'Test', NULL, NULL, '', ?, ?)").run(CAMPAIGN, t, t);

  const users: Array<[string, "dm" | "player"]> = [[DM, "dm"], [ALICE, "player"], [BOB, "player"], [CAROL, "player"]];
  for (const [userId, role] of users) {
    db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES (?, ?, 'hash', ?, ?, ?)").run(userId, userId, userId, t, t);
    db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(`m-${userId}`, CAMPAIGN, userId, role, t, t);
  }
  const players: Array<[string, string, number]> = [["p-alice", ALICE, 5], ["p-bob", BOB, 9], ["p-carol", CAROL, 5]];
  for (const [playerId, userId, level] of players) {
    db.prepare("INSERT INTO players (id, campaign_id, user_id, character_name, level, live_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?)").run(playerId, CAMPAIGN, userId, playerId, level, t, t);
  }

  // The last column is the compendium entry's extra data: a basic facility's sizes, a special
  // facility's upgrade.
  const facilities: Array<[string, string, number, string[], boolean, Record<string, unknown>]> = [
    ["bedroom", "basic", 0, [], true, { spaces: ["cramped", "roomy", "vast"] }],
    ["garden", "special", 5, ["Harvest"], true, { upgrade: { to: "vast", costGp: 2000, hirelingsDelta: 1, summary: "Two gardens" } }],
    ["smithy", "special", 5, ["Craft"], false, {}],
    ["library", "special", 5, ["Research"], false, {}],
    ["sanctum", "special", 17, ["Empower"], false, {}],
  ];
  for (const [key, type, level, orders, allowMultiple, data] of facilities) {
    db.prepare(`
      INSERT INTO compendium_bastion_facilities
        (id, ruleset, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json)
      VALUES (?, '5.5e', ?, ?, ?, ?, NULL, ?, ?, 1, ?, NULL, ?)
    `).run(
      `bf_${key}`, key[0]!.toUpperCase() + key.slice(1), key, type, level, JSON.stringify(orders),
      type === "basic" ? null : "Roomy", allowMultiple ? 1 : 0, JSON.stringify(data),
    );
  }
  const spaces: Array<[string, number, Record<string, unknown>]> = [
    ["cramped", 0, { basicUpgrade: { to: "roomy", costGp: 500 } }],
    ["roomy", 1, { basicUpgrade: { to: "vast", costGp: 2000 } }],
    ["vast", 2, {}],
  ];
  for (const [key, sort, data] of spaces) {
    db.prepare("INSERT INTO compendium_bastion_spaces (id, ruleset, name, name_key, squares, sort_index, data_json) VALUES (?, '5.5e', ?, ?, 4, ?, ?)")
      .run(`bs_${key}`, key[0]!.toUpperCase() + key.slice(1), key, sort, JSON.stringify(data));
  }
  db.prepare("INSERT INTO compendium_bastion_rules (id, ruleset, name, data_json) VALUES ('bastion_rules', '5.5e', 'Bastion Rules', ?)")
    .run(JSON.stringify({ specialFacilitySlots: [{ level: 5, count: 2 }, { level: 9, count: 4 }, { level: 13, count: 5 }, { level: 17, count: 6 }] }));

  let actingUserId = DM;
  let idCounter = 0;
  const broadcasts: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: actingUserId, username: actingUserId, isAdmin: false };
    next();
  });
  registerBastionRoutes(app, {
    db,
    broadcast: (_type: string, payload: Record<string, unknown>) => { broadcasts.push(payload); },
    helpers: { now: () => Date.now(), uid: () => `id-${++idCounter}` },
  } as unknown as ServerContext);
  app.use(zodErrorMiddleware);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;

  const call: Call = (userId, method, path, body) => {
    // Requests run one at a time, so switching the acting user per call is safe.
    actingUserId = userId;
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {},
        },
        (res) => {
          let raw = "";
          res.on("data", (chunk) => { raw += chunk; });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : {} }));
        },
      );
      req.on("error", reject);
      req.end(payload);
    });
  };

  try {
    await run({ call, db, broadcasts });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    db.close();
  }
}

const base = (bastionId: string) => `/api/campaigns/${CAMPAIGN}/bastions/${bastionId}`;

/** An active bastion with Alice and Bob assigned, created by the DM. */
async function createKeep(call: Call): Promise<string> {
  const created = await call(DM, "POST", `/api/campaigns/${CAMPAIGN}/bastions`, {
    name: "Keep",
    active: true,
    assignedPlayerIds: ["p-alice", "p-bob"],
    facilities: [],
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  return String(created.body.id);
}

async function addFacility(call: Call, userId: string, bastionId: string, body: Record<string, unknown>): Promise<string> {
  const added = await call(userId, "POST", `${base(bastionId)}/facilities`, body);
  assert.equal(added.status, 200, JSON.stringify(added.body));
  return String(added.body.facilityId);
}

// MARK: - Permissions

test("players add facilities only for their own character, and can't grant", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);

    // No owner named: Alice has one character on the bastion, so it's hers.
    const added = await call(ALICE, "POST", `${base(id)}/facilities`, { facilityKey: "garden", source: "player" });
    assert.equal(added.status, 200, JSON.stringify(added.body));
    const facility = added.body.bastion?.facilities.find((entry) => entry.id === added.body.facilityId);
    assert.equal(facility?.ownerPlayerId, "p-alice");

    const forBob = await call(ALICE, "POST", `${base(id)}/facilities`, { facilityKey: "bedroom", source: "player", ownerPlayerId: "p-bob" });
    assert.equal(forBob.status, 403);

    const grant = await call(ALICE, "POST", `${base(id)}/facilities`, { facilityKey: "bedroom", source: "dm_extra" });
    assert.equal(grant.status, 403);
  });
});

test("players edit and remove only their own facilities", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);
    const bobs = await addFacility(call, DM, id, { facilityKey: "library", source: "player", ownerPlayerId: "p-bob" });
    const granted = await addFacility(call, DM, id, { facilityKey: "smithy", source: "dm_extra" });
    const alices = await addFacility(call, ALICE, id, { facilityKey: "garden", source: "player" });

    const own = await call(ALICE, "PATCH", `${base(id)}/facilities/${alices}`, { order: "Harvest", notes: "Herbs" });
    assert.equal(own.status, 200, JSON.stringify(own.body));

    assert.equal((await call(ALICE, "PATCH", `${base(id)}/facilities/${bobs}`, { notes: "Mine now" })).status, 403);
    assert.equal((await call(ALICE, "PATCH", `${base(id)}/facilities/${granted}`, { order: "Maintain" })).status, 403);
    assert.equal((await call(ALICE, "DELETE", `${base(id)}/facilities/${bobs}`)).status, 403);
    assert.equal((await call(ALICE, "DELETE", `${base(id)}/facilities/${granted}`)).status, 403);

    const removed = await call(ALICE, "DELETE", `${base(id)}/facilities/${alices}`);
    assert.equal(removed.status, 200);
    const remaining = removed.body.bastion?.facilities ?? [];
    assert.deepEqual(remaining.map((entry) => entry.id).sort(), [bobs, granted].sort());
    // Bob's facility is untouched by Alice's attempts.
    assert.equal(remaining.find((entry) => entry.id === bobs)?.notes, "");
  });
});

test("bastion-wide changes are DM-only", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);

    assert.equal((await call(ALICE, "PATCH", base(id), { notes: "Player notes" })).status, 403);
    assert.equal((await call(ALICE, "PUT", `${base(id)}/maintain`, { enabled: true })).status, 403);
    assert.equal((await call(ALICE, "PUT", `${base(id)}/players/p-carol`)).status, 403);
    assert.equal((await call(ALICE, "DELETE", `${base(id)}/players/p-bob`)).status, 403);

    const dm = await call(DM, "PATCH", base(id), { notes: "Walls need work", walled: true });
    assert.equal(dm.status, 200, JSON.stringify(dm.body));
    assert.equal(dm.body.bastion?.notes, "Walls need work");
    assert.equal(dm.body.bastion?.walled, true);
    // Nothing else changed.
    assert.equal(dm.body.bastion?.name, "Keep");
  });
});

test("players can't act on a bastion they aren't assigned to, or an inactive one", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);

    assert.equal((await call(CAROL, "POST", `${base(id)}/facilities`, { facilityKey: "garden", source: "player" })).status, 403);

    assert.equal((await call(DM, "PATCH", base(id), { active: false })).status, 200);
    assert.equal((await call(ALICE, "POST", `${base(id)}/facilities`, { facilityKey: "garden", source: "player" })).status, 403);
  });
});

// MARK: - Rules

test("adding a facility enforces level, slots and duplicates, except for DM grants", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);
    const add = (userId: string, body: Record<string, unknown>) => call(userId, "POST", `${base(id)}/facilities`, body);

    assert.equal((await add(ALICE, { facilityKey: "sanctum", source: "player" })).status, 400, "level 17 facility for a level 5 player");

    await addFacility(call, ALICE, id, { facilityKey: "smithy", source: "player" });
    await addFacility(call, ALICE, id, { facilityKey: "library", source: "player" });
    const third = await add(ALICE, { facilityKey: "garden", source: "player" });
    assert.equal(third.status, 400, "level 5 has two special slots");
    assert.match(String(third.body.message), /slots/);
    // A basic facility doesn't use a slot.
    assert.equal((await add(ALICE, { facilityKey: "bedroom", source: "player" })).status, 200);

    assert.equal((await add(BOB, { facilityKey: "smithy", source: "player" })).status, 400, "Smithy can only be added once");

    // Granting is the DM's override.
    assert.equal((await add(DM, { facilityKey: "sanctum", source: "dm_extra" })).status, 200);
  });
});

test("a facility's order must be one it accepts, or Maintain", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);
    const smithy = await addFacility(call, ALICE, id, { facilityKey: "smithy", source: "player" });
    const edit = (body: Record<string, unknown>) => call(ALICE, "PATCH", `${base(id)}/facilities/${smithy}`, body);

    assert.equal((await edit({ order: "Harvest" })).status, 400);
    assert.equal((await edit({ order: "Craft" })).status, 200);
    assert.equal((await edit({ order: "Maintain" })).status, 200);
    const cleared = await edit({ order: "" });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.bastion?.facilities.find((entry) => entry.id === smithy)?.order, null);
  });
});

// MARK: - Concurrency

test("edits to different facilities by different people both survive", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);
    const garden = await addFacility(call, ALICE, id, { facilityKey: "garden", source: "player" });
    const library = await addFacility(call, BOB, id, { facilityKey: "library", source: "player" });

    // Under whole-bastion saves, the second of these would have written back Bob's stale copy of Alice's facility.
    await call(ALICE, "PATCH", `${base(id)}/facilities/${garden}`, { notes: "Alice's note" });
    await call(BOB, "PATCH", `${base(id)}/facilities/${library}`, { notes: "Bob's note" });

    const current = await call(DM, "GET", base(id));
    const notes = Object.fromEntries((current.body.bastion?.facilities ?? []).map((entry) => [entry.id, entry.notes]));
    assert.equal(notes[garden], "Alice's note");
    assert.equal(notes[library], "Bob's note");
  });
});

// MARK: - Ownerless facilities

test("unassigning a player keeps their facilities as Granted", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);
    const garden = await addFacility(call, ALICE, id, { facilityKey: "garden", source: "player" });

    const unassigned = await call(DM, "DELETE", `${base(id)}/players/p-alice`);
    assert.equal(unassigned.status, 200, JSON.stringify(unassigned.body));
    const facility = unassigned.body.bastion?.facilities.find((entry) => entry.id === garden);
    assert.equal(facility?.source, "dm_extra");
    assert.equal(facility?.ownerPlayerId, null);
  });
});

test("a deleted player's facilities become Granted and the bastion stays editable", async () => {
  await withServer(async ({ call, db }) => {
    const id = await createKeep(call);
    await addFacility(call, ALICE, id, { facilityKey: "garden", source: "player" });
    await addFacility(call, ALICE, id, { facilityKey: "smithy", source: "player" });

    // What deleting a character does: the player row goes, and its bastion link cascades with it,
    // but the facility list still names the deleted owner.
    db.prepare("DELETE FROM players WHERE id = 'p-alice'").run();

    const shown = await call(DM, "GET", base(id));
    assert.ok(shown.body.bastion?.facilities.every((entry) => entry.source === "dm_extra" && entry.ownerPlayerId === null));

    // Previously every save failed with "invalid owner player assignment".
    const renamed = await call(DM, "PATCH", base(id), { name: "Still editable" });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    const stored = JSON.parse((db.prepare("SELECT facilities_json FROM bastions WHERE id = ?").get(id) as { facilities_json: string }).facilities_json) as Facility[];
    assert.ok(stored.every((entry) => entry.source === "dm_extra"), "the repair is persisted by the write");
  });
});

// MARK: - Contract

test("operations attribute their broadcast and respond with the saved bastion", async () => {
  await withServer(async ({ call, broadcasts }) => {
    const id = await createKeep(call);
    broadcasts.length = 0;

    const edited = await call(DM, "PATCH", base(id), { notes: "Fresh", clientId: "tab-z" });
    assert.equal(edited.body.bastion?.notes, "Fresh");
    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0]?.originClientId, "tab-z");
    assert.equal(broadcasts[0]?.bastionId, id);

    // A refused operation neither writes nor broadcasts.
    broadcasts.length = 0;
    assert.equal((await call(ALICE, "PATCH", base(id), { notes: "Nope" })).status, 403);
    assert.equal(broadcasts.length, 0);
  });
});

// MARK: - Size and upgrades

test("new facilities start at their size: basic Cramped, special their catalogue size", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);
    const bedroom = await addFacility(call, DM, id, { facilityKey: "bedroom", source: "dm_extra" });
    const added = await call(ALICE, "POST", `${base(id)}/facilities`, { facilityKey: "garden", source: "player" });
    assert.equal(added.status, 200, JSON.stringify(added.body));

    const facilities = added.body.bastion?.facilities ?? [];
    assert.equal(facilities.find((entry) => entry.id === bedroom)?.size, "cramped");
    assert.equal(facilities.find((entry) => entry.id === added.body.facilityId)?.size, "roomy");
  });
});

test("the DM's pill upgrades, downgrades and resets, within the sizes a facility may have", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);
    const garden = await addFacility(call, DM, id, { facilityKey: "garden", source: "dm_extra" });
    const bedroom = await addFacility(call, DM, id, { facilityKey: "bedroom", source: "dm_extra" });
    const smithy = await addFacility(call, DM, id, { facilityKey: "smithy", source: "dm_extra" });
    const setSize = (facilityId: string, size: string) => call(DM, "PUT", `${base(id)}/facilities/${facilityId}/size`, { size });
    const find = (reply: Reply, facilityId: string) => reply.body.bastion?.facilities.find((entry) => entry.id === facilityId);

    const upgraded = await setSize(garden, "Vast");
    assert.equal(upgraded.status, 200, JSON.stringify(upgraded.body));
    assert.equal(find(upgraded, garden)?.size, "vast");
    // The upgrade's extra hireling counts only while upgraded.
    assert.equal(find(upgraded, garden)?.hirelings, 2);
    assert.equal(find(await setSize(garden, "roomy"), garden)?.hirelings, 1);
    assert.equal((await setSize(garden, "cramped")).status, 400, "a Garden is never Cramped");

    // A basic facility cycles up and back to Cramped.
    for (const size of ["roomy", "vast", "cramped"]) {
      assert.equal(find(await setSize(bedroom, size), bedroom)?.size, size);
    }

    assert.equal((await setSize(smithy, "vast")).status, 400, "a Smithy has no upgrade");
  });
});

test("only the DM can change a facility's size", async () => {
  await withServer(async ({ call }) => {
    const id = await createKeep(call);
    const garden = await addFacility(call, ALICE, id, { facilityKey: "garden", source: "player" });
    assert.equal((await call(ALICE, "PUT", `${base(id)}/facilities/${garden}/size`, { size: "vast" })).status, 403);
  });
});

test("special facility slots come from the compendium's rules entry, or the book's when it has none", async () => {
  await withServer(async ({ call, db }) => {
    const id = await createKeep(call);
    db.prepare("UPDATE compendium_bastion_rules SET data_json = ?").run(JSON.stringify({ specialFacilitySlots: [{ level: 5, count: 1 }] }));
    await addFacility(call, ALICE, id, { facilityKey: "smithy", source: "player" });
    assert.equal((await call(ALICE, "POST", `${base(id)}/facilities`, { facilityKey: "library", source: "player" })).status, 400);

    // With no rules entry at all, level 5 falls back to the book's two slots.
    db.prepare("DELETE FROM compendium_bastion_rules").run();
    assert.equal((await call(ALICE, "POST", `${base(id)}/facilities`, { facilityKey: "library", source: "player" })).status, 200);
  });
});
