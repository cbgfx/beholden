/**
 * Shared notes belong to the character; a campaign's player row only carries a copy of them, kept
 * in step by the character's own save. The DM's edit route wrote the copy alone, which meant the
 * player never saw the change - their sheet reads the character - and the next note they saved
 * pushed the character's untouched list back over it.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { zodErrorMiddleware } from "../lib/validate.js";
import { signToken } from "../lib/jwtAuth.js";
import type { ServerContext } from "../server/context.js";
import { registerSharedNotesRoutes } from "./sharedNotes.js";

const DM = { userId: "dm", username: "dm", isAdmin: false };
const PLAYER = { userId: "player", username: "player", isAdmin: false };

const noteList = (...titles: string[]) =>
  JSON.stringify(titles.map((title, index) => ({ id: `n${index + 1}`, title, text: `${title} body` })));

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  for (const user of [DM, PLAYER]) {
    db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES (?, ?, 'h', ?, ?, ?)")
      .run(user.userId, user.username, user.username, t, t);
  }
  // One character, played in two campaigns the same DM runs.
  for (const campaignId of ["camp-1", "camp-2"]) {
    db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(campaignId, campaignId, t, t);
    db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES (?, ?, 'dm', 'dm', ?, ?)")
      .run(`m-${campaignId}`, campaignId, t, t);
  }
  db.prepare(`
    INSERT INTO user_characters (id, user_id, name, character_data_json, shared_notes, created_at, updated_at)
    VALUES ('char-1', 'player', 'Alarion', '{}', ?, ?, ?)
  `).run(noteList("Downtime Days"), t, t);
  for (const [playerId, campaignId] of [["p-1", "camp-1"], ["p-2", "camp-2"]]) {
    db.prepare(`
      INSERT INTO players (id, campaign_id, character_id, player_name, character_name, level, live_json, shared_notes, created_at, updated_at)
      VALUES (?, ?, 'char-1', 'Player', 'Alarion', 1, '{}', ?, ?, ?)
    `).run(playerId, campaignId, noteList("Downtime Days"), t, t);
  }
  return db;
}

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

async function withServer(db: Database.Database, run: (call: (actor: typeof DM) => Call) => Promise<void>) {
  const app = express();
  app.use(express.json());
  // The campaign-scoped routes read req.user, and the character routes want a real bearer token,
  // so the test sets both from the same actor.
  app.use((req, _res, next) => {
    req.user = { ...(String(req.headers["x-test-actor"]) === "player" ? PLAYER : DM) };
    next();
  });
  const ctx = {
    db,
    broadcast: () => {},
    helpers: { now: () => Date.now(), uid: () => "uid" },
    imageUpload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
  } as unknown as ServerContext;
  registerSharedNotesRoutes(app, ctx);
  // The real server turns a rejected body into a 400 the same way.
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
          try { parsed = JSON.parse(text); } catch { /* keep the raw text */ }
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

const sharedNotesOf = (db: Database.Database, table: "players" | "user_characters", id: string) =>
  (db.prepare(`SELECT shared_notes FROM ${table} WHERE id = ?`).get(id) as { shared_notes: string }).shared_notes;

test("the DM's edit reaches the character, not just the campaign's copy of it", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const response = await call(DM)("PUT", "/api/players/p-1/sharedNotes/n2", {
      title: "The reward is a lie",
      text: "The reward is a lie body",
    });
    assert.equal(response.status, 200);

    const edited = noteList("Downtime Days", "The reward is a lie");
    assert.equal(sharedNotesOf(db, "players", "p-1"), edited);
    assert.equal(sharedNotesOf(db, "user_characters", "char-1"), edited, "the character owns the notes");
    assert.equal(sharedNotesOf(db, "players", "p-2"), edited, "every row copying from that character follows");

    // The player's next save starts from what they can see, so it no longer undoes the DM's edit.
    const playerSave = await call(PLAYER)("PUT", "/api/me/characters/char-1/sharedNotes/n3", {
      title: "Ask about the ring",
      text: "Ask about the ring body",
    });
    assert.equal(playerSave.status, 200);
    assert.match(sharedNotesOf(db, "players", "p-1"), /The reward is a lie/);
    assert.match(sharedNotesOf(db, "players", "p-1"), /Ask about the ring/);
  });
  db.close();
});

test("a player can edit a note shared by someone else, but cannot delete its owner's copy", async () => {
  const db = seedDb();
  db.prepare("UPDATE campaigns SET shared_notes = ? WHERE id = 'camp-1'")
    .run(JSON.stringify([{ id: "campaign-note", title: "Plan", text: "Meet at dawn" }]));
  await withServer(db, async (call) => {
    const player = call(PLAYER);
    const edited = await player("PUT", "/api/me/characters/char-1/sharedNotes/campaign-note", {
      title: "Plan",
      text: "Meet at dusk",
    });
    assert.equal(edited.status, 200);
    const campaignNotes = JSON.parse((db.prepare("SELECT shared_notes FROM campaigns WHERE id = 'camp-1'").pluck().get() as string));
    assert.equal(campaignNotes[0].text, "Meet at dusk", "the source note is edited instead of copied onto the character");

    assert.equal((await player("DELETE", "/api/me/characters/char-1/sharedNotes/campaign-note")).status, 200);
    const afterDelete = JSON.parse((db.prepare("SELECT shared_notes FROM campaigns WHERE id = 'camp-1'").pluck().get() as string));
    assert.equal(afterDelete.length, 1, "deletion remains at the ownership boundary");
  });
  db.close();
});

test("a malformed write is refused, and cannot take the list with it", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const before = sharedNotesOf(db, "user_characters", "char-1");

    for (const [actor, path] of [[DM, "/api/players/p-1/sharedNotes"], [PLAYER, "/api/me/characters/char-1/sharedNotes"]] as const) {
      assert.equal((await call(actor)("PUT", `${path}/n2`, { title: 5 })).status, 400, `${path} with a number for a title`);
      assert.equal((await call(actor)("PUT", `${path}/n2`, { text: { body: "x" } })).status, 400, `${path} with an object for text`);
      assert.equal((await call(actor)("POST", `${path}/reorder`, { ids: "n1" })).status, 400, `${path} with ids that are not a list`);
    }

    assert.equal(sharedNotesOf(db, "user_characters", "char-1"), before, "nothing was written");
    assert.equal(sharedNotesOf(db, "players", "p-1"), before);
  });
  db.close();
});

test("a row holding unreadable notes is repaired by the next write, not compounded", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    // Whatever put this here (an older client, a hand edit), every reader treats it as no notes.
    db.prepare("UPDATE user_characters SET shared_notes = '{oops' WHERE id = 'char-1'").run();

    const response = await call(PLAYER)("PUT", "/api/me/characters/char-1/sharedNotes/n1", {
      title: "Starting again",
      text: "x",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(sharedNotesOf(db, "user_characters", "char-1")), [
      { id: "n1", title: "Starting again", text: "x" },
    ]);
  });
  db.close();
});

test("two people editing at once no longer overwrite each other", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const dm = call(DM);
    const player = call(PLAYER);

    // Both read the same list, then each changes a different note - the DM through the campaign's
    // player row, the player through their character. Under the old whole-list save, whichever
    // request landed second would have thrown the other one away.
    await dm("PUT", "/api/players/p-1/sharedNotes/n1", { title: "Downtime Days", text: "DM: 4 days left" });
    await player("PUT", "/api/me/characters/char-1/sharedNotes/n2", { title: "Ask about the ring", text: "At the tavern" });

    const stored = JSON.parse(sharedNotesOf(db, "user_characters", "char-1"));
    assert.deepEqual(stored.map((note: any) => note.id), ["n1", "n2"], "both notes are there");
    assert.equal(stored[0].text, "DM: 4 days left", "the DM's edit survived");
    assert.equal(stored[1].text, "At the tavern", "and so did the player's");
    assert.equal(sharedNotesOf(db, "players", "p-2"), sharedNotesOf(db, "user_characters", "char-1"), "copies stay in step");
  });
  db.close();
});

test("one operation only changes the note it names", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const player = call(PLAYER);
    await player("PUT", "/api/me/characters/char-1/sharedNotes/n2", { title: "Second", text: "b" });
    await player("PUT", "/api/me/characters/char-1/sharedNotes/n3", { title: "Third", text: "c" });

    // Deleting the middle note leaves the others untouched and in order.
    assert.equal((await player("DELETE", "/api/me/characters/char-1/sharedNotes/n2")).status, 200);
    const afterDelete = JSON.parse(sharedNotesOf(db, "user_characters", "char-1"));
    assert.deepEqual(afterDelete.map((note: any) => note.id), ["n1", "n3"]);

    // Deleting something already gone is not an error; the list is simply as asked.
    assert.equal((await player("DELETE", "/api/me/characters/char-1/sharedNotes/n2")).status, 200);
    assert.equal(JSON.parse(sharedNotesOf(db, "user_characters", "char-1")).length, 2);
  });
  db.close();
});

test("a reorder from a stale list cannot drop the note it never saw", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const player = call(PLAYER);
    await player("PUT", "/api/me/characters/char-1/sharedNotes/n2", { title: "Second", text: "b" });

    // Meanwhile the DM adds one the reordering client has never heard of.
    await call(DM)("PUT", "/api/players/p-1/sharedNotes/n9", { title: "From the DM", text: "z" });

    // The client reorders the two it knows about; the unnamed note keeps its place at the end.
    assert.equal((await player("POST", "/api/me/characters/char-1/sharedNotes/reorder", { ids: ["n2", "n1"] })).status, 200);
    const stored = JSON.parse(sharedNotesOf(db, "user_characters", "char-1"));
    assert.deepEqual(stored.map((note: any) => note.id), ["n2", "n1", "n9"]);
  });
  db.close();
});

test("a player cannot reach another campaign's notes through these routes", async () => {
  const db = seedDb();
  await withServer(db, async (call) => {
    const player = call(PLAYER);
    // The player row belongs to the DM's side of the fence.
    assert.equal((await player("PUT", "/api/players/p-1/sharedNotes/n1", { title: "x", text: "y" })).status, 403);
    assert.equal((await player("DELETE", "/api/players/p-1/sharedNotes/n1")).status, 403);
    // And a character that is not theirs is not found.
    assert.equal((await player("PUT", "/api/me/characters/someone-else/sharedNotes/n1", { title: "x", text: "y" })).status, 404);
  });
  db.close();
});
