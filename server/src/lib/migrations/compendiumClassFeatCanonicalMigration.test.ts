import assert from "node:assert/strict";
import test from "node:test";
import { openDb } from "../db.js";
import { parseStoredGrandEntry } from "../../services/compendium/storedCompendium.js";
import { canonicalizeStoredClassesAndFeats } from "./compendiumClassFeatCanonicalMigration.js";

// Shapes found in a real database imported before classes/feats were canonicalized.
const legacyClass = {
  id: "c_test", ruleset: "5e", name: "Tester", description: "First paragraph.",
  descriptions: ["First paragraph.", "Second paragraph."],
  hitDie: 8,
  proficiencies: { savingThrows: ["str"], skills: { choose: 0, from: [] }, armor: [], weapons: [] },
  levels: [{ level: 1 }],
};
const legacyFeat = {
  id: "f_test", ruleset: "5e", name: "Test Feat", description: "Text.",
  mechanics: { prerequisite: "Dexterity 13 or higher", resolution: "manual" },
};

test("stored classes and feats in the old shape are rewritten so they load again", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("INSERT INTO compendium_classes (id, ruleset, name, data_json) VALUES ('c_test', '5e', 'Tester', ?)").run(JSON.stringify(legacyClass));
    db.prepare("INSERT INTO compendium_feats (id, ruleset, name, data_json) VALUES ('f_test', '5e', 'Test Feat', ?)").run(JSON.stringify(legacyFeat));
    const read = (table: string) => String(db.prepare(`SELECT data_json FROM ${table}`).pluck().get());
    assert.throws(() => parseStoredGrandEntry("classes", read("compendium_classes")), "old class shape fails before migration");

    canonicalizeStoredClassesAndFeats(db);

    const cls = parseStoredGrandEntry("classes", read("compendium_classes"));
    assert.deepEqual(cls.descriptions, ["First paragraph.", "Second paragraph."]);
    assert.equal("description" in cls, false);
    const feat = parseStoredGrandEntry("feats", read("compendium_feats"));
    assert.equal(feat.prerequisite, "Dexterity 13 or higher");
    assert.equal(feat.resolution, "manual");
    assert.equal(db.prepare("SELECT content_hash FROM compendium_feats").pluck().get() != null, true, "hash is refreshed");

    // Running again changes nothing.
    const before = read("compendium_feats");
    canonicalizeStoredClassesAndFeats(db);
    assert.equal(read("compendium_feats"), before);
  } finally {
    db.close();
  }
});
