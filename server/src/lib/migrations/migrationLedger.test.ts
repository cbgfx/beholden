import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { openDb } from "../db.js";
import { importDatabaseFile } from "../../services/databaseTransfer.js";
import type { ServerContext } from "../../server/context.js";
import { ONE_TIME_MIGRATIONS, runOnce } from "./migrationLedger.js";

const ID = ONE_TIME_MIGRATIONS.compendiumLegacyEffectKinds;

function recordedIds(db: Database.Database): string[] {
  return db.prepare("SELECT id FROM schema_migrations ORDER BY id").pluck().all() as string[];
}

test("openDb records both one-time compendium migrations on a new database", () => {
  const db = openDb(":memory:");
  try {
    assert.deepEqual(recordedIds(db), Object.values(ONE_TIME_MIGRATIONS).sort());
  } finally {
    db.close();
  }
});

test("a recorded migration is skipped on later runs", () => {
  const db = openDb(":memory:");
  try {
    let calls = 0;
    runOnce(db, ID, () => { calls += 1; return true; });
    assert.equal(calls, 0, "openDb already recorded it, so it does not run again");
  } finally {
    db.close();
  }
});

test("a migration that could not finish is not recorded and runs again next time", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("DELETE FROM schema_migrations WHERE id = ?").run(ID);
    let calls = 0;
    runOnce(db, ID, () => { calls += 1; return false; });
    assert.equal(recordedIds(db).includes(ID), false);
    runOnce(db, ID, () => { calls += 1; return true; });
    assert.equal(calls, 2);
    assert.equal(recordedIds(db).includes(ID), true);
  } finally {
    db.close();
  }
});

test("a migration that throws rolls back its own writes and is not recorded", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("DELETE FROM schema_migrations WHERE id = ?").run(ID);
    assert.throws(() => runOnce(db, ID, (inner) => {
      inner.prepare("INSERT INTO compendium_feats (id, ruleset, name, data_json) VALUES ('f_x', '5e', 'X', '{}')").run();
      throw new Error("boom");
    }), /boom/);
    assert.equal(db.prepare("SELECT COUNT(*) FROM compendium_feats").pluck().get(), 0);
    assert.equal(recordedIds(db).includes(ID), false);
  } finally {
    db.close();
  }
});

test("runOnce refuses an id that is not registered", () => {
  const db = openDb(":memory:");
  try {
    assert.throws(() => runOnce(db, "notRegistered.v1", () => true), /Unregistered/);
  } finally {
    db.close();
  }
});

test("openDb refuses a database migrated by a newer version, before changing it", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-ledger-"));
  const dbPath = path.join(directory, "beholden.db");
  try {
    const newer = new Database(dbPath);
    newer.exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
    newer.prepare("INSERT INTO schema_migrations VALUES ('fromTheFuture.v1', 1)").run();
    newer.close();

    assert.throws(() => openDb(dbPath), /newer version of Beholden.*fromTheFuture\.v1/);

    const after = new Database(dbPath);
    try {
      const tables = after.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all();
      assert.deepEqual(tables, ["schema_migrations"], "no schema was created");
      assert.equal(after.pragma("journal_mode", { simple: true }), "delete", "the file was not switched to WAL");
    } finally {
      after.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("a whole-database restore carries the ledger with the data", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-ledger-restore-"));
  const uploadedPath = path.join(directory, "uploaded.db");
  const live = openDb(":memory:");
  try {
    // An older backup: no ledger yet, so restoring it must migrate it and bring a complete ledger.
    const uploaded = openDb(uploadedPath);
    uploaded.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('u', 'u', 'h', 'U', 1, 1, 1)").run();
    uploaded.exec("DROP TABLE schema_migrations");
    uploaded.pragma("wal_checkpoint(TRUNCATE)");
    uploaded.close();

    const ctx = { db: live, paths: { dataDir: directory }, helpers: { now: () => 1 } } as unknown as ServerContext;
    importDatabaseFile(ctx, uploadedPath);

    assert.deepEqual(recordedIds(live), Object.values(ONE_TIME_MIGRATIONS).sort());
  } finally {
    live.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
