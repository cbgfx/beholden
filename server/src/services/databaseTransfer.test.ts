import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../lib/db.js";
import { prepareImageRestore } from "./databaseImageArchive.js";
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

test("importDatabaseFile rejects invalid character inventory before touching the live database", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-db-import-test-"));
  const liveDb = openDb(":memory:");
  const uploadedPath = path.join(tmpDir, "uploaded-invalid-inventory.db");
  try {
    seedUserAndCampaign(liveDb, "old-user", "Old Admin", "old-campaign", "Old Campaign");
    const uploadedDb = openDb(uploadedPath);
    seedUserAndCampaign(uploadedDb, "new-user", "New Admin", "new-campaign", "New Campaign");
    uploadedDb.prepare(`
      INSERT INTO user_characters (id, user_id, name, character_data_json, created_at, updated_at)
      VALUES ('broken-character', 'new-user', 'Broken', ?, 1, 1)
    `).run(JSON.stringify({ inventory: [{ id: "rope", name: "Rope", quantity: 0 }] }));
    uploadedDb.pragma("wal_checkpoint(TRUNCATE)");
    uploadedDb.close();

    assert.throws(() => importDatabaseFile(makeCtx(liveDb, tmpDir), uploadedPath), /invalid quantity/i);
    assert.deepEqual(liveDb.prepare("SELECT id FROM users").all(), [{ id: "old-user" }]);
  } finally {
    liveDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


test("restore rejects a foreign-key violation without touching live rows", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-invalid-fk-"));
  const liveDb = openDb(":memory:");
  try {
    seedUserAndCampaign(liveDb, "old-user", "Old Admin", "old-campaign", "Old Campaign");
    const file = path.join(tmpDir, "uploaded.db"); const staged = openDb(file);
    seedUserAndCampaign(staged, "new-user", "New Admin", "new-campaign", "New Campaign");
    staged.pragma("foreign_keys=OFF");
    staged.prepare("INSERT INTO campaign_membership(id,campaign_id,user_id,role,created_at,updated_at) VALUES('orphan','missing-campaign','new-user','dm',1,1)").run();
    staged.close();
    assert.throws(() => importDatabaseFile(makeCtx(liveDb, tmpDir), file), /foreign-key/);
    assert.deepEqual(liveDb.prepare("SELECT id FROM users").all(), [{ id: "old-user" }]);
    assert.deepEqual(liveDb.pragma("foreign_key_check"), []);
  } finally { liveDb.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
});

test("failed image installation rolls back the database, replaced images and newly installed images", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-restore-rollback-"));
  const liveDb = openDb(":memory:");
  let restore: ReturnType<typeof prepareImageRestore> | undefined;
  try {
    seedUserAndCampaign(liveDb, "old-user", "Old Admin", "old-campaign", "Old Campaign");
    const file = path.join(tmpDir, "uploaded.db"); const staged = openDb(file);
    seedUserAndCampaign(staged, "new-user", "New Admin", "new-campaign", "New Campaign"); staged.close();
    const directory = path.join(tmpDir, "campaign-images"); fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "old.webp"), "original"); fs.writeFileSync(path.join(directory, "last.webp"), "last original");
    const io = { ...fs, renameSync: ((from, to) => {
      if (String(from).endsWith("2.new")) throw new Error("simulated disk failure");
      fs.renameSync(from, to);
    }) as typeof fs.renameSync };
    restore = prepareImageRestore(tmpDir, [
      { relativePath: "campaign-images/old.webp", bytes: Buffer.from("replacement") },
      { relativePath: "campaign-images/new.webp", bytes: Buffer.from("new") },
      { relativePath: "campaign-images/last.webp", bytes: Buffer.from("last replacement") },
    ], io);
    assert.throws(() => importDatabaseFile(makeCtx(liveDb, tmpDir), file, restore), /simulated disk/);
    assert.deepEqual(liveDb.prepare("SELECT id FROM users").all(), [{ id: "old-user" }]);
    assert.equal(fs.readFileSync(path.join(directory, "old.webp"), "utf8"), "original");
    assert.equal(fs.readFileSync(path.join(directory, "last.webp"), "utf8"), "last original");
    assert.equal(fs.existsSync(path.join(directory, "new.webp")), false);
    assert.equal(liveDb.pragma("foreign_keys", { simple: true }), 1);
  } finally { restore?.dispose(); liveDb.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
});


test("failed filesystem recovery retains original files with an explicit recovery manifest", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-restore-recovery-"));
  const liveDb = openDb(":memory:"); let restore: ReturnType<typeof prepareImageRestore> | undefined;
  try {
    seedUserAndCampaign(liveDb, "old-user", "Old Admin", "old-campaign", "Old Campaign");
    const file = path.join(tmpDir, "uploaded.db"); const staged = openDb(file);
    seedUserAndCampaign(staged, "new-user", "New Admin", "new-campaign", "New Campaign"); staged.close();
    const imageDir = path.join(tmpDir, "campaign-images"); fs.mkdirSync(imageDir);
    fs.writeFileSync(path.join(imageDir, "original.webp"), "retained original");
    const io = { ...fs, renameSync: ((from, to) => {
      if (String(from).endsWith("1.new") || String(from).endsWith("0.previous")) throw new Error("filesystem unavailable");
      fs.renameSync(from, to);
    }) as typeof fs.renameSync };
    restore = prepareImageRestore(tmpDir, [
      { relativePath: "campaign-images/original.webp", bytes: Buffer.from("replacement") },
      { relativePath: "campaign-images/new.webp", bytes: Buffer.from("new") },
    ], io);
    assert.throws(() => importDatabaseFile(makeCtx(liveDb, tmpDir), file, restore), /Recovery files are retained/);
    restore.dispose();
    const recoveryDir = fs.readdirSync(path.join(tmpDir, "tmp")).find(name => name.startsWith("image-restore-"))!;
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, "tmp", recoveryDir, "recovery.json"), "utf8")) as Array<{ target: string; previous: string }>;
    assert.equal(fs.readFileSync(manifest[0]!.previous, "utf8"), "retained original");
    assert.equal(manifest[0]!.target, path.join(imageDir, "original.webp"));
    assert.deepEqual(liveDb.prepare("SELECT id FROM users").all(), [{ id: "old-user" }]);
  } finally { restore?.dispose(); liveDb.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
});
