import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import express from "express";
import { registerHealthRoutes } from "./health.js";
import { registerMetaRoutes } from "./meta.js";
import type { ServerContext } from "../server/context.js";

async function requestRoutes(ctx: ServerContext, path: string) {
  const app = express();
  registerHealthRoutes(app, ctx);
  registerMetaRoutes(app, ctx);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as net.AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    return { response, body: await response.json() as Record<string, unknown> };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const context = (get: () => unknown): ServerContext => ({
  db: { prepare: () => ({ get }) },
  helpers: { now: () => 123 },
  runtime: { host: "0.0.0.0", port: 5174 },
  paths: { dataDir: "C:/secret/data" },
  os: { networkInterfaces: () => ({ lan: [{ family: "IPv4", internal: false, address: "192.168.1.2" }] }) },
} as unknown as ServerContext);

test("health is uncached and reports database readiness", async () => {
  const ready = await requestRoutes(context(() => ({ ok: 1 })), "/api/health");
  assert.equal(ready.response.status, 200);
  assert.equal(ready.response.headers.get("cache-control"), "no-store");
  assert.deepEqual(ready.body, { ok: true, database: "ready", time: 123 });

  const unavailable = await requestRoutes(context(() => { throw new Error("closed"); }), "/api/health");
  assert.equal(unavailable.response.status, 503);
  assert.deepEqual(unavailable.body, { ok: false, database: "unavailable", time: 123 });
});

test("meta does not expose the absolute server data directory", async () => {
  const { body } = await requestRoutes(context(() => undefined), "/api/meta");
  assert.equal(Object.hasOwn(body, "dataDir"), false);
  assert.deepEqual(body.ips, ["192.168.1.2"]);
});
