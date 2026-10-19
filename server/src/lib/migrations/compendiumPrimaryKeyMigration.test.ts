import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { ensureCompendiumCompositePrimaryKey } from "./compendiumPrimaryKeyMigration.js";
import { openDb } from "../db.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("upgrades legacy Binder Items even when Compendium keys are already current", () => {
  const db = new Database(":memory:");
  try {
    db.pragma("foreign_keys = OFF");
    db.exec(`CREATE TABLE binder_records(id TEXT PRIMARY KEY);
      CREATE TABLE mortals(id TEXT PRIMARY KEY);
      CREATE TABLE compendium_items(id TEXT, ruleset TEXT, name TEXT, PRIMARY KEY(id,ruleset));
      INSERT INTO compendium_items VALUES ('sword','5e','Sword'),('sword','5.5e','Sword');
      CREATE TABLE binder_items(id TEXT PRIMARY KEY, description TEXT, dm_notes TEXT,
        compendium_item_id TEXT REFERENCES compendium_items(id), holder_mortal_id TEXT,
        location_record_id TEXT, created_at INTEGER, updated_at INTEGER);
      INSERT INTO binder_items VALUES ('i','Biography of a sword','Secret','sword',NULL,NULL,10,20);
      INSERT INTO binder_items VALUES ('u','Unlinked item',NULL,NULL,NULL,NULL,11,21);
      INSERT INTO binder_records VALUES ('i'),('u');`);
    ensureCompendiumCompositePrimaryKey(db);
    assert.deepEqual(db.prepare("SELECT * FROM binder_items WHERE id='i'").get(), {
      id: "i", description: "Biography of a sword", dm_notes: "Secret", compendium_item_id: "sword",
      compendium_item_ruleset: "5e", holder_mortal_id: null, location_record_id: null, created_at: 10, updated_at: 20,
    });
    assert.equal(db.prepare("SELECT compendium_item_ruleset FROM binder_items WHERE id='u'").pluck().get(), null);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    ensureCompendiumCompositePrimaryKey(db);
    assert.equal(db.prepare("SELECT COUNT(*) FROM binder_items").pluck().get(), 2);
    db.pragma("foreign_keys = ON");
    db.prepare("DELETE FROM compendium_items WHERE id='sword' AND ruleset='5e'").run();
    assert.equal(db.prepare("SELECT compendium_item_id FROM binder_items WHERE id='i'").pluck().get(), null);
  } finally { db.close(); }
});
test("startup upgrades Items before creating the ruleset index", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "binder-item-upgrade-"));
  const file = path.join(dir, "test.db");
  let db = openDb(file);
  try {
    db.exec(`DROP TABLE binder_items;
      CREATE TABLE binder_items(id TEXT PRIMARY KEY REFERENCES binder_records(id), description TEXT, dm_notes TEXT,
        compendium_item_id TEXT REFERENCES compendium_items(id), holder_mortal_id TEXT, location_record_id TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    db.close();
    db = openDb(file);
    assert.ok(db.prepare("SELECT name FROM pragma_table_info('binder_items') WHERE name='compendium_item_ruleset'").get());
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
