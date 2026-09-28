import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { migrateCharacterProgression } from "./characterProgressionMigration.js";

test("character progression migration canonicalizes unambiguous beta records once", () => {
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE user_characters (id TEXT PRIMARY KEY, class_name TEXT, level INTEGER, hp_max INTEGER, con_score INTEGER, character_data_json TEXT)");
    db.prepare("INSERT INTO user_characters VALUES (?, ?, ?, ?, ?, ?)").run("hero", "Cleric", 8, 52, 16, JSON.stringify({
      hd: 8, classes: [{ classId: "cleric", className: "Cleric", level: 8 }], chosenSpells: ["bless"], preparedSpells: ["bless"],
      chosenLevelUpFeats: [{ level: 4, type: "asi", abilityBonuses: { wis: 2 } }],
    }));
    migrateCharacterProgression(db);
    migrateCharacterProgression(db);
    const row = db.prepare("SELECT character_data_json FROM user_characters WHERE id = 'hero'").get() as { character_data_json: string };
    const data = JSON.parse(row.character_data_json);
    assert.equal(data.progressionSchemaVersion, 2);
    assert.equal(data.classes[0].id, "class_cleric");
    assert.equal(data.chosenLevelUpFeats[0].classEntryId, "class_cleric");
    assert.deepEqual(data.classSpellSelections.class_cleric.preparedSpells, ["bless"]);
    assert.equal(data.hpProgressionHistory[0].hpMethod, "manual");
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM character_progression_migration_report").get() as { count: number }).count, 0);
  } finally { db.close(); }
});

test("character progression migration reports ambiguous multiclass ownership without guessing", () => {
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE user_characters (id TEXT PRIMARY KEY, class_name TEXT, level INTEGER, hp_max INTEGER, con_score INTEGER, character_data_json TEXT)");
    db.prepare("INSERT INTO user_characters VALUES (?, ?, ?, ?, ?, ?)").run("multi", "Fighter / Wizard", 5, 40, 14, JSON.stringify({
      classes: [{ classId: "fighter", level: 4 }, { classId: "wizard", level: 1 }], chosenLevelUpFeats: [{ level: 4, type: "feat", featId: "alert" }],
    }));
    migrateCharacterProgression(db);
    const issues = db.prepare("SELECT issue_code FROM character_progression_migration_report ORDER BY issue_code").all() as Array<{ issue_code: string }>;
    assert.deepEqual(issues.map((entry) => entry.issue_code), ["ambiguous-feat-ownership", "ambiguous-hp-ownership"]);
    const row = db.prepare("SELECT character_data_json FROM user_characters WHERE id = 'multi'").get() as { character_data_json: string };
    const data = JSON.parse(row.character_data_json);
    assert.equal(data.chosenLevelUpFeats[0].classEntryId, undefined);
    assert.equal(data.hpProgressionHistory, undefined);
  } finally { db.close(); }
});
