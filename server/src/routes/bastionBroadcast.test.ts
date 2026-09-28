/**
 * Bastion writes must attribute their broadcast to the client that made them.
 *
 * Every socket receives `bastions:delta`, the author's included. The author uses `originClientId`
 * to skip its own echo -- without it, each save came back as a "reload everything" instruction
 * and the editor flickered on every keystroke. These tests pin the server half of that contract.
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

type Broadcast = { type: string; payload: Record<string, unknown> };

async function withServer(
  run: (args: {
    request: (method: string, path: string, body?: unknown) => Promise<{ status: number; body: unknown }>;
    broadcasts: Broadcast[];
    db: Database.Database;
  }) => Promise<void>,
) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  const now = Date.now();
  db.prepare(`
    INSERT INTO campaigns (id, name, color, image_url, shared_notes, created_at, updated_at)
    VALUES ('camp-1', 'Test', NULL, NULL, '', ?, ?)
  `).run(now, now);

  // Creating a bastion refuses an empty catalogue, so seed enough of one to get past that guard.
  // The broadcast contract is what's under test, not facility rules.
  db.prepare(`
    INSERT INTO compendium_bastion_facilities
      (id, ruleset, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description, data_json)
    VALUES ('bf_bedroom', '5.5e', 'Bedroom', 'bedroom', 'basic', 0, NULL, '[]', NULL, 0, 0, 'A bedroom.', '{}')
  `).run();

  const broadcasts: Broadcast[] = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: "dm-1", username: "dm", isAdmin: true };
    next();
  });
  registerBastionRoutes(app, {
    db,
    broadcast: (type: string, payload: Record<string, unknown>) => { broadcasts.push({ type, payload }); },
    helpers: { now: () => Date.now(), uid: () => `id-${broadcasts.length}-${Math.random().toString(36).slice(2, 8)}` },
  } as unknown as ServerContext);

  // Same middleware createServer installs, so a schema rejection surfaces as the 400 the real API
  // returns rather than an unhandled error page.
  app.use(zodErrorMiddleware);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;

  const request = (method: string, path: string, body?: unknown) =>
    new Promise<{ status: number; body: unknown }>((resolve, reject) => {
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
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null }));
        },
      );
      req.on("error", reject);
      req.end(payload);
    });

  try {
    await run({ request, broadcasts, db });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    db.close();
  }
}

async function createBastion(
  request: (method: string, path: string, body?: unknown) => Promise<{ status: number; body: unknown }>,
  body: Record<string, unknown> = {},
) {
  const created = await request("POST", "/api/campaigns/camp-1/bastions", {
    name: "Keep",
    assignedPlayerIds: [],
    facilities: [],
    ...body,
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  return String((created.body as { id: string }).id);
}

test("create attributes its broadcast to the calling client", async () => {
  await withServer(async ({ request, broadcasts }) => {
    await createBastion(request, { clientId: "tab-a" });
    const delta = broadcasts.find((entry) => entry.type === "bastions:delta");
    assert.ok(delta, "expected a bastions:delta broadcast");
    assert.equal(delta.payload.action, "upsert");
    assert.equal(delta.payload.originClientId, "tab-a");
  });
});

test("an operation attributes its broadcast to the calling client", async () => {
  await withServer(async ({ request, broadcasts }) => {
    const id = await createBastion(request);
    broadcasts.length = 0;

    const updated = await request("PATCH", `/api/campaigns/camp-1/bastions/${id}`, {
      clientId: "tab-b",
      name: "Renamed Keep",
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));

    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0]?.payload.originClientId, "tab-b");
    assert.equal(broadcasts[0]?.payload.bastionId, id);
  });
});

test("facility operations attribute their broadcast too", async () => {
  await withServer(async ({ request, broadcasts }) => {
    const id = await createBastion(request);
    broadcasts.length = 0;

    const added = await request("POST", `/api/campaigns/camp-1/bastions/${id}/facilities`, {
      clientId: "tab-c",
      facilityKey: "bedroom",
      source: "dm_extra",
    });
    assert.equal(added.status, 200, JSON.stringify(added.body));

    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0]?.payload.originClientId, "tab-c");
  });
});

test("a write without a client id carries no origin, so every client refreshes", async () => {
  await withServer(async ({ request, broadcasts }) => {
    const id = await createBastion(request);
    broadcasts.length = 0;

    await request("PATCH", `/api/campaigns/camp-1/bastions/${id}`, { name: "Anonymous edit" });

    // A client that doesn't identify itself must not be mistaken for anyone: the field is absent
    // rather than null or empty, so isOwnEcho can never match it.
    assert.equal(broadcasts.length, 1);
    assert.ok(!("originClientId" in (broadcasts[0]?.payload ?? {})));
  });
});

test("delete still broadcasts so other clients drop the row", async () => {
  await withServer(async ({ request, broadcasts }) => {
    const id = await createBastion(request);
    broadcasts.length = 0;

    const deleted = await request("DELETE", `/api/campaigns/camp-1/bastions/${id}`);
    assert.equal(deleted.status, 200);

    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0]?.payload.action, "delete");
    assert.equal(broadcasts[0]?.payload.bastionId, id);
  });
});

test("an unknown clientId type is rejected rather than broadcast", async () => {
  await withServer(async ({ request, broadcasts }) => {
    const id = await createBastion(request);
    broadcasts.length = 0;

    const bad = await request("PATCH", `/api/campaigns/camp-1/bastions/${id}`, {
      clientId: 12345,
      name: "Bad",
    });
    assert.equal(bad.status, 400);
    assert.equal(broadcasts.length, 0);
  });
});

// Suppressing the echo only works if the author still learns what was saved. Every write therefore
// responds with the stored row, in the same shape the GET routes return.
test("writes return the saved bastion so the author needn't re-fetch", async () => {
  await withServer(async ({ request }) => {
    const created = await request("POST", "/api/campaigns/camp-1/bastions", { name: "Keep", assignedPlayerIds: [], facilities: [] });
    const createdBody = created.body as { id: string; bastion: { id: string; name: string } };
    assert.equal(createdBody.bastion.id, createdBody.id);
    assert.equal(createdBody.bastion.name, "Keep");

    const updated = await request("PATCH", `/api/campaigns/camp-1/bastions/${createdBody.id}`, {
      name: "  Renamed  ",
      notes: "Walls need work",
    });
    const updatedBastion = (updated.body as { bastion: { name: string; notes: string } }).bastion;
    // The stored, normalised value -- not an echo of the request.
    assert.equal(updatedBastion.name, "Renamed");
    assert.equal(updatedBastion.notes, "Walls need work");

    const added = await request("POST", `/api/campaigns/camp-1/bastions/${createdBody.id}/facilities`, {
      facilityKey: "BEDROOM",
      source: "dm_extra",
    });
    assert.equal(added.status, 200, JSON.stringify(added.body));
    const addedBastion = (added.body as {
      bastion: { facilities: Array<{ facilityKey: string; size: string | null; definition: { name: string } | null }> };
    }).bastion;
    assert.equal(addedBastion.facilities[0]?.facilityKey, "bedroom");
    // Server-derived data the client couldn't have known without re-fetching.
    assert.equal(addedBastion.facilities[0]?.definition?.name, "Bedroom");
    assert.equal(addedBastion.facilities[0]?.size, "cramped");
  });
});
