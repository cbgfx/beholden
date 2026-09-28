import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { openDb } from "./db.js";
import { SCHEMA_SQL } from "./dbSchema.js";
import { PLAYER_ROWS_VIEW_SQL } from "./playerRowsView.js";

test("startup repairs a current player view over legacy character columns before table rebuilds", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-old-schema-"));
  const dbPath = path.join(directory, "beholden.db");
  const legacy = new Database(dbPath);
  try {
    legacy.exec(SCHEMA_SQL);
    legacy.exec("DROP VIEW player_rows");
    legacy.exec("ALTER TABLE user_characters DROP COLUMN derived_hp_max");
    legacy.exec("ALTER TABLE user_characters DROP COLUMN derived_speed");
    legacy.exec("DROP INDEX IF EXISTS idx_inpcs_campaign_binder_mortal");
    legacy.exec("ALTER TABLE inpcs DROP COLUMN binder_mortal_id");
    // SQLite permits creating this view even though the referenced legacy columns are absent. A
    // later unrelated table rebuild reparses it and raises the production startup error.
    legacy.exec(PLAYER_ROWS_VIEW_SQL);
  } finally {
    legacy.close();
  }

  const upgraded = openDb(dbPath);
  try {
    const characterColumns = new Set(
      (upgraded.prepare("PRAGMA table_info(user_characters)").all() as Array<{ name: string }>).map(({ name }) => name),
    );
    const inpcColumns = new Set(
      (upgraded.prepare("PRAGMA table_info(inpcs)").all() as Array<{ name: string }>).map(({ name }) => name),
    );
    assert.equal(characterColumns.has("derived_hp_max"), true);
    assert.equal(characterColumns.has("derived_speed"), true);
    assert.equal(inpcColumns.has("binder_mortal_id"), true);
    assert.doesNotThrow(() => upgraded.prepare("SELECT * FROM player_rows LIMIT 1").all());
  } finally {
    upgraded.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
