import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../lib/db.js";
import { importDatabaseFile } from "./databaseTransfer.js";
import type { ServerContext } from "../server/context.js";

function makeCtx(db: ReturnType<typeof openDb>, dataDir: string): ServerContext {
  return {
    db,
    paths: { dataDir } as ServerContext["paths"],
    helpers: { now: () => 12345 } as ServerContext["helpers"],
  } as ServerContext;
}

function seedUserAndCampaign(db: ReturnType<typeof openDb>, userId: string, userName: string, campaignId: string, campaignName: string): void {
  db.prepare(`
    INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at)
    VALUES (?, ?, 'hash', ?, 1, 1, 1)
  `).run(userId, userId, userName);
  db.prepare(`
    INSERT INTO campaigns (id, name, color, image_url, shared_notes, created_at, updated_at)
    VALUES (?, ?, '#000000', NULL, '', 1, 1)
  `).run(campaignId, campaignName);
}

test("importDatabaseFile replaces every row in the live db with the uploaded snapshot", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-db-import-test-"));
  const liveDb = openDb(":memory:");
  const uploadedPath = path.join(tmpDir, "uploaded.db");
  try {
    seedUserAndCampaign(liveDb, "old-user", "Old Admin", "old-campaign", "Old Campaign");

    const uploadedDb = openDb(uploadedPath);
    seedUserAndCampaign(uploadedDb, "new-user", "New Admin", "new-campaign", "New Campaign");
    uploadedDb.pragma("wal_checkpoint(TRUNCATE)");
    uploadedDb.close();

    const result = importDatabaseFile(makeCtx(liveDb, tmpDir), uploadedPath);

    assert.ok(result.tablesReplaced > 0);
    assert.ok(result.rowsImported > 0);
    assert.ok(fs.existsSync(result.backupPath));

    const users = liveDb.prepare("SELECT id, name FROM users").all() as Array<{ id: string; name: string }>;
    assert.deepEqual(users, [{ id: "new-user", name: "New Admin" }]);
    const campaigns = liveDb.prepare("SELECT id, name FROM campaigns").all() as Array<{ id: string; name: string }>;
    assert.deepEqual(campaigns, [{ id: "new-campaign", name: "New Campaign" }]);

    // The pre-import backup preserves what the live db looked like beforehand.
    const backupDb = openDb(result.backupPath);
    try {
      const backedUpUsers = backupDb.prepare("SELECT id FROM users").all() as Array<{ id: string }>;
      assert.deepEqual(backedUpUsers, [{ id: "old-user" }]);
    } finally {
      backupDb.close();
    }

    // Foreign key enforcement must be restored afterward.
    assert.equal(liveDb.pragma("foreign_keys", { simple: true }), 1);
  } finally {
    liveDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("importDatabaseFile matches columns by name, not position, when a table's column order diverged between the live and uploaded schemas", () => {
  // `ALTER TABLE ADD COLUMN` always appends physically, so a long-lived live db and a
  // freshly-created export commonly end up with identical columns in different physical
  // order (this happened for real in production: campaigns, binder_continents, mortals,
  // and 11 other tables). A positional `SELECT *` copy would silently shuffle values
  // (or trip a NOT NULL constraint, if unlucky) instead of copying them correctly.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-db-import-test-"));
  const liveDb = openDb(":memory:");
  const uploadedPath = path.join(tmpDir, "uploaded-drift.db");
  try {
    seedUserAndCampaign(liveDb, "old-user", "Old Admin", "old-campaign", "Old Campaign");
    liveDb.exec("CREATE TABLE drift_test (id TEXT PRIMARY KEY, a INTEGER NOT NULL, b TEXT)");
    liveDb.prepare("INSERT INTO drift_test (id, a, b) VALUES ('row-1', 1, 'live-b')").run();

    const uploadedDb = openDb(uploadedPath);
    seedUserAndCampaign(uploadedDb, "new-user", "New Admin", "new-campaign", "New Campaign");
    // Same columns as the live table, deliberately reordered.
    uploadedDb.exec("CREATE TABLE drift_test (id TEXT PRIMARY KEY, b TEXT, a INTEGER NOT NULL)");
    uploadedDb.prepare("INSERT INTO drift_test (id, b, a) VALUES ('row-1', 'uploaded-b', 99)").run();
    uploadedDb.pragma("wal_checkpoint(TRUNCATE)");
    uploadedDb.close();

    importDatabaseFile(makeCtx(liveDb, tmpDir), uploadedPath);

    const row = liveDb.prepare("SELECT id, a, b FROM drift_test").get();
    assert.deepEqual(row, { id: "row-1", a: 99, b: "uploaded-b" });
  } finally {
    liveDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("importDatabaseFile rejects an uploaded database with no admin user and leaves the live db untouched", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-db-import-test-"));
  const liveDb = openDb(":memory:");
  const uploadedPath = path.join(tmpDir, "uploaded-empty.db");
  try {
    seedUserAndCampaign(liveDb, "old-user", "Old Admin", "old-campaign", "Old Campaign");

    const uploadedDb = openDb(uploadedPath);
    uploadedDb.pragma("wal_checkpoint(TRUNCATE)");
    uploadedDb.close();

    assert.throws(
      () => importDatabaseFile(makeCtx(liveDb, tmpDir), uploadedPath),
      /no admin user/i,
    );

    const users = liveDb.prepare("SELECT id FROM users").all() as Array<{ id: string }>;
    assert.deepEqual(users, [{ id: "old-user" }]);
  } finally {
    liveDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
