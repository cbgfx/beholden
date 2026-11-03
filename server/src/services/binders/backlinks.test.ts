import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { openDb } from "../../lib/db.js";
import { registerBinderLoreRoutes } from "../../routes/binders/lore.js";
import type { ServerContext } from "../../server/context.js";

test("backlinks use current source text, include campaign notes and preserve Binder access boundaries", async () => {
  const db = openDb(":memory:");
  for (const id of ["owner", "reader", "outsider"])
    db.prepare(
      "INSERT INTO users(id,username,passhash,name,created_at,updated_at) VALUES (?,?,'h',?,1,1)",
    ).run(id, id, id);
  for (const id of ["b", "other"])
    db.prepare(
      "INSERT INTO binders(id,owner_user_id,name,name_key,created_at,updated_at) VALUES (?,'owner',?,?,1,1)",
    ).run(id, id, id);
  const record = (id: string, binder: string, type: string) =>
    db
      .prepare(
        "INSERT INTO binder_records(id,binder_id,record_type,name,name_key,created_at,updated_at) VALUES (?,?,?,?,?,1,1)",
      )
      .run(id, binder, type, id, id);
  record("target", "b", "mortal");
  record("chapel", "b", "location");
  record("org", "b", "organization");
  record("foreign", "other", "location");
  const reference =
    "The party met [Brother Diego](/binder/b/mortals/target) at the chapel.";
  db.prepare("INSERT INTO binder_organizations(id,dm_notes,created_at,updated_at) VALUES ('org',?,1,1)").run(reference);
  db.prepare(
    "INSERT INTO binder_locations(id,description,created_at,updated_at) VALUES (?,?,1,1)",
  ).run("chapel", reference);
  db.prepare(
    "INSERT INTO binder_locations(id,description,created_at,updated_at) VALUES (?,?,1,1)",
  ).run("foreign", reference);
  db.prepare(
    "INSERT INTO campaigns(id,name,binder_id,campaign_notes,created_at,updated_at) VALUES ('campaign','Session 12','b',?,1,1)",
  ).run(reference);
  db.prepare(
    "INSERT INTO campaigns(id,name,binder_id,campaign_notes,created_at,updated_at) VALUES ('private','Other campaign','b',?,1,1)",
  ).run(reference);
  db.prepare(
    "INSERT INTO campaign_membership(id,campaign_id,user_id,role,created_at,updated_at) VALUES ('dm','campaign','owner','dm',1,1)",
  ).run();
  db.prepare(
    "INSERT INTO binder_memberships(binder_id,user_id,role,created_at,updated_at) VALUES ('b','reader','viewer',1,1)",
  ).run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = String(req.headers["x-user"] ?? "owner");
    req.user = { userId, username: userId, isAdmin: false };
    next();
  });
  registerBinderLoreRoutes(app, { db } as ServerContext);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/binders/b/records/target/backlinks`;
  try {
    const rows = (await (await fetch(url)).json()) as Array<{
      id: string;
      fields: string[];
      contexts: Array<{ before: string; mention: string; after: string }>;
    }>;
    assert.deepEqual(rows.map((row) => row.id).sort(), ["campaign", "chapel", "org"]);
    assert.equal(
      rows.find((row) => row.id === "chapel")!.contexts[0]!.mention,
      "Brother Diego",
    );
    assert.equal(
      rows.find((row) => row.id === "chapel")!.contexts[0]!.after,
      " at the chapel.",
    );
    assert.deepEqual(rows.find((row) => row.id === "campaign")!.fields, [
      "campaign_notes",
    ]);
    const readerRows = (await (
      await fetch(url, { headers: { "x-user": "reader" } })
    ).json()) as Array<{ id: string }>;
    assert.deepEqual(
      readerRows.map((row) => row.id),
      ["chapel", "org"],
    );
    db.prepare(
      "UPDATE binder_locations SET description='No reference remains.' WHERE id='chapel'",
    ).run();
    const updated = (await (await fetch(url)).json()) as Array<{ id: string }>;
    assert.deepEqual(
      updated.map((row) => row.id).sort(),
      ["campaign", "org"],
    );
    assert.equal(
      (await fetch(url, { headers: { "x-user": "outsider" } })).status,
      404,
    );
    assert.equal(
      (await fetch(url.replace("/target/", "/missing/"))).status,
      404,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
