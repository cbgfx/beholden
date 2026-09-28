import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { zodErrorMiddleware } from "../lib/validate.js";
import type { ServerContext } from "../server/context.js";
import { registerWorkspacePreferences } from "./workspacePreferences.js";

test("workspace preferences are user-scoped and reject stale whole-layout saves", async () => {
  const db = new Database(":memory:"); db.exec(SCHEMA_SQL);
  db.prepare("INSERT INTO users(id,username,passhash,name,created_at,updated_at) VALUES ('u','u','h','User',1,1),('v','v','h','Other',1,1)").run();
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { userId: String(req.headers["x-user"] ?? "u"), username: "test", isAdmin: false }; next(); });
  registerWorkspacePreferences(app, { db } as ServerContext); app.use(zodErrorMiddleware);
  const server = http.createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  const call = (user: string, method: string, body?: unknown) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = http.request({ hostname: "127.0.0.1", port, path: "/api/me/workspaces/campaign", method, headers: { "x-user": user, ...(payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {}) } }, (response) => {
      const chunks: Buffer[] = []; response.on("data", (chunk) => chunks.push(chunk)); response.on("end", () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    }); request.on("error", reject); if (payload) request.write(payload); request.end();
  });
  const layout = { activeId: "default", views: [{ id: "default", name: "Default", columns: [["players"]], colors: {}, appearance: {} }] };
  try {
    const first = await call("u", "PUT", { ...layout, expectedRevision: null }); assert.equal(first.status, 200);
    assert.equal((await call("v", "GET")).body, null);
    const loaded = await call("u", "GET"); assert.equal(loaded.body.activeId, "default");
    const saved = await call("u", "PUT", { ...layout, views: [{ ...layout.views[0], name: "Mine" }], expectedRevision: loaded.body.revision }); assert.equal(saved.status, 200);
    const stale = await call("u", "PUT", { ...layout, expectedRevision: loaded.body.revision }); assert.equal(stale.status, 409); assert.equal(stale.body.code, "stale-workspace");
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); db.close(); }
});
