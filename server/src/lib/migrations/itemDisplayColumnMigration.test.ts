import assert from "node:assert/strict";
import test from "node:test";
import { openDb } from "../db.js";
import { dropItemDisplayColumns } from "./itemDisplayColumnMigration.js";

const itemColumns = (db: ReturnType<typeof openDb>) =>
  new Set((db.prepare("PRAGMA table_info(compendium_items)").all() as Array<{ name: string }>).map((column) => column.name));

test("the item display-column migration is idempotent", () => {
  const db = openDb(":memory:");
  try {
    for (const column of ["equippable INTEGER NOT NULL DEFAULT 0", "weight REAL", "value REAL", "proficiency TEXT"]) {
      db.exec(`ALTER TABLE compendium_items ADD COLUMN ${column}`);
    }
    dropItemDisplayColumns(db);
    dropItemDisplayColumns(db);
    for (const column of ["equippable", "weight", "value", "proficiency"]) {
      assert.equal(itemColumns(db).has(column), false, column);
    }
    assert.equal(itemColumns(db).has("data_json"), true);
  } finally {
    db.close();
  }
});
