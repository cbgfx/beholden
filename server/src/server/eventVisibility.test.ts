/**
 * Locking the note routes down is only half the job: the same note text goes out over the
 * WebSocket as the DM types. Scope filtering asks which campaign a socket is watching, which is a
 * question about relevance, not permission - so a player's socket matched the DM's own campaign and
 * received every note delta.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import type WebSocket from "ws";
import type { WebSocketServer } from "ws";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { canDeliverEvent } from "./eventVisibility.js";
import { createBroadcaster, type WsUser } from "./ws.js";

const DM: WsUser = { userId: "dm", isAdmin: false };
const PLAYER: WsUser = { userId: "player", isAdmin: false };
const OTHER_DM: WsUser = { userId: "other-dm", isAdmin: false };
const ADMIN: WsUser = { userId: "admin", isAdmin: true };

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-1', 'Ours', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-2', 'Theirs', ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('a1', 'camp-1', 'Chapter', 1, ?, ?)").run(t, t);
  db.prepare("INSERT INTO encounters (id, adventure_id, campaign_id, name, sort, created_at, updated_at) VALUES ('e1', 'a1', 'camp-1', 'Fight', 1, ?, ?)").run(t, t);
  for (const [id, user, campaign, role] of [
    ["m1", "dm", "camp-1", "dm"],
    ["m2", "player", "camp-1", "player"],
    ["m3", "other-dm", "camp-2", "dm"],
  ] as const) {
    db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES (?, ?, 'h', ?, ?, ?)")
      .run(user, user, user, t, t);
    db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, campaign, user, role, t, t);
  }
  return db;
}

const noteDelta = {
  campaignId: "camp-1",
  adventureId: null,
  action: "upsert" as const,
  noteId: "n1",
  note: { id: "n1", scope: { campaignId: "camp-1", adventureId: null }, content: { title: "Secret", text: "The mayor is the villain." }, meta: { sort: 1, createdAt: 1, updatedAt: 1 } },
};

test("only the campaign's DM may receive a note delta", () => {
  const db = seedDb();
  const may = (user: WsUser | null) => canDeliverEvent(db, user, "notes:delta", noteDelta as never);

  assert.equal(may(DM), true);
  assert.equal(may(ADMIN), true, "an admin already reads everything over HTTP");
  assert.equal(may(PLAYER), false, "a player in the campaign is still a player");
  assert.equal(may(OTHER_DM), false, "being a DM elsewhere is not being a DM here");
  assert.equal(may(null), false, "an unidentified socket gets nothing DM-only");

  // Events that are not DM-only are unaffected: the party has to see its own state change.
  assert.equal(canDeliverEvent(db, PLAYER, "players:delta", { campaignId: "camp-1", action: "refresh" } as never), true);
  assert.equal(canDeliverEvent(db, null, "players:delta", { campaignId: "camp-1", action: "refresh" } as never), false);
  assert.equal(canDeliverEvent(db, OTHER_DM, "players:delta", { campaignId: "camp-1", action: "refresh" } as never), false);
  assert.equal(canDeliverEvent(db, OTHER_DM, "campaigns:changed", { campaignId: "camp-1" } as never), true,
    "campaign-list invalidation must reach a user immediately after their membership is removed");
  db.close();
});

test("the broadcaster sends a note delta to the DM's socket and not the player's", () => {
  const db = seedDb();
  const sent: Array<{ who: string; msg: string }> = [];

  // Just enough of a socket for the broadcaster: an open state, a send, and an identity.
  const socket = (who: string, user: WsUser | null) => ({
    readyState: 1,
    OPEN: 1,
    send: (msg: string) => sent.push({ who, msg }),
    __beholdenUser: user,
    __beholdenScope: { campaignId: "camp-1", adventureId: null, encounterId: null },
  }) as unknown as WebSocket;

  const clients = new Set([socket("dm", DM), socket("player", PLAYER), socket("anonymous", null)]);
  const broadcast = createBroadcaster({ clients } as unknown as WebSocketServer, {
    canDeliver: (user, type, payload) => canDeliverEvent(db, user, type, payload),
  });

  broadcast("notes:delta", noteDelta as never);
  assert.deepEqual(sent.map((entry) => entry.who), ["dm"]);
  assert.match(sent[0]!.msg, /The mayor is the villain/);

  // A players delta reaches members watching that campaign, never an unidentified socket.
  sent.length = 0;
  broadcast("players:delta", { campaignId: "camp-1", action: "upsert", playerId: "p1" } as never);
  assert.deepEqual(sent.map((entry) => entry.who).sort(), ["dm", "player"]);
  db.close();
});

test("INPCs are the DM's too, even though the event carries only ids", () => {
  const db = seedDb();
  const inpcDelta = { campaignId: "camp-1", action: "upsert" as const, inpcId: "npc-1" };
  const may = (user: WsUser | null) => canDeliverEvent(db, user, "inpcs:delta", inpcDelta as never);

  // Every INPC route is DM-only, so telling a player one changed is telling them about something
  // they cannot read - and a client that reacted to it would collect a 403 for its trouble.
  assert.equal(may(DM), true);
  assert.equal(may(ADMIN), true);
  assert.equal(may(PLAYER), false);
  assert.equal(may(OTHER_DM), false);
  assert.equal(may(null), false);
  db.close();
});

test("events the party is allowed to read still reach the party", () => {
  const db = seedDb();
  // Treasure and combatants are readable by any member over HTTP, so holding the broadcast back
  // would only make the app feel broken. This pins the decision, so a later change is deliberate.
  const open: Array<[string, unknown]> = [
    ["treasure:delta", { campaignId: "camp-1", action: "upsert", treasureId: "t1" }],
    ["encounter:combatantsDelta", { encounterId: "e1", action: "upsert", combatantId: "c1" }],
    ["partyInventory:delta", { campaignId: "camp-1", action: "upsert", itemId: "i1" }],
    ["partyCurrency:delta", { campaignId: "camp-1" }],
    ["bastions:delta", { campaignId: "camp-1", action: "upsert", bastionId: "b1" }],
    ["adventures:delta", { campaignId: "camp-1", action: "refresh" }],
    ["encounters:delta", { campaignId: "camp-1", adventureId: "a1", action: "refresh" }],
    ["campaigns:changed", { campaignId: "camp-1" }],
    ["xp:awarded", { campaignId: "camp-1", characterId: "ch1", xpAdded: 10 }],
  ];
  for (const [type, payload] of open) {
    assert.equal(canDeliverEvent(db, PLAYER, type as never, payload as never), true, `${type} reaches a player`);
  }
  db.close();
});
