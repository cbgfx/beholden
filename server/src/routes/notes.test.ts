/**
 * Campaign and adventure notes are the DM's own: the plot, the villain's real plan, what the party
 * has not worked out yet. Both player apps show shared notes instead and have never fetched these,
 * but every read route used to accept any member of the campaign - so a player could read the DM's
 * notes straight from the API, and the WebSocket pushed each edit to them as it was typed.
 *
 * These tests pin the whole surface: who may read, who may write, and that a note stays inside the
 * campaign and adventure it belongs to.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { zodErrorMiddleware } from "../lib/validate.js";
import { displayNoteTitle } from "../lib/dbConverters.js";
import type { ServerContext } from "../server/context.js";
import { registerNoteRoutes } from "./notes.js";
import { registerReorderRoutes } from "./reorder.js";

type Actor = { userId: string; username: string; isAdmin: boolean };

const DM: Actor = { userId: "dm", username: "dm", isAdmin: false };
const PLAYER: Actor = { userId: "player", username: "player", isAdmin: false };
const OUTSIDER: Actor = { userId: "outsider", username: "outsider", isAdmin: false };
const ADMIN: Actor = { userId: "admin", username: "admin", isAdmin: true };

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  db.function("note_display_title", { deterministic: true }, displayNoteTitle);
  const t = Date.now();

  for (const actor of [DM, PLAYER, OUTSIDER, ADMIN]) {
    db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES (?, ?, 'h', ?, ?, ?)")
      .run(actor.userId, actor.username, actor.username, t, t);
  }
  for (const [id, name] of [["camp-1", "Ours"], ["camp-2", "Someone else's"]]) {
    db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, name, t, t);
  }
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m1', 'camp-1', 'dm', 'dm', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m2', 'camp-1', 'player', 'player', ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m3', 'camp-2', 'outsider', 'dm', ?, ?)").run(t, t);

  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv-1', 'camp-1', 'Chapter One', 1, ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv-2', 'camp-2', 'Elsewhere', 1, ?, ?)").run(t, t);
  return db;
}

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

/**
 * Notes go out in one shape, nested as `scope` / `content` / `meta`. The list view sends the same
 * thing with the text left out; it used to send a flat object of its own, so the same note arrived
 * differently depending on which endpoint you asked. These helpers read the wire shape as sent.
 */
const titleOf = (dto: any): string => dto?.content?.title;
const textOf = (dto: any): string => dto?.content?.text;

async function withNoteServer(db: Database.Database, run: (call: (actor: Actor) => Call) => Promise<void>) {
  let counter = 0;
  const app = express();
  // The real server allows a 2MB body, so the size a note may be is decided by the route, not
  // by body-parser's much smaller default.
  app.use(express.json({ limit: "2mb" }));
  // The acting user is swapped per request by the header the helper below sets.
  app.use((req, _res, next) => {
    const actorId = String(req.headers["x-test-actor"] ?? "dm");
    const actor = [DM, PLAYER, OUTSIDER, ADMIN].find((entry) => entry.userId === actorId) ?? DM;
    req.user = { ...actor };
    next();
  });
  const ctx = {
    db,
    broadcast: () => {},
    helpers: { now: () => Date.now(), uid: () => `note-${++counter}` },
  } as unknown as ServerContext;
  registerNoteRoutes(app, ctx);
  registerReorderRoutes(app, ctx);
  // The real server turns a rejected body into a 400 the same way.
  app.use(zodErrorMiddleware);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;

  const call = (actor: Actor): Call => (method, path, body) => new Promise((resolve, reject) => {
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

test("a note goes through its whole life for the DM", async () => {
  const db = seedDb();
  await withNoteServer(db, async (call) => {
    const dm = call(DM);

    const created = await dm("POST", "/api/campaigns/camp-1/notes", { title: "The cult", text: "They meet at midnight." });
    assert.equal(created.status, 200);
    assert.equal(titleOf(created.body), "The cult");
    assert.equal(created.body.scope.campaignId, "camp-1");
    assert.equal(created.body.scope.adventureId, null);

    const read = await dm("GET", `/api/notes/${created.body.id}`);
    assert.equal(textOf(read.body), "They meet at midnight.");

    const updated = await dm("PUT", `/api/notes/${created.body.id}`, { title: "The cult", text: "Midnight, under the docks." });
    assert.equal(textOf(updated.body), "Midnight, under the docks.");

    const list = await dm("GET", "/api/campaigns/camp-1/notes");
    assert.equal(list.body.length, 1);

    // The compact view is what the panel lists: the same shape, with the body left out.
    const compact = await dm("GET", "/api/campaigns/camp-1/notes?view=list");
    assert.equal(titleOf(compact.body[0]), "The cult");
    assert.equal(textOf(compact.body[0]), "");
    assert.equal(compact.body[0].scope.campaignId, "camp-1");
    assert.equal(compact.body[0].scope.adventureId, null);
    assert.equal(typeof compact.body[0].meta.sort, "number");

    assert.equal((await dm("DELETE", `/api/notes/${created.body.id}`)).status, 200);
    assert.equal((await dm("GET", "/api/campaigns/camp-1/notes")).body.length, 0);
    // A note that is gone cannot be traced back to a campaign, so the guard refuses before the
    // route runs: an unknown id reads as 403 to a DM, not 404. It fails closed, which is the right
    // way round - it just means "not found" is only ever seen by an admin.
    assert.equal((await dm("GET", `/api/notes/${created.body.id}`)).status, 403);
    assert.equal((await call(ADMIN)("GET", `/api/notes/${created.body.id}`)).status, 404);
  });
  db.close();
});

test("an adventure note belongs to that adventure's campaign", async () => {
  const db = seedDb();
  await withNoteServer(db, async (call) => {
    const dm = call(DM);
    const created = await dm("POST", "/api/adventures/adv-1/notes", { title: "Room 4", text: "Trapped chest." });
    assert.equal(created.status, 200);
    assert.equal(created.body.scope.campaignId, "camp-1");
    assert.equal(created.body.scope.adventureId, "adv-1");

    // It is an adventure note, so it stays out of the campaign-level list.
    assert.equal((await dm("GET", "/api/campaigns/camp-1/notes")).body.length, 0);
    assert.equal((await dm("GET", "/api/adventures/adv-1/notes")).body.length, 1);

    assert.equal((await dm("POST", "/api/adventures/no-such-adventure/notes", { text: "x" })).status, 403);
  });
  db.close();
});

test("the DM's notes are not readable by their players", async () => {
  const db = seedDb();
  await withNoteServer(db, async (call) => {
    const note = await call(DM)("POST", "/api/campaigns/camp-1/notes", { title: "Secret", text: "The mayor is the villain." });
    await call(DM)("POST", "/api/adventures/adv-1/notes", { title: "Room 4", text: "Trapped chest." });

    for (const [label, actor] of [["a player in the campaign", PLAYER], ["a DM of another campaign", OUTSIDER]] as const) {
      const as = call(actor);
      for (const path of ["/api/campaigns/camp-1/notes", "/api/campaigns/camp-1/notes?view=list", "/api/adventures/adv-1/notes", `/api/notes/${note.body.id}`]) {
        assert.equal((await as("GET", path)).status, 403, `${label} must not read ${path}`);
      }
      assert.equal((await as("POST", "/api/campaigns/camp-1/notes", { text: "mine now" })).status, 403, label);
      assert.equal((await as("PUT", `/api/notes/${note.body.id}`, { text: "edited" })).status, 403, label);
      assert.equal((await as("DELETE", `/api/notes/${note.body.id}`)).status, 403, label);
      assert.equal((await as("POST", "/api/campaigns/camp-1/notes/reorder", { ids: [note.body.id] })).status, 403, label);
    }

    // The note survived every attempt above.
    assert.equal(textOf((await call(DM)("GET", `/api/notes/${note.body.id}`)).body), "The mayor is the villain.");
    // An admin still sees everything.
    assert.equal((await call(ADMIN)("GET", "/api/campaigns/camp-1/notes")).status, 200);
  });
  db.close();
});

test("reordering only touches notes in the scope it was asked about", async () => {
  const db = seedDb();
  await withNoteServer(db, async (call) => {
    const dm = call(DM);
    const first = (await dm("POST", "/api/campaigns/camp-1/notes", { title: "First", text: "a" })).body;
    const second = (await dm("POST", "/api/campaigns/camp-1/notes", { title: "Second", text: "b" })).body;
    const adventureNote = (await dm("POST", "/api/adventures/adv-1/notes", { title: "Adventure", text: "c" })).body;
    const foreign = (await call(OUTSIDER)("POST", "/api/campaigns/camp-2/notes", { title: "Theirs", text: "d" })).body;

    const rejected = await dm("POST", "/api/campaigns/camp-1/notes/reorder", {
      ids: [second.id, first.id, adventureNote.id, foreign.id],
    });
    assert.equal(rejected.status, 400, "foreign and out-of-scope IDs make the reorder stale");

    const reorder = await dm("POST", "/api/campaigns/camp-1/notes/reorder", {
      ids: [second.id, first.id],
    });
    assert.equal(reorder.status, 200);

    const listed = (await dm("GET", "/api/campaigns/camp-1/notes")).body.map(titleOf);
    assert.deepEqual(listed, ["Second", "First"]);

    // The adventure note and the other campaign's note kept the sort they were given on creation.
    const sortOf = (id: string) => (db.prepare("SELECT sort FROM notes WHERE id = ?").get(id) as { sort: number }).sort;
    assert.equal(sortOf(adventureNote.id), 1, "an adventure note is not reordered by the campaign list");
    assert.equal(sortOf(foreign.id), 1, "another campaign's notes are never touched");
  });
  db.close();
});

test("a note with no title of its own is listed by its first line", async () => {
  const db = seedDb();
  await withNoteServer(db, async (call) => {
    const dm = call(DM);
    // "Note" is what the editor sends for an untitled note; the display title then follows the text.
    const created = await dm("POST", "/api/campaigns/camp-1/notes", { title: "Note", text: "Ambush at the ford\nThree bandits." });
    assert.equal(titleOf(created.body), "Ambush at the ford");
    assert.equal(created.body.content.titleIsDerived, true, "so an editor knows not to write it back");
    assert.equal(titleOf((await dm("GET", "/api/campaigns/camp-1/notes?view=list")).body[0]), "Ambush at the ford");

    // Editing only the text leaves the note untitled, so its listed title follows the new first line.
    await dm("PUT", `/api/notes/${created.body.id}`, { text: "Ambush at the bridge\nThree bandits." });
    const afterTextEdit = await dm("GET", `/api/notes/${created.body.id}`);
    assert.equal(titleOf(afterTextEdit.body), "Ambush at the bridge");
    assert.equal(afterTextEdit.body.content.titleIsDerived, true);

    // Giving it a title of its own stops it following the text.
    await dm("PUT", `/api/notes/${created.body.id}`, { title: "The ford" });
    const afterTitle = await dm("GET", `/api/notes/${created.body.id}`);
    assert.equal(titleOf(afterTitle.body), "The ford");
    assert.equal(afterTitle.body.content.titleIsDerived, false);
  });
  db.close();
});

test("a note has a size, and something too big is refused rather than stored", async () => {
  const db = seedDb();
  await withNoteServer(db, async (call) => {
    const dm = call(DM);

    const tooMuchText = await dm("POST", "/api/campaigns/camp-1/notes", { title: "Big", text: "x".repeat(200_001) });
    assert.equal(tooMuchText.status, 400);
    assert.match(JSON.stringify(tooMuchText.body), /title|text/i, "the message says which field");

    const tooLongTitle = await dm("POST", "/api/campaigns/camp-1/notes", { title: "t".repeat(501), text: "x" });
    assert.equal(tooLongTitle.status, 400);

    // Nothing was written by either attempt.
    assert.equal((await dm("GET", "/api/campaigns/camp-1/notes")).body.length, 0);

    // A long note is still a perfectly ordinary note.
    const accepted = await dm("POST", "/api/campaigns/camp-1/notes", { title: "Big", text: "x".repeat(100_000) });
    assert.equal(accepted.status, 200);

    // The same limits apply to an edit, and a refused edit leaves the note as it was.
    const refusedEdit = await dm("PUT", `/api/notes/${accepted.body.id}`, { text: "y".repeat(200_001) });
    assert.equal(refusedEdit.status, 400);
    assert.equal(textOf((await dm("GET", `/api/notes/${accepted.body.id}`)).body).length, 100_000);
  });
  db.close();
});
