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
