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
