/**
 * Prepared spells move onto the spell entries (`prepared: true` in `proficiencies.spells`), and the
 * name lists that used to hold them - top-level `preparedSpells` and
 * `classSpellSelections[class].preparedSpells` - are deleted. One fact, one place.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { foldLegacyPreparedSpells } from "@beholden/shared/domain/spellPreparation";
import { openDb } from "../db.js";
import { migratePreparedSpellFlags } from "./preparedSpellFlagMigration.js";

type Spell = { name: string; classEntryId?: string; prepared?: boolean };
const prepared = (data: Record<string, unknown> | null) =>
  ((data?.proficiencies as { spells: Spell[] }).spells).filter((spell) => spell.prepared).map((spell) => spell.name);

test("each class's list marks that class's spells, and the lists are gone", () => {
  const folded = foldLegacyPreparedSpells({
    proficiencies: { spells: [
      { name: "Bless", classEntryId: "cleric" },
      { name: "Aid", classEntryId: "cleric" },
      { name: "Shield", classEntryId: "wizard" },
      { name: "Fireball", classEntryId: "wizard" },
    ] },
    classSpellSelections: {
      cleric: { chosenSpells: ["bless", "aid"], preparedSpells: ["bless"] },
      wizard: { chosenSpells: ["shield"], preparedSpells: ["shield"] },
    },
    preparedSpells: ["bless", "shield"],
  });
  assert.deepEqual(prepared(folded), ["Bless", "Shield"]);
  assert.equal("preparedSpells" in folded!, false);
  assert.deepEqual(folded!.classSpellSelections, { cleric: { chosenSpells: ["bless", "aid"] }, wizard: { chosenSpells: ["shield"] } },
    "the rest of each class's selection is kept");
});

test("a spell with no class is prepared by any class's list; a name with no spell was a leftover and is dropped", () => {
  const folded = foldLegacyPreparedSpells({
    proficiencies: { spells: [{ name: "Detect Magic" }, { name: "Mage Armor [Wizard]" }] },
    classSpellSelections: { wizard: { preparedSpells: ["detectmagic", "magearmor", "removedspell"] } },
  });
  assert.deepEqual(prepared(folded), ["Detect Magic", "Mage Armor [Wizard]"]);
  assert.equal(JSON.stringify(folded).includes("removedspell"), false);
});

test("a top-level list that drifted from the class lists does not prepare anything the sheet showed as unprepared", () => {
  // Found in the live database: adding a spell once wrote only the top-level copy.
  const folded = foldLegacyPreparedSpells({
    proficiencies: { spells: [{ name: "Shield", classEntryId: "wizard" }, { name: "Arcane Eye", classEntryId: "wizard" }] },
    classSpellSelections: { wizard: { preparedSpells: ["shield"] } },
    preparedSpells: ["shield", "arcaneeye"],
  });
  assert.deepEqual(prepared(folded), ["Shield"]);
});

test("with no class lists at all, the top-level list is what was prepared", () => {
  const folded = foldLegacyPreparedSpells({
    proficiencies: { spells: [{ name: "Bless" }, { name: "Aid" }] },
    preparedSpells: ["aid"],
  });
  assert.deepEqual(prepared(folded), ["Aid"]);
});

test("an old tab's un-prepare sticks: where a list covers a spell, the list decides", () => {
  const folded = foldLegacyPreparedSpells({
    proficiencies: { spells: [
      { name: "Bless", classEntryId: "cleric", prepared: true },
      { name: "Shield", classEntryId: "wizard", prepared: true },
    ] },
    // Only the cleric's list was sent, without Bless: Bless is unprepared, Shield is untouched.
    classSpellSelections: { cleric: { preparedSpells: [] } },
  });
  assert.deepEqual(prepared(folded), ["Shield"]);
});

test("data without the old lists is left alone", () => {
  assert.equal(foldLegacyPreparedSpells({ proficiencies: { spells: [{ name: "Bless", prepared: true }] }, classSpellSelections: { cleric: { chosenSpells: [] } } }), null);
});

test("the migration folds every character once, and leaves unreadable data as it is", () => {
  const db = openDb(":memory:");
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('u', 'u', 'x', 'U', 0, ?, ?)").run(t, t);
  const insert = db.prepare("INSERT INTO user_characters (id, user_id, name, character_data_json, created_at, updated_at) VALUES (?, 'u', ?, ?, ?, ?)");
  insert.run("legacy", "Legacy", JSON.stringify({
    progressionSchemaVersion: 2,
    classes: [{ id: "cleric", classId: "cleric", className: "Cleric", level: 3 }],
    proficiencies: { spells: [{ name: "Bless", classEntryId: "cleric" }, { name: "Aid", classEntryId: "cleric" }] },
    classSpellSelections: { cleric: { preparedSpells: ["bless"] } },
    preparedSpells: ["bless"],
  }), t, t);
  insert.run("broken", "Broken", "{not json", t, t);

  migratePreparedSpellFlags(db);
  const read = (id: string) => (db.prepare("SELECT character_data_json AS j FROM user_characters WHERE id = ?").get(id) as { j: string }).j;
  const data = JSON.parse(read("legacy")) as Record<string, unknown>;
  assert.deepEqual(prepared(data), ["Bless"]);
  assert.equal("preparedSpells" in data, false);
  assert.equal(read("broken"), "{not json");

  const before = read("legacy");
  migratePreparedSpellFlags(db);
  assert.equal(read("legacy"), before, "a second run changes nothing");
  db.close();
});
