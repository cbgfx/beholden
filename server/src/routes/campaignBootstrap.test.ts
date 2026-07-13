import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import type { ServerContext } from "../server/context.js";
import { registerCampaignBootstrapRoute } from "./campaignBootstrap.js";
import { displayNoteTitle } from "../lib/dbConverters.js";

test("campaign bootstrap enforces access and returns its stable collection shape", async (t) => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.function("note_display_title", { deterministic: true }, displayNoteTitle);
  const now = Date.now();
  db.prepare(`
    INSERT INTO campaigns (id, name, color, image_url, shared_notes, created_at, updated_at)
    VALUES ('campaign-1', 'Test', NULL, NULL, '', ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO notes (id, campaign_id, adventure_id, title, text, sort, created_at, updated_at)
    VALUES ('note-1', 'campaign-1', NULL, 'Note', '\n# Inferred title\nBody', 1, ?, ?)
  `).run(now, now);
  t.after(() => db.close());

  const app = express();
  app.use((req, _res, next) => {
    req.user = req.header("x-test-user") === "admin"
      ? { userId: "admin", username: "admin", isAdmin: true }
      : { userId: "outsider", username: "outsider", isAdmin: false };
    next();
  });
  registerCampaignBootstrapRoute(app, { db } as unknown as ServerContext);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api/campaigns/campaign-1/bootstrap`;

  const forbidden = await fetch(url, { headers: { "x-test-user": "outsider" } });
  assert.equal(forbidden.status, 403);

  const allowed = await fetch(url, { headers: { "x-test-user": "admin" } });
  assert.equal(allowed.status, 200);
  const body = await allowed.json() as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["adventures", "inpcs", "notes", "players", "treasure"]);
  for (const value of Object.values(body)) assert(Array.isArray(value));
  assert.equal((body.notes as Array<{ title: string }>)[0]?.title, "Inferred title");

  const missing = await fetch(url.replace("campaign-1", "missing"), { headers: { "x-test-user": "admin" } });
  assert.equal(missing.status, 404);
});
