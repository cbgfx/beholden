/**
 * Admin and database tools, through their real routes.
 *
 * - Deleting a user deleted their characters by cascade only, so every campaign kept a nameless
 *   player, still standing in its encounters, and their portraits stayed on disk. It now goes
 *   through the same teardown as a player deleting their own character.
 * - A refused database import had already restored the images bundled with it.
 * - A membership could be changed or removed through another campaign's URL.
 * - Removing a member left their player in the campaign; it now leaves with them.
 * - "Clear compendium" names its tables by hand; it is held to the schema here.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { zipSync } from "fflate";
import { openDb } from "../lib/db.js";
import { createDatabaseUpload } from "../lib/upload.js";
import { zodErrorMiddleware } from "../lib/validate.js";
import type { ServerContext } from "../server/context.js";
import { registerAdminRoutes } from "./adminRoutes.js";
import { COMPENDIUM_TABLES, registerCompendiumAdminRoutes } from "./compendium/admin.js";

type Call = (method: string, urlPath: string, options?: { as?: "admin" | "player"; body?: unknown; multipart?: { name: string; filename: string; bytes: Uint8Array } }) => Promise<{ status: number; body: any; bytes: Buffer }>;
type Harness = { call: Call; db: ServerContext["db"]; dataDir: string; events: Array<{ type: string; payload: any }> };

async function withAdminServer(run: (harness: Harness) => Promise<void>) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-admin-test-"));
  const db = openDb(":memory:");
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('admin-1', 'admin', 'x', 'Admin', 1, ?, ?)").run(t, t);
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('user-1', 'rin', 'x', 'Rin', 0, ?, ?)").run(t, t);

  const events: Harness["events"] = [];
  const ctx = {
    db, fs, path, os,
    paths: { dataDir },
    broadcast: (type: string, payload: unknown) => { events.push({ type, payload }); },
    dbImportUpload: createDatabaseUpload(dataDir),
    compendiumUpload: createDatabaseUpload(dataDir),
    helpers: { now: () => Date.now(), uid: () => crypto.randomUUID() },
  } as unknown as ServerContext;

  const app = express();
  app.use(express.json());
  // The real server resolves the account first; here a header names it.
  app.use((req, _res, next) => {
    const actor = req.headers["x-test-actor"];
    if (actor === "admin") req.user = { userId: "admin-1", username: "admin", name: "Admin", isAdmin: true } as never;
    if (actor === "player") req.user = { userId: "user-1", username: "rin", name: "Rin", isAdmin: false } as never;
    next();
  });
  registerAdminRoutes(app, ctx);
  registerCompendiumAdminRoutes(app, ctx);
  app.use(zodErrorMiddleware);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;

  const call: Call = (method, urlPath, options = {}) => new Promise((resolve, reject) => {
    let payload: Buffer | null = null;
    const headers: Record<string, string> = options.as ? { "x-test-actor": options.as } : {};
    if (options.multipart) {
      const boundary = `----beholden${crypto.randomUUID()}`;
      payload = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${options.multipart.name}"; filename="${options.multipart.filename}"\r\nContent-Type: application/zip\r\n\r\n`),
        Buffer.from(options.multipart.bytes),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      headers["content-type"] = `multipart/form-data; boundary=${boundary}`;
    } else if (options.body !== undefined) {
      payload = Buffer.from(JSON.stringify(options.body));
      headers["content-type"] = "application/json";
    }
    if (payload) headers["content-length"] = String(payload.length);
    const request = http.request({ hostname: "127.0.0.1", port, path: urlPath, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () => {
        const bytes = Buffer.concat(chunks);
        const text = bytes.toString("utf8");
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { /* keep the text */ }
        resolve({ status: res.statusCode ?? 0, body: parsed, bytes });
      });
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });

  try {
    await run({ call, db, dataDir, events });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

/** Rin plays Ash in one campaign; Ash is standing in an encounter there. */
function seedRinsCharacter(db: ServerContext["db"], dataDir: string) {
  const t = Date.now();
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-1', 'Camp', ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv-1', 'camp-1', 'One', 1, ?, ?)").run(t, t);
  db.prepare("INSERT INTO encounters (id, campaign_id, adventure_id, name, sort, created_at, updated_at) VALUES ('enc-1', 'camp-1', 'adv-1', 'Fight', 1, ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('mem-1', 'camp-1', 'user-1', 'player', ?, ?)").run(t, t);
  db.prepare("INSERT INTO user_characters (id, user_id, name, created_at, updated_at) VALUES ('char-ash', 'user-1', 'Ash', ?, ?)").run(t, t);
  db.prepare(`INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, live_json, created_at, updated_at)
    VALUES ('p-ash', 'camp-1', 'user-1', 'char-ash', 'Rin', 'Ash', '{}', ?, ?)`).run(t, t);
  db.prepare(`INSERT INTO combatants (id, encounter_id, base_type, base_id, snapshot_json, live_json, sort, created_at, updated_at)
    VALUES ('c-ash', 'enc-1', 'player', 'p-ash', '{"name":"Ash"}', '{"initiative":12}', 1, ?, ?)`).run(t, t);
  for (const [dir, id] of [["character-images", "char-ash"], ["player-images", "p-ash"]] as const) {
    fs.mkdirSync(path.join(dataDir, dir), { recursive: true });
    fs.writeFileSync(path.join(dataDir, dir, `${id}.webp`), "portrait");
  }
}

const count = (db: ServerContext["db"], sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;

test("deleting a user takes their characters out of every roster and fight, portraits included", async () => {
  await withAdminServer(async ({ call, db, dataDir, events }) => {
    seedRinsCharacter(db, dataDir);

    const deleted = await call("DELETE", "/api/admin/users/user-1", { as: "admin" });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));

    assert.equal(count(db, "SELECT COUNT(*) AS n FROM users WHERE id = 'user-1'"), 0);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM user_characters WHERE id = 'char-ash'"), 0);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM players"), 0, "no nameless player left in the roster");
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM combatants"), 0, "no one left standing in the fight");
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM campaign_membership"), 0);
    assert.equal(fs.existsSync(path.join(dataDir, "character-images", "char-ash.webp")), false);
    assert.equal(fs.existsSync(path.join(dataDir, "player-images", "p-ash.webp")), false);
    assert.ok(events.some((event) => event.type === "players:delta" && event.payload.action === "delete" && event.payload.playerId === "p-ash"),
      "the DM's roster is told");
  });
});

test("the last admin cannot be deleted or demoted, and says so", async () => {
  await withAdminServer(async ({ call }) => {
    const deleted = await call("DELETE", "/api/admin/users/admin-1", { as: "admin" });
    assert.equal(deleted.status, 409);
    assert.match(deleted.body.message, /last admin/i);
    const demoted = await call("PUT", "/api/admin/users/admin-1", { as: "admin", body: { isAdmin: false } });
    assert.equal(demoted.status, 409);
  });
});

test("a membership is changed only through its own campaign", async () => {
  await withAdminServer(async ({ call, db, dataDir }) => {
    seedRinsCharacter(db, dataDir);
    const t = Date.now();
    db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-2', 'Other', ?, ?)").run(t, t);

    assert.equal((await call("PUT", "/api/admin/campaigns/camp-2/members/mem-1", { as: "admin", body: { role: "dm" } })).status, 404);
    assert.equal((await call("DELETE", "/api/admin/campaigns/camp-2/members/mem-1", { as: "admin" })).status, 404);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM campaign_membership WHERE id = 'mem-1' AND role = 'player'"), 1);

    assert.equal((await call("PUT", "/api/admin/campaigns/camp-1/members/mem-1", { as: "admin", body: { role: "dm" } })).status, 200);
    assert.equal((await call("DELETE", "/api/admin/campaigns/camp-1/members/mem-1", { as: "admin" })).status, 200);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM campaign_membership"), 0);
  });
});

test("removing a member takes their player out of the campaign, and keeps their character", async () => {
  await withAdminServer(async ({ call, db, dataDir, events }) => {
    seedRinsCharacter(db, dataDir);

    assert.equal((await call("DELETE", "/api/admin/campaigns/camp-1/members/mem-1", { as: "admin" })).status, 200);

    assert.equal(count(db, "SELECT COUNT(*) AS n FROM campaign_membership"), 0);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM players"), 0, "off the roster");
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM combatants"), 0, "out of the fight");
    assert.equal(fs.existsSync(path.join(dataDir, "player-images", "p-ash.webp")), false);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM user_characters WHERE id = 'char-ash'"), 1, "the character stays theirs");
    assert.equal(fs.existsSync(path.join(dataDir, "character-images", "char-ash.webp")), true);
    assert.ok(events.some((event) => event.type === "players:delta" && event.payload.action === "delete" && event.payload.playerId === "p-ash"));
  });
});

test("a refused database import leaves the images on disk untouched", async () => {
  await withAdminServer(async ({ call, dataDir }) => {
    fs.mkdirSync(path.join(dataDir, "campaign-images"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "campaign-images", "banner.webp"), "current banner");

    const zip = zipSync({
      "beholden.db": new TextEncoder().encode("this is not a sqlite database"),
      "campaign-images/banner.webp": new TextEncoder().encode("banner from the upload"),
      "campaign-images/new.webp": new TextEncoder().encode("new image"),
    });
    const imported = await call("POST", "/api/admin/database/import", { as: "admin", multipart: { name: "file", filename: "backup.zip", bytes: zip } });
    assert.equal(imported.status, 400, JSON.stringify(imported.body));

    assert.equal(fs.readFileSync(path.join(dataDir, "campaign-images", "banner.webp"), "utf8"), "current banner");
    assert.equal(fs.existsSync(path.join(dataDir, "campaign-images", "new.webp")), false);
  });
});

test("clearing the compendium empties every compendium table in the schema", async () => {
  await withAdminServer(async ({ call, db }) => {
    const inSchema = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'compendium\\_%' ESCAPE '\\'").all() as Array<{ name: string }>)
      .map((row) => row.name).sort();
    assert.deepEqual([...COMPENDIUM_TABLES].sort(), inSchema);
    assert.equal((await call("DELETE", "/api/compendium", { as: "admin" })).status, 200);
  });
});

test("every admin tool refuses a non-admin", async () => {
  await withAdminServer(async ({ call, db }) => {
    const attempts: Array<[string, string, unknown?]> = [
      ["GET", "/api/admin/users"],
      ["GET", "/api/admin/auth-audit"],
      ["POST", "/api/admin/users", { username: "sneaky", password: "pass", name: "Sneaky", isAdmin: true }],
      ["PUT", "/api/admin/users/user-1", { isAdmin: true }],
      ["DELETE", "/api/admin/users/admin-1"],
      ["GET", "/api/admin/database/export"],
      ["POST", "/api/admin/database/import"],
      ["GET", "/api/admin/campaigns/camp-1/members"],
      ["POST", "/api/admin/campaigns/camp-1/members", { userId: "user-1", role: "dm" }],
      ["DELETE", "/api/compendium"],
      ["POST", "/api/compendium/srd/generate"],
    ];
    for (const [method, urlPath, body] of attempts) {
      const response = await call(method, urlPath, { as: "player", body });
      assert.equal(response.status, 403, `${method} ${urlPath} answered ${response.status}`);
      // No account at all is refused too (the live server answers 401 before any route runs).
      assert.ok([401, 403].includes((await call(method, urlPath, { body })).status), `${method} ${urlPath} without an account`);
    }
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM users WHERE is_admin = 1"), 1);
    assert.equal(count(db, "SELECT COUNT(*) AS n FROM users"), 2);
  });
});

test("an export restores exactly: rows and images come back after both were changed", async () => {
  await withAdminServer(async ({ call, db, dataDir, events }) => {
    seedRinsCharacter(db, dataDir);

    const exported = await call("GET", "/api/admin/database/export", { as: "admin" });
    assert.equal(exported.status, 200);
    const zipBytes = exported.bytes;
    // Change everything after the export: rename the character, drop a portrait.
    db.prepare("UPDATE user_characters SET name = 'Renamed' WHERE id = 'char-ash'").run();
    fs.rmSync(path.join(dataDir, "character-images", "char-ash.webp"));

    const imported = await call("POST", "/api/admin/database/import", { as: "admin", multipart: { name: "file", filename: "backup.zip", bytes: zipBytes } });
    assert.equal(imported.status, 200, JSON.stringify(imported.body));
    assert.equal((db.prepare("SELECT name FROM user_characters WHERE id = 'char-ash'").get() as { name: string }).name, "Ash");
    assert.equal(fs.readFileSync(path.join(dataDir, "character-images", "char-ash.webp"), "utf8"), "portrait");
    assert.ok(fs.existsSync(imported.body.backupPath), "the pre-import backup was written");
    assert.ok(events.some((event) => event.type === "database:imported"));
  });
});
