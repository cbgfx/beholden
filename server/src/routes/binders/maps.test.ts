import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { openDb } from "../../lib/db.js";
import { imageUpload } from "../../lib/upload.js";
import type { ServerContext } from "../../server/context.js";
import { registerBinderMapRoutes } from "./maps.js";
import {
  exportBinderDocument,
  importBinderDocument,
} from "../../services/binders/nativeBinder.js";
import { normalizeKey } from "../../lib/text.js";
import { multerErrorMiddleware } from "../../lib/validate.js";

test("location maps preserve detail, enforce visibility, survive export, and cascade on deletion", async () => {
  const db = openDb(":memory:");
  for (const id of ["owner", "player", "outsider", "viewer", "editor"])
    db.prepare(
      "INSERT INTO users(id,username,passhash,name,created_at,updated_at) VALUES (?,?,'h',?,1,1)",
    ).run(id, id, id);
  for (const id of ["b", "other"])
    db.prepare(
      "INSERT INTO binders(id,owner_user_id,name,name_key,created_at,updated_at) VALUES (?,'owner',?,?,1,1)",
    ).run(id, id, id);
  db.exec(`
    INSERT INTO binder_memberships(binder_id,user_id,role,created_at,updated_at) VALUES ('b','viewer','viewer',1,1),('b','editor','collaborator',1,1);
    INSERT INTO binder_records(id,binder_id,record_type,name,name_key,visibility,created_at,updated_at) VALUES ('place','b','location','Place','place','dm',1,1),('hero','b','mortal','Hero','hero','dm',1,1);
    INSERT INTO binder_locations(id,description,created_at,updated_at) VALUES ('place','City',1,1);
    INSERT INTO user_characters(id,user_id,name,created_at,updated_at) VALUES ('character','player','Hero',1,1);
    INSERT INTO mortals(id,mortal_type,created_at,updated_at) VALUES ('hero','player_character',1,1);
    INSERT INTO binder_player_characters(mortal_id,character_id,created_at,updated_at) VALUES ('hero','character',1,1);
  `);
  const app = express();
  app.use((req, _res, next) => {
    const userId = req.headers["x-user"];
    if (typeof userId === "string")
      req.user = { userId, username: userId, isAdmin: false };
    next();
  });
  registerBinderMapRoutes(app, { db, imageUpload } as ServerContext);
  app.use(multerErrorMiddleware);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const endpoint = "/api/binders/b/locations/place/map";
  const request = (path: string, user = "owner", init: RequestInit = {}) =>
    fetch(`${base}${path}`, { ...init, headers: { "x-user": user } });
  const image = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const upload = (bytes: Uint8Array = image, mime = "image/png") => {
    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(bytes)], { type: mime }),
      "map.png",
    );
    return { method: "POST", body: form };
  };
  try {
    assert.equal((await fetch(`${base}${endpoint}`)).status, 401);
    assert.equal((await request(endpoint, "player", upload())).status, 404);
    assert.equal((await request(endpoint, "viewer", upload())).status, 404);
    assert.equal((await request(endpoint, "editor", upload())).status, 200);
    const response = await request(endpoint);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const saved = Buffer.from(await response.arrayBuffer());
    assert.equal((await sharp(saved).metadata()).width, 1800);
    assert.equal((await request(endpoint, "viewer")).status, 200);
    assert.equal((await request(endpoint, "player")).status, 404);
    db.prepare(
      "UPDATE binder_records SET visibility='public' WHERE id='place'",
    ).run();
    assert.equal((await request(endpoint, "player")).status, 200);
    assert.equal((await request(endpoint, "outsider")).status, 404);
    assert.equal(
      (await request(endpoint.replace("/b/", "/other/"))).status,
      404,
    );
    db.prepare(
      "UPDATE binder_records SET visibility='dm' WHERE id='place'",
    ).run();
    assert.equal((await request(endpoint, "player")).status, 404);
    assert.equal(
      (
        await request(
          endpoint,
          "owner",
          upload(new TextEncoder().encode("broken")),
        )
      ).status,
      400,
    );
    assert.deepEqual(
      Buffer.from(await (await request(endpoint)).arrayBuffer()),
      saved,
    );
    assert.equal(
      (
        await request(
          endpoint,
          "owner",
          upload(new Uint8Array(12 * 1024 * 1024 + 1)),
        )
      ).status,
      413,
    );
    const replacement = await sharp({
      create: { width: 900, height: 600, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
    assert.equal(
      (await request(endpoint, "owner", upload(replacement))).status,
      200,
    );
    assert.equal(
      (
        await sharp(
          Buffer.from(await (await request(endpoint)).arrayBuffer()),
        ).metadata()
      ).width,
      900,
    );
    const document = exportBinderDocument(db, "b")!;
    let sequence = 0;
    const imported = importBinderDocument(db, document, "owner", {
      uid: () => `import-${++sequence}`,
      now: () => 2,
      normalizeKey,
    });
    const copied = db
      .prepare(
        "SELECT m.image_base64 FROM binder_location_maps m JOIN binder_records r ON r.id=m.id WHERE r.binder_id=?",
      )
      .get(imported.binderId) as { image_base64: string };
    assert.equal(
      (await sharp(Buffer.from(copied.image_base64, "base64")).metadata())
        .width,
      900,
    );
    assert.equal(
      (await request(endpoint, "owner", { method: "DELETE" })).status,
      200,
    );
    assert.equal((await request(endpoint)).status, 404);
    assert.equal((await request(endpoint, "owner", upload())).status, 200);
    db.prepare("DELETE FROM binder_records WHERE id='place'").run();
    assert.equal(
      db
        .prepare("SELECT count(*) FROM binder_location_maps WHERE id='place'")
        .pluck()
        .get(),
      0,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
