import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";
import { createServer } from "node:http";
import WebSocket from "ws";
import { createWsServer } from "../../server/ws.js";
import multer from "multer";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { loadSigningSecret, hashPassword, credentialVersion, signToken, verifyToken, currentTokenUser } from "../../lib/jwtAuth.js";
import { requireCurrentAccount } from "../../middleware/auth.js";
import { registerAuthRoutes } from "../../routes/authRoutes.js";
import { registerAdminRoutes } from "../../routes/adminRoutes.js";
import { registerExportImportRoutes } from "../../routes/exportImport/core.js";
import { importCampaignDocument } from "../../routes/exportImport/helpers.js";
import { zodErrorMiddleware } from "../../lib/validate.js";
import type { ServerContext } from "../../server/context.js";

async function fixture() {
  const db = new Database(":memory:"); db.exec(SCHEMA_SQL);
  const passhash = hashPassword("initial-password");
  for (const id of ["admin", "other"]) db.prepare("INSERT INTO users (id, username, name, passhash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, 1)").run(id, id, id, passhash);
  const token = signToken({ userId: "admin", username: "admin", isAdmin: true, credentialVersion: credentialVersion(passhash) });
  const upload = multer({ storage: multer.memoryStorage() });
  const ctx = { db, upload, dbImportUpload: upload, broadcast: () => {}, helpers: { now: Date.now, uid: randomUUID } } as unknown as ServerContext;
  const app = express(); app.use(express.json());
  app.use((req, res, next) => req.path === "/api/auth/login" ? next() : requireCurrentAccount(db)(req, res, next));
  registerAuthRoutes(app, ctx); registerAdminRoutes(app, ctx); registerExportImportRoutes(app, ctx);
  app.use(zodErrorMiddleware);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { db, token, request: (url: string, init: RequestInit = {}, auth = token) => fetch(origin + url, { ...init, headers: { Authorization: `Bearer ${auth}`, ...init.headers } }),
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); db.close(); } };
}
const put = (body: unknown): RequestInit => ({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

it("DM workspace preferences persist per account and workspace and reject invalid colours", async () => {
  const f = await fixture();
  try {
    const preferences = { activeId: "prep", views: [{ id: "prep", name: "Prep", columns: [["players"], ["notes"]], colors: { notes: { accent: "#abcdef" } }, appearance: {} }] };
    const other = signToken({ userId: "other", username: "other", isAdmin: true, credentialVersion: credentialVersion((f.db.prepare("SELECT passhash FROM users WHERE id='other'").get() as { passhash: string }).passhash) });
    assert.equal((await f.request("/api/me/workspaces/campaign", put(preferences))).status, 200);
    assert.deepEqual(await (await f.request("/api/me/workspaces/campaign")).json(), preferences);
    assert.equal(await (await f.request("/api/me/workspaces/combat")).json(), null);
    assert.equal(await (await f.request("/api/me/workspaces/campaign", {}, other)).json(), null);
    assert.equal((await f.request("/api/me/workspaces/campaign", put({ ...preferences, views: [{ ...preferences.views[0], appearance: { accent: "url(example)" } }] }))).status, 400);
    assert.deepEqual(await (await f.request("/api/me/workspaces/campaign")).json(), preferences);
  } finally { await f.close(); }
});

it("installation keys persist, differ across installations, and reject unsafe configuration", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-audit-key-"));
  try {
    const first = loadSigningSecret(path.join(dir, "a"));
    assert.equal(loadSigningSecret(path.join(dir, "a")), first);
    assert.notEqual(loadSigningSecret(path.join(dir, "b")), first);
    assert.throws(() => loadSigningSecret(dir, ""));
    assert.throws(() => loadSigningSecret(dir, "beholden-dev-secret-change-in-prod"));
    assert.equal(loadSigningSecret(dir, "configured-private-key"), "configured-private-key");
    assert.equal(verifyToken(signToken({ userId: "", username: "bad", isAdmin: true })), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const action of ["demote", "delete", "reset"]) it(`protected HTTP routes reject old tokens after ${action}`, async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("/api/admin/users")).status, 200);
    const other = signToken({ userId: "other", username: "other", isAdmin: true, credentialVersion: credentialVersion((f.db.prepare("SELECT passhash FROM users WHERE id='other'").get() as { passhash: string }).passhash) });
    const response = await f.request("/api/admin/users/admin", action === "delete" ? { method: "DELETE" } : put(action === "demote" ? { isAdmin: false } : { password: "replacement" }), other);
    assert.equal(response.status, 200);
    assert.equal((await f.request("/api/admin/users")).status, 401);
  } finally { await f.close(); }
});

it("self-service password changes verify the current password and revoke the previous session", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("/api/me/profile", put({ newPassword: "replacement" }))).status, 401);
    assert.equal((await f.request("/api/me/profile", put({ newPassword: "replacement", currentPassword: "wrong" }))).status, 401);
    assert.equal((await f.request("/api/me/profile", put({ textScale: 1.1 }))).status, 200);
    const response = await f.request("/api/me/profile", put({ newPassword: "replacement", currentPassword: "initial-password" }));
    assert.equal(response.status, 200);
    const updated = await response.json() as { token: string };
    assert.equal((await f.request("/api/admin/users")).status, 401);
    assert.equal((await f.request("/api/admin/users", {}, updated.token)).status, 200);
  } finally { await f.close(); }
});

it("HTTP campaign export/import retains narrative, currency, membership and portable items", async () => {
  const f = await fixture();
  try {
    f.db.prepare("INSERT INTO campaigns (id,name,campaign_story,campaign_notes,party_currency_json,created_at,updated_at) VALUES ('c','Campaign','Story','Private notes',?,1,1)").run(JSON.stringify({ PP: 2, GP: 100, SP: 3, CP: 4 }));
    f.db.prepare("INSERT INTO adventures(id,campaign_id,name,created_at,updated_at) VALUES ('adv','c','Adventure',1,1)").run();
    f.db.prepare("INSERT INTO encounters(id,campaign_id,adventure_id,name,combat_round,combat_active_combatant_id,created_at,updated_at) VALUES ('enc','c','adv','Fight',4,'fighter',1,1)").run();
    f.db.prepare("INSERT INTO players(id,campaign_id,user_id,character_name,live_json,created_at,updated_at) VALUES ('player','c','admin','Hero','{}',1,1)").run();
    f.db.prepare("INSERT INTO bastions(id,campaign_id,name,notes,created_at,updated_at) VALUES ('bastion','c','Keep','Garden',1,1)").run();
    f.db.prepare("INSERT INTO bastion_players VALUES ('bastion','player')").run();
    f.db.prepare("INSERT INTO combatants(id,encounter_id,base_type,base_id,snapshot_json,live_json,created_at,updated_at) VALUES ('fighter','enc','monster','wolf',?, '{}',1,1)").run(JSON.stringify({ name: "Wolf", hpMax: 12, ac: 13 }));
    f.db.prepare("INSERT INTO campaign_membership VALUES ('m','c','admin','dm',1,1)").run();
    f.db.prepare("INSERT INTO party_inventory (id,campaign_id,name,quantity,notes,payload_json,sort,created_at,updated_at) VALUES ('i','c','Wand',1,'Marked',?,0,1,1)").run(JSON.stringify({ charges: 2, chargesMax: 7 }));
    const response = await f.request("/api/campaigns/c/export"); assert.equal(response.status, 200);
    const document = await response.json() as Record<string, unknown>;
    assert.equal(document.version, 2);
    const file = new FormData(); file.append("file", new Blob([JSON.stringify(document)], { type: "application/json" }), "campaign.json");
    assert.equal((await f.request("/api/campaigns/import", { method: "POST", body: file })).status, 200);
    const row = f.db.prepare("SELECT campaign_story,campaign_notes,party_currency_json FROM campaigns WHERE id='c'").get() as Record<string, string>;
    assert.equal(row.campaign_story, "Story"); assert.equal(row.campaign_notes, "Private notes");
    assert.deepEqual(JSON.parse(row.party_currency_json!), { PP: 2, GP: 100, SP: 3, CP: 4 });
    assert.equal((f.db.prepare("SELECT role FROM campaign_membership WHERE id='m'").get() as { role: string }).role, "dm");
    assert.equal(JSON.parse((f.db.prepare("SELECT payload_json FROM party_inventory WHERE id='i'").get() as { payload_json: string }).payload_json).charges, 2);
    assert.equal((f.db.prepare("SELECT combat_round FROM encounters WHERE id='enc'").get() as { combat_round: number }).combat_round, 4);
    assert.equal((f.db.prepare("SELECT COUNT(*) n FROM combatants WHERE encounter_id='enc'").get() as { n: number }).n, 1);
    assert.equal((f.db.prepare("SELECT notes FROM bastions WHERE id='bastion'").get() as { notes: string }).notes, "Garden");
    assert.equal((f.db.prepare("SELECT player_id FROM bastion_players WHERE bastion_id='bastion'").get() as { player_id: string }).player_id, "player");
    // Legacy documents preserve installation-local data absent from the old format.
    importCampaignDocument(f.db, { campaign: { id: "c", name: "Legacy" } }, randomUUID);
    assert.equal((f.db.prepare("SELECT campaign_story FROM campaigns WHERE id='c'").get() as { campaign_story: string }).campaign_story, "Story");
    assert.throws(() => importCampaignDocument(f.db, { campaign: { id: "c", partyCurrency: { GP: -1 } } }, randomUUID));
    assert.equal((f.db.prepare("SELECT name FROM campaigns WHERE id='c'").get() as { name: string }).name, "Legacy");
  } finally { await f.close(); }
});

it("import rolls back when a child ID collides with another campaign", async () => {
  const f = await fixture();
  try {
    f.db.prepare("INSERT INTO campaigns (id,name,created_at,updated_at) VALUES ('a','A',1,1),('b','B',1,1)").run();
    f.db.prepare("INSERT INTO adventures (id,campaign_id,name,created_at,updated_at) VALUES ('collision','b','B adventure',1,1)").run();
    assert.throws(() => importCampaignDocument(f.db, { campaign: { id: "a", name: "Overwrite" }, adventures: [{ id: "collision", name: "Imported" }] }, randomUUID));
    assert.equal((f.db.prepare("SELECT name FROM campaigns WHERE id='a'").get() as { name: string }).name, "A");
    assert.equal((f.db.prepare("SELECT name FROM adventures WHERE id='collision'").get() as { name: string }).name, "B adventure");
  } finally { await f.close(); }
});

it("campaign backups containing private notes require DM access", async () => {
  const f = await fixture();
  try {
    f.db.prepare("INSERT INTO campaigns(id,name,created_at,updated_at) VALUES ('c','Private',1,1)").run();
    f.db.prepare("UPDATE users SET is_admin=0 WHERE id='other'").run();
    f.db.prepare("INSERT INTO campaign_membership VALUES ('m','c','other','player',1,1)").run();
    const hash = (f.db.prepare("SELECT passhash FROM users WHERE id='other'").get() as { passhash: string }).passhash;
    const token = signToken({ userId: "other", username: "other", isAdmin: false, credentialVersion: credentialVersion(hash) });
    assert.equal((await f.request("/api/campaigns/c/export", {}, token)).status, 403);
  } finally { await f.close(); }
});

it("an established WebSocket closes after account revocation", async () => {
  const db = new Database(":memory:"); db.exec(SCHEMA_SQL);
  db.prepare("INSERT INTO users(id,username,name,passhash,is_admin,created_at,updated_at) VALUES ('u','u','u','hash',1,1,1)").run();
  const token = signToken({ userId: "u", username: "u", isAdmin: true, credentialVersion: credentialVersion("hash") });
  const server = createServer();
  const wss = createWsServer({ httpServer: server, authorize: () => currentTokenUser(db, verifyToken(token)) !== null });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const socket = new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`);
  try {
    await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    const closed = new Promise<number>(resolve => socket.once("close", resolve));
    db.prepare("DELETE FROM users WHERE id='u'").run();
    socket.send(JSON.stringify({ type: "ws:scope", payload: {} }));
    assert.equal(await closed, 1008);
  } finally {
    socket.terminate();
    await new Promise<void>(resolve => wss.close(() => resolve()));
    await new Promise<void>(resolve => server.close(() => resolve()));
    db.close();
  }
});
