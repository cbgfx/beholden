import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { characterProgressionEligibilityProblem } from "./characterProgressionEligibility.js";

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE compendium_feats (id TEXT, ruleset TEXT, name TEXT, data_json TEXT);
    CREATE TABLE compendium_class_talents (id TEXT, ruleset TEXT, name TEXT, kind TEXT, data_json TEXT);
    CREATE TABLE compendium_classes (id TEXT, ruleset TEXT, data_json TEXT);
    CREATE TABLE compendium_spells (id TEXT, ruleset TEXT, level INTEGER, data_json TEXT);
  `);
  db.prepare("INSERT INTO compendium_feats VALUES (?, ?, ?, ?)").run("f_eligible", "5.5e", "Eligible", JSON.stringify({ id: "f_eligible", prerequisite: { level: 4, ability: { any: ["wis"], min: 13 } } }));
  db.prepare("INSERT INTO compendium_feats VALUES (?, ?, ?, ?)").run("f_once", "5.5e", "Once", JSON.stringify({ id: "f_once" }));
  db.prepare("INSERT INTO compendium_feats VALUES (?, ?, ?, ?)").run("f_choice", "5.5e", "Choice Feat", JSON.stringify({ id: "f_choice", name: "Choice Feat", mechanics: { choices: [{ id: "skill", count: 1, options: ["Arcana", "History"] }] } }));
  db.prepare("INSERT INTO compendium_classes VALUES (?, ?, ?)").run("wizard", "5.5e", JSON.stringify({ id: "wizard", levels: [{ level: 4, abilityScoreImprovement: true }] }));
  db.prepare("INSERT INTO compendium_class_talents VALUES (?, ?, ?, ?, ?)").run("ct_high", "5.5e", "High Invocation", "invocation", JSON.stringify({ id: "ct_high", prerequisite: { level: 5 } }));
  db.prepare("INSERT INTO compendium_class_talents VALUES (?, ?, ?, ?, ?)").run("ct_repeat", "5.5e", "Repeat", "invocation", JSON.stringify({ id: "ct_repeat", repeatable: true }));
  return db;
}

const args = (characterData: Record<string, unknown>, level = 4) => ({
  ruleset: "5.5e" as const, level, scores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 }, characterData: { progressionSchemaVersion: 2, ...characterData },
});

test("progression eligibility leaves beta records to the explicit repair boundary", () => {
  const db = fixture();
  try {
    assert.equal(characterProgressionEligibilityProblem(db, {
      ...args({}), characterData: { classes: [{ id: "legacy", classId: "missing", level: 4 }] },
    }), null);
  } finally { db.close(); }
});

test("progression eligibility accepts canonical eligible feats and repeatable invocations", () => {
  const db = fixture();
  try {
    assert.equal(characterProgressionEligibilityProblem(db, args({
      classes: [{ id: "warlock", className: "Warlock", level: 5 }], extraFeatIds: ["f_eligible"],
      classSpellSelections: { warlock: { chosenInvocations: ["ct_repeat", "ct_repeat"] } }, proficiencies: {},
    }, 5)), null);
  } finally { db.close(); }
});

test("progression eligibility rejects unknown, duplicate, and level-ineligible selections", () => {
  const db = fixture();
  try {
    assert.match(characterProgressionEligibilityProblem(db, args({ classes: [{ id: "warlock", level: 4 }], extraFeatIds: ["missing"], proficiencies: {} })) ?? "", /does not exist/u);
    assert.match(characterProgressionEligibilityProblem(db, args({ classes: [{ id: "warlock", level: 4 }], extraFeatIds: ["f_once", "f_once"], proficiencies: {} })) ?? "", /more than once/u);
    assert.match(characterProgressionEligibilityProblem(db, args({ classes: [{ id: "warlock", level: 4 }], classSpellSelections: { warlock: { chosenInvocations: ["ct_high"] } }, proficiencies: {} })) ?? "", /class level 5/u);
  } finally { db.close(); }
});

test("progression eligibility enforces canonical ASI levels and feat options", () => {
  const db = fixture();
  try {
    const classes = [{ id: "wizard-entry", classId: "wizard", className: "Wizard", level: 5 }];
    assert.equal(characterProgressionEligibilityProblem(db, args({
      classes,
      chosenLevelUpFeats: [{ type: "feat", featId: "f_choice", classEntryId: "wizard-entry", classLevel: 4, characterLevel: 4 }],
      chosenFeatOptions: { "levelupfeat:4:f_choice:skill": ["Arcana"] },
      proficiencies: {},
    }, 5)), null);
    assert.match(characterProgressionEligibilityProblem(db, args({
      classes,
      chosenLevelUpFeats: [{ type: "feat", featId: "f_choice", classEntryId: "wizard-entry", classLevel: 3, characterLevel: 3 }],
      chosenFeatOptions: { "levelupfeat:3:f_choice:skill": ["Arcana"] },
      proficiencies: {},
    }, 5)) ?? "", /does not grant/u);
    assert.match(characterProgressionEligibilityProblem(db, args({
      classes,
      chosenLevelUpFeats: [{ type: "feat", featId: "f_choice", classEntryId: "wizard-entry", classLevel: 4, characterLevel: 4 }],
      chosenFeatOptions: {},
      proficiencies: {},
    }, 5)) ?? "", /requires 1 selection/u);
    assert.match(characterProgressionEligibilityProblem(db, args({
      classes,
      chosenLevelUpFeats: [{ type: "feat", featId: "f_choice", classEntryId: "wizard-entry", classLevel: 4, characterLevel: 4 }],
      chosenFeatOptions: { "levelupfeat:4:f_choice:skill": ["Stealth"] },
      proficiencies: {},
    }, 5)) ?? "", /invalid selection/u);
  } finally { db.close(); }
});

test("progression eligibility grandfathers an unchanged beta feat choice but validates edits", () => {
  const db = fixture();
  try {
    const stored = {
      progressionSchemaVersion: 3,
      classes: [{ id: "wizard-entry", classId: "wizard", className: "Wizard", level: 5 }],
      chosenLevelUpFeats: [{ type: "feat", featId: "f_choice", classEntryId: "wizard-entry", classLevel: 4, characterLevel: 4 }],
      chosenFeatOptions: {}, proficiencies: {},
    };
    assert.equal(characterProgressionEligibilityProblem(db, { ...args(stored, 5), previousCharacterData: stored }), null);
    assert.match(characterProgressionEligibilityProblem(db, {
      ...args({ ...stored, chosenFeatOptions: { "levelupfeat:4:f_choice:skill": ["Stealth"] } }, 5),
      previousCharacterData: stored,
    }) ?? "", /invalid selection/u);
  } finally { db.close(); }
});
