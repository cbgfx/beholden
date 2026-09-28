import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../db.js";

test("campaign and player-owned character activity flags archive without deleting relationships", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('campaign', 'Campaign', 1, 1)").run();
    db.prepare("INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES ('user', 'user', 'hash', 'User', 1, 1)").run();
    db.prepare("INSERT INTO user_characters (id, user_id, name, created_at, updated_at) VALUES ('character', 'user', 'Hero', 1, 1)").run();
    assert.equal(db.prepare("SELECT is_active FROM campaigns WHERE id = 'campaign'").pluck().get(), 1);
    assert.equal(db.prepare("SELECT is_active FROM user_characters WHERE id = 'character'").pluck().get(), 1);

    db.prepare("UPDATE campaigns SET is_active = 0 WHERE id = 'campaign'").run();
    db.prepare("UPDATE user_characters SET is_active = 0 WHERE id = 'character'").run();
    assert.equal(db.prepare("SELECT COUNT(*) FROM campaigns").pluck().get(), 1);
    assert.equal(db.prepare("SELECT COUNT(*) FROM user_characters").pluck().get(), 1);
  } finally {
    db.close();
  }
});
