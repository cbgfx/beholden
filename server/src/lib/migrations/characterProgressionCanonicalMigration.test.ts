import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { migrateCanonicalCharacterProgression } from "./characterProgressionCanonicalMigration.js";

function database() {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE user_characters (id TEXT PRIMARY KEY, character_data_json TEXT)");
  return db;
}

test("moves clean schema-v2 records to the canonical spell-selection shape", () => {
  const db = database();
  const scoped = { cleric: { chosenCantrips: ["guidance"], chosenSpells: ["bless"], chosenInvocations: [] } };
  db.prepare("INSERT INTO user_characters VALUES (?, ?)").run("diego", JSON.stringify({ progressionSchemaVersion: 2, chosenCantrips: ["wrong"], chosenSpells: ["wrong"], chosenInvocations: ["wrong"], classSpellSelections: scoped }));
  migrateCanonicalCharacterProgression(db);
  migrateCanonicalCharacterProgression(db);
  const row = db.prepare("SELECT character_data_json json FROM user_characters WHERE id = 'diego'").get() as { json: string };
  const data = JSON.parse(row.json);
  assert.equal(data.progressionSchemaVersion, 3);
  assert.deepEqual(data.classSpellSelections, scoped);
  assert.equal("chosenSpells" in data, false);
  assert.equal("chosenCantrips" in data, false);
  assert.equal("chosenInvocations" in data, false);
  db.close();
});

test("keeps ambiguous records intact until their explicit reset", () => {
  const db = database();
  const original = { progressionSchemaVersion: 2, chosenSpells: ["evidence"], progressionRepairIssues: [{ code: "ambiguous-hp-ownership" }] };
  db.prepare("INSERT INTO user_characters VALUES (?, ?)").run("ambiguous", JSON.stringify(original));
  migrateCanonicalCharacterProgression(db);
  const row = db.prepare("SELECT character_data_json json FROM user_characters").get() as { json: string };
  assert.deepEqual(JSON.parse(row.json), original);
  db.close();
});
