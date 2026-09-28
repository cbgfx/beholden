import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { migrateInventoryIntegrity } from "./inventoryIntegrityMigration.js";

test("inventory integrity migration repairs legacy ammunition links once", () => {
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE user_characters (id TEXT PRIMARY KEY, character_data_json TEXT)");
    const data = {
      inventory: [
        { id: "bow", name: "Longbow", weaponAmmo: "arrow", linkedAmmoId: "deleted-arrows" },
        { id: "crossbow", name: "Crossbow", weaponAmmo: "bolt", linkedAmmoId: "arrows" },
        { id: "arrows", name: "Arrows", ammo: "arrow", quantity: 20 },
      ],
    };
    db.prepare("INSERT INTO user_characters VALUES ('hero', ?)").run(JSON.stringify(data));

    migrateInventoryIntegrity(db);
    const migrated = JSON.parse(db.prepare("SELECT character_data_json FROM user_characters WHERE id = 'hero'").pluck().get() as string);
    assert.equal(migrated.inventoryIntegrityVersion, 1);
    assert.equal(migrated.inventory[0].linkedAmmoId, "arrows", "a unique compatible replacement is retained");
    assert.equal(migrated.inventory[1].linkedAmmoId, undefined, "an incompatible link with no replacement is cleared");

    migrated.inventory[0].linkedAmmoId = "later-invalid-link";
    db.prepare("UPDATE user_characters SET character_data_json = ? WHERE id = 'hero'").run(JSON.stringify(migrated));
    migrateInventoryIntegrity(db);
    const repeated = JSON.parse(db.prepare("SELECT character_data_json FROM user_characters WHERE id = 'hero'").pluck().get() as string);
    assert.equal(repeated.inventory[0].linkedAmmoId, "later-invalid-link", "current records remain subject to strict validation");
  } finally {
    db.close();
  }
});

test("inventory integrity migration does not conceal structurally invalid inventory", () => {
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE user_characters (id TEXT PRIMARY KEY, character_data_json TEXT)");
    db.prepare("INSERT INTO user_characters VALUES ('hero', ?)").run(JSON.stringify({ inventory: { invalid: true } }));
    migrateInventoryIntegrity(db);
    const migrated = JSON.parse(db.prepare("SELECT character_data_json FROM user_characters").pluck().get() as string);
    assert.deepEqual(migrated.inventory, { invalid: true });
  } finally {
    db.close();
  }
});
