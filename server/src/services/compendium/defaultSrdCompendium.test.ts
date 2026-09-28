import assert from "node:assert/strict";
import test from "node:test";
import { openDb } from "../../lib/db.js";
import { generateDefaultSrdCompendium, seedDefaultSrdCompendium } from "./defaultSrdCompendium.js";

test("default SRD seeding runs once and preserves later edits and deletions", () => {
  const db = openDb(":memory:");
  try {
    const first = seedDefaultSrdCompendium(db);
    assert.equal(first.imported, 2012);

    db.prepare(`
      UPDATE compendium_items
      SET name = 'Customized Acid', data_json = '{"id":"i_acid","ruleset":"5.5e","name":"Customized Acid"}'
      WHERE id = 'i_acid' AND ruleset = '5.5e'
    `).run();
    db.prepare("DELETE FROM compendium_spells WHERE id = 's_acid_splash' AND ruleset = '5.5e'").run();

    const second = seedDefaultSrdCompendium(db);
    assert.equal(second.imported, 0);
    assert.equal(
      db.prepare("SELECT name FROM compendium_items WHERE id = 'i_acid' AND ruleset = '5.5e'").pluck().get(),
      "Customized Acid",
    );
    assert.equal(db.prepare("SELECT 1 FROM compendium_spells WHERE id = 's_acid_splash' AND ruleset = '5.5e'").get(), undefined);
  } finally {
    db.close();
  }
});

test("manual SRD generation restores missing entries without replacing edits", () => {
  const db = openDb(":memory:");
  try {
    seedDefaultSrdCompendium(db);
    db.prepare(`
      UPDATE compendium_items
      SET name = 'Customized Acid', data_json = '{"id":"i_acid","ruleset":"5.5e","name":"Customized Acid"}'
      WHERE id = 'i_acid' AND ruleset = '5.5e'
    `).run();
    db.prepare("DELETE FROM compendium_spells WHERE id = 's_acid_splash' AND ruleset = '5.5e'").run();

    const generated = generateDefaultSrdCompendium(db);
    assert.equal(generated.imported, 1);
    assert.equal(
      db.prepare("SELECT name FROM compendium_items WHERE id = 'i_acid' AND ruleset = '5.5e'").pluck().get(),
      "Customized Acid",
    );
    assert.ok(db.prepare("SELECT 1 FROM compendium_spells WHERE id = 's_acid_splash' AND ruleset = '5.5e'").get());
  } finally {
    db.close();
  }
});

test("startup backfills newly-scoped modifiers into matching legacy SRD items", () => {
  const db = openDb(":memory:");
  try {
    seedDefaultSrdCompendium(db);
    const row = db.prepare("SELECT data_json FROM compendium_items WHERE id = 'i_bracers_of_archery' AND ruleset = '5.5e'").get() as { data_json: string };
    const legacy = JSON.parse(row.data_json);
    delete legacy.modifiers[0].weaponNames;
    db.prepare("UPDATE compendium_items SET data_json = ? WHERE id = 'i_bracers_of_archery' AND ruleset = '5.5e'").run(JSON.stringify(legacy));
    const defenseRow = db.prepare("SELECT data_json FROM compendium_items WHERE id = 'i_bracers_of_defense' AND ruleset = '5.5e'").get() as { data_json: string };
    const legacyDefense = JSON.parse(defenseRow.data_json);
    delete legacyDefense.modifiers[0].requiresNoArmor;
    delete legacyDefense.modifiers[0].requiresNoShield;
    db.prepare("UPDATE compendium_items SET data_json = ? WHERE id = 'i_bracers_of_defense' AND ruleset = '5.5e'").run(JSON.stringify(legacyDefense));
    const staffRow = db.prepare("SELECT data_json FROM compendium_items WHERE id = 'i_quarterstaff_of_the_acrobat' AND ruleset = '5.5e'").get() as { data_json: string };
    const legacyStaff = JSON.parse(staffRow.data_json);
    legacyStaff.modifiers.unshift({ target: "ac", amount: 5 });
    db.prepare("UPDATE compendium_items SET data_json = ? WHERE id = 'i_quarterstaff_of_the_acrobat' AND ruleset = '5.5e'").run(JSON.stringify(legacyStaff));
    db.prepare("DELETE FROM application_metadata WHERE key = 'default_srd_modifier_metadata_v2'").run();

    seedDefaultSrdCompendium(db);
    const updated = JSON.parse((db.prepare("SELECT data_json FROM compendium_items WHERE id = 'i_bracers_of_archery' AND ruleset = '5.5e'").get() as { data_json: string }).data_json);
    assert.deepEqual(updated.modifiers[0].weaponNames, ["Longbow", "Shortbow"]);
    const updatedDefense = JSON.parse((db.prepare("SELECT data_json FROM compendium_items WHERE id = 'i_bracers_of_defense' AND ruleset = '5.5e'").get() as { data_json: string }).data_json);
    assert.equal(updatedDefense.modifiers[0].requiresNoArmor, true);
    assert.equal(updatedDefense.modifiers[0].requiresNoShield, true);
    const updatedStaff = JSON.parse((db.prepare("SELECT data_json FROM compendium_items WHERE id = 'i_quarterstaff_of_the_acrobat' AND ruleset = '5.5e'").get() as { data_json: string }).data_json);
    assert.equal(updatedStaff.modifiers.some((modifier: { target: string; amount: number }) => modifier.target === "ac" && modifier.amount === 5), false);
  } finally {
    db.close();
  }
});
