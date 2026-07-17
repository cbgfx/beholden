import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { migrateLiveCompendiumReferences } from "./liveReferenceMigration.js";

function database(): Database.Database {
  const db = new Database(":memory:");
  for (const table of ["monsters", "items", "spells", "class_talents", "classes", "races", "backgrounds", "feats"]) db.exec(`CREATE TABLE compendium_${table} (id TEXT PRIMARY KEY)`);
  db.exec(`
    CREATE TABLE user_characters (id TEXT PRIMARY KEY, character_data_json TEXT);
    CREATE TABLE players (id TEXT PRIMARY KEY, live_json TEXT);
    CREATE TABLE combatants (id TEXT PRIMARY KEY, base_id TEXT, snapshot_json TEXT, live_json TEXT);
    CREATE TABLE bastions (id TEXT PRIMARY KEY, facilities_json TEXT);
    CREATE TABLE inpcs (id TEXT PRIMARY KEY, monster_id TEXT);
    CREATE TABLE treasure (id TEXT PRIMARY KEY, item_id TEXT);
    CREATE TABLE party_inventory (id TEXT PRIMARY KEY, item_id TEXT);
  `);
  db.prepare("INSERT INTO compendium_races (id) VALUES (?)").run("r_elf_wood");
  db.prepare("INSERT INTO compendium_items (id) VALUES (?)").run("i_scholars_pack");
  db.prepare("INSERT INTO compendium_monsters (id) VALUES (?)").run("m_bandit_crime_lord");
  return db;
}

test("previews and transactionally rewrites only resolvable canonical IDs", () => {
  const db = database();
  db.prepare("INSERT INTO user_characters VALUES (?, ?)").run("char", JSON.stringify({
    raceId: "r_elf,_wood",
    inventory: [{ itemId: "i_scholar's_pack" }, { itemId: "i_missing's_item" }],
    chosenFeatOptions: { "levelup:2:i_scholar's_pack": ["i_scholar's_pack"] },
  }));
  db.prepare("INSERT INTO party_inventory VALUES (?, ?)").run("party", "i_scholar's_pack");
  const preview = migrateLiveCompendiumReferences(db, false);
  assert.equal(preview.changedRows, 2);
  assert.equal(preview.changedReferences, 5);
  assert.equal(db.prepare("SELECT item_id FROM party_inventory WHERE id = 'party'").pluck().get(), "i_scholar's_pack");
  assert.equal(migrateLiveCompendiumReferences(db, true).changedReferences, 5);
  assert.equal(db.prepare("SELECT item_id FROM party_inventory WHERE id = 'party'").pluck().get(), "i_scholars_pack");
  const data = JSON.parse(String(db.prepare("SELECT character_data_json FROM user_characters WHERE id = 'char'").pluck().get()));
  assert.equal(data.raceId, "r_elf_wood");
  assert.equal(data.inventory[0].itemId, "i_scholars_pack");
  assert.equal(data.inventory[1].itemId, "i_missing's_item");
  assert.deepEqual(data.chosenFeatOptions["levelup:2:i_scholars_pack"], ["i_scholars_pack"]);
  assert.equal(migrateLiveCompendiumReferences(db, false).changedReferences, 0);
  db.close();
});

test("applies approved one-time aliases to live monster references", () => {
  const db = database();
  db.prepare("INSERT INTO inpcs VALUES (?, ?)").run("brynja", "m_bandit lord");
  const preview = migrateLiveCompendiumReferences(db, false);
  assert.equal(preview.changedReferences, 1);
  assert.equal(preview.changes[0]?.to, "m_bandit_crime_lord");
  migrateLiveCompendiumReferences(db, true);
  assert.equal(db.prepare("SELECT monster_id FROM inpcs WHERE id = 'brynja'").pluck().get(), "m_bandit_crime_lord");
  db.close();
});

test("refuses to run before a canonical compendium is loaded", () => {
  const db = database();
  db.exec("DELETE FROM compendium_races; DELETE FROM compendium_items; DELETE FROM compendium_monsters;");
  assert.throws(() => migrateLiveCompendiumReferences(db, false), /Import the canonical compendium/);
  db.close();
});
