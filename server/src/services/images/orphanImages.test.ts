import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { openDb } from "../../lib/db.js";
import { deleteOrphanImages, findOrphanImages, imageUrlToRelativePath } from "./orphanImages.js";

function withDataDir(run: (dataDir: string) => void): void {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-images-"));
  try {
    run(dataDir);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function writeImage(dataDir: string, relativePath: string): void {
  const absolute = path.join(dataDir, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, "not really webp");
}

test("imageUrlToRelativePath handles the shapes the API stores and hands out", () => {
  assert.equal(imageUrlToRelativePath("/character-images/abc.webp"), "character-images/abc.webp");
  // The API appends the cache-busting version, and can absolutise the URL for remote clients.
  assert.equal(imageUrlToRelativePath("/character-images/abc.webp?v=123"), "character-images/abc.webp");
  assert.equal(imageUrlToRelativePath("http://192.168.1.10:5174/player-images/p1.webp?v=9"), "player-images/p1.webp");
  assert.equal(imageUrlToRelativePath(""), null);
  assert.equal(imageUrlToRelativePath(null), null);
  // Never walk out of the data directory.
  assert.equal(imageUrlToRelativePath("/../../secrets.txt"), null);
});

test("finds only files nothing points at, and leaves referenced ones alone", () => {
  withDataDir((dataDir) => {
    const db = openDb(":memory:");
    try {
      const now = Date.now();
      db.prepare("INSERT INTO campaigns (id, name, image_url, created_at, updated_at) VALUES ('c1', 'Camp', '/campaign-images/c1.webp', ?, ?)").run(now, now);
      db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES ('u1', 'u', 'h', 'U', ?, ?)").run(now, now);
      db.prepare("INSERT INTO user_characters (id, user_id, name, image_url, created_at, updated_at) VALUES ('ch1', 'u1', 'Hero', '/character-images/ch1.webp?v=5', ?, ?)").run(now, now);
      // A player row keeps its own copy of the portrait URL.
      db.prepare("INSERT INTO players (id, campaign_id, character_name, level, live_json, image_url, created_at, updated_at) VALUES ('p1', 'c1', 'Hero', 1, '{}', '/character-images/ch1.webp', ?, ?)").run(now, now);

      writeImage(dataDir, "campaign-images/c1.webp");
      writeImage(dataDir, "character-images/ch1.webp");
      writeImage(dataDir, "character-images/deleted-character.webp");
      writeImage(dataDir, "player-images/deleted-player.webp");
      writeImage(dataDir, "binder-mortal-images/deleted-mortal.webp");

      const orphans = findOrphanImages(db, dataDir);
      assert.deepEqual(orphans.map((orphan) => orphan.relativePath).sort(), [
        "binder-mortal-images/deleted-mortal.webp",
        "character-images/deleted-character.webp",
        "player-images/deleted-player.webp",
      ]);
      assert.ok(orphans.every((orphan) => orphan.bytes > 0));

      assert.equal(deleteOrphanImages(orphans), 3);
      assert.ok(fs.existsSync(path.join(dataDir, "campaign-images/c1.webp")), "referenced files stay");
      assert.ok(fs.existsSync(path.join(dataDir, "character-images/ch1.webp")), "a portrait two rows share stays");
      assert.equal(findOrphanImages(db, dataDir).length, 0);
    } finally {
      db.close();
    }
  });
});

test("reports nothing when the data directory has no image folders yet", () => {
  withDataDir((dataDir) => {
    const db = openDb(":memory:");
    try {
      assert.deepEqual(findOrphanImages(db, dataDir), []);
    } finally {
      db.close();
    }
  });
});
