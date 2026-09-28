/**
 * Hit dice move from "how many are left" (a total and a per-size count, two copies) to "how many
 * are spent", keyed by die size. What is left then follows the maximum: a level-up adds a usable
 * die instead of leaving the stored count one short.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { foldLegacyHitDice } from "@beholden/shared/domain/hitDice";
import { openDb } from "../db.js";
import { migrateHitDiceSpent } from "./hitDiceSpentMigration.js";

const maxima = (entries: Array<[number, number]>) => new Map(entries);

test("left counts become spent counts, and the two old copies are gone", () => {
  const folded = foldLegacyHitDice({ hitDiceCurrent: 5, hitDiceCurrentBySize: { "10": 3, "6": 2 } }, maxima([[10, 5], [6, 2]]));
  assert.deepEqual(folded, { hitDiceSpent: { "10": 2 } });
});

test("a character at full keeps nothing stored", () => {
  assert.deepEqual(foldLegacyHitDice({ hitDiceCurrent: 12, hitDiceCurrentBySize: { "8": 12 } }, maxima([[8, 12]])), {});
});

test("the old total is used only for a single die size", () => {
  assert.deepEqual(foldLegacyHitDice({ hitDiceCurrent: 3 }, maxima([[12, 8]])), { hitDiceSpent: { "12": 5 } });
  assert.deepEqual(foldLegacyHitDice({ hitDiceCurrent: 3 }, maxima([[10, 3], [6, 2]])), {}, "a total cannot be split between sizes");
});

test("a die size whose maximum is unknown counts nothing as spent", () => {
  assert.deepEqual(foldLegacyHitDice({ hitDiceCurrentBySize: { "8": 1 } }, maxima([])), {});
});

test("the migration uses each class's die from the compendium, or the stored die for a single class", () => {
  const db = openDb(":memory:");
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('u', 'u', 'x', 'U', 0, ?, ?)").run(t, t);
  const insert = db.prepare("INSERT INTO user_characters (id, user_id, name, ruleset, character_data_json, created_at, updated_at) VALUES (?, 'u', ?, '5.5e', ?, ?, ?)");
  // Not in the compendium: falls back to the stored `hd`. Two of eight d12s used.
  insert.run("barbarian", "Barbarian", JSON.stringify({
    progressionSchemaVersion: 3, hd: 12, classes: [{ id: "b", classId: "c_barbarian", className: "Barbarian", level: 8 }],
    hitDiceCurrent: 6, hitDiceCurrentBySize: { "12": 6 },
  }), t, t);
  insert.run("rested", "Rested", JSON.stringify({ progressionSchemaVersion: 3, hd: 8, classes: [{ id: "c", classId: "c_cleric", level: 8 }], hitDiceCurrent: 8, hitDiceCurrentBySize: { "8": 8 } }), t, t);
  insert.run("broken", "Broken", "{not json", t, t);

  migrateHitDiceSpent(db);
  const read = (id: string) => (db.prepare("SELECT character_data_json AS j FROM user_characters WHERE id = ?").get(id) as { j: string }).j;
  const barbarian = JSON.parse(read("barbarian"));
  assert.deepEqual(barbarian.hitDiceSpent, { "12": 2 });
  assert.equal("hitDiceCurrent" in barbarian || "hitDiceCurrentBySize" in barbarian, false);
  const rested = JSON.parse(read("rested"));
  assert.equal("hitDiceSpent" in rested || "hitDiceCurrent" in rested, false);
  assert.equal(read("broken"), "{not json");

  const before = read("barbarian");
  migrateHitDiceSpent(db);
  assert.equal(read("barbarian"), before, "a second run changes nothing");
  db.close();
});
