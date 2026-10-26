import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { ensureCompendiumCompositePrimaryKey } from "../../lib/migrations/compendiumPrimaryKeyMigration.js";
import { parseNativeCompendiumBatch } from "./nativeCompendium.js";
import { samples, batch } from './nativeCompendium.fixtures.js';

test("legacy Deck and Bastion entry versions migrate to the envelope", () => {
  const legacyDeck = parseNativeCompendiumBatch({
    format: "beholden.compendium", schema: "grand", category: "decks",
    entries: [{ ...samples.decks[0], schemaVersion: 2 }],
  });
  assert.equal(legacyDeck.version, 2);
  assert.equal(legacyDeck.entries[0]?.schemaVersion, undefined);

  assert.throws(() => parseNativeCompendiumBatch({
    format: "beholden.compendium", schema: "grand", category: "decks",
    entries: [{ ...samples.decks[0], schemaVersion: 1 }],
  }), /schemaVersion/u);
  assert.throws(() => parseNativeCompendiumBatch({
    format: "beholden.compendium", schema: "grand", version: 3, category: "decks",
    entries: samples.decks,
  }), /Unsupported Grand compendium version/u);
});


test("composite-key migration preserves legacy tables whose ruleset column was appended", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`
      CREATE TABLE compendium_items (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT, rarity TEXT, type TEXT,
        type_key TEXT, attunement INTEGER NOT NULL DEFAULT 0, magic INTEGER NOT NULL DEFAULT 0,
        data_json TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e'
      );
      INSERT INTO compendium_items (id, name, name_key, rarity, type, data_json, ruleset)
      VALUES ('i_backpack', 'Backpack', 'backpack', 'common', 'Adventuring Gear', '{"id":"i_backpack"}', '5.5e');

      CREATE TABLE binder_records (id TEXT PRIMARY KEY);
      CREATE TABLE mortals (id TEXT PRIMARY KEY);
      INSERT INTO binder_records (id) VALUES ('bi_pack');
      CREATE TABLE binder_items (
        id TEXT PRIMARY KEY REFERENCES binder_records(id) ON DELETE CASCADE,
        description TEXT, dm_notes TEXT,
        compendium_item_id TEXT REFERENCES compendium_items(id) ON DELETE SET NULL,
        holder_mortal_id TEXT REFERENCES mortals(id) ON DELETE SET NULL,
        location_record_id TEXT REFERENCES binder_records(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      INSERT INTO binder_items (id, compendium_item_id, created_at, updated_at)
      VALUES ('bi_pack', 'i_backpack', 1, 1);

      CREATE TABLE compendium_classes (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT, hd INTEGER,
        data_json TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e'
      );
      INSERT INTO compendium_classes (id, name, name_key, hd, data_json, ruleset)
      VALUES ('c_barbarian', 'Barbarian', 'barbarian', 12, '{"id":"c_barbarian"}', '5.5e');

      CREATE TABLE compendium_spells (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT, level INTEGER, school TEXT,
        ritual INTEGER NOT NULL DEFAULT 0, concentration INTEGER NOT NULL DEFAULT 0,
        components TEXT, classes TEXT, data_json TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e'
      );
      INSERT INTO compendium_spells (id, name, name_key, level, data_json, ruleset)
      VALUES ('s_fireball', 'Fireball', 'fireball', 3, '{"id":"s_fireball"}', '5.5e');

      CREATE TABLE compendium_class_talents (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT, kind TEXT NOT NULL,
        data_json TEXT NOT NULL, ruleset TEXT NOT NULL DEFAULT '5.5e'
      );
      INSERT INTO compendium_class_talents (id, name, name_key, kind, data_json, ruleset)
      VALUES ('ct_maneuver_ambush', 'Maneuver: Ambush', 'maneuver_ambush', 'maneuver', '{"id":"ct_maneuver_ambush"}', '5.5e');
    `);

    ensureCompendiumCompositePrimaryKey(db);

    for (const table of ["compendium_items", "compendium_classes", "compendium_spells", "compendium_class_talents"]) {
      const primaryKey = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; pk: number }>)
        .filter((column) => column.pk > 0)
        .sort((left, right) => left.pk - right.pk)
        .map((column) => column.name);
      assert.deepEqual(primaryKey, ["id", "ruleset"], `${table} should have a composite (id, ruleset) primary key`);
    }
    assert.deepEqual(
      db.prepare("SELECT id, ruleset, name, rarity FROM compendium_items").get(),
      { id: "i_backpack", ruleset: "5.5e", name: "Backpack", rarity: "common" },
    );
    assert.deepEqual(
      db.prepare("SELECT compendium_item_id, compendium_item_ruleset FROM binder_items").get(),
      { compendium_item_id: "i_backpack", compendium_item_ruleset: "5.5e" },
    );
    assert.deepEqual(
      db.prepare("SELECT id, ruleset, name, hd FROM compendium_classes").get(),
      { id: "c_barbarian", ruleset: "5.5e", name: "Barbarian", hd: 12 },
    );
    assert.deepEqual(
      db.prepare("SELECT id, ruleset, name, level FROM compendium_spells").get(),
      { id: "s_fireball", ruleset: "5.5e", name: "Fireball", level: 3 },
    );
    assert.deepEqual(
      db.prepare("SELECT id, ruleset, name, kind FROM compendium_class_talents").get(),
      { id: "ct_maneuver_ambush", ruleset: "5.5e", name: "Maneuver: Ambush", kind: "maneuver" },
    );
  } finally {
    db.close();
  }
});


test("native batch parser rejects foreign formats and mixed envelopes", () => {
  assert.throws(
    () => parseNativeCompendiumBatch({ format: "other", schema: "grand", category: "items", entries: [] }),
    /Expected format/u,
  );
  assert.throws(
    () => parseNativeCompendiumBatch({ format: "beholden.compendium", schema: "grand", category: "everything", entries: [] }),
    /Unknown compendium category/u,
  );
});


test("native batch parser rejects earlier non-Grand spell exports", () => {
  const obsoleteV2Spell: Record<string, unknown> = {
    ...structuredClone(samples.spells[0]!),
    schemaVersion: 2,
    source: null,
    ritual: false,
    tags: [],
    rolls: [],
    casting: {
      ...structuredClone(samples.spells[0]!.casting as Record<string, unknown>),
      components: {
        verbal: true,
        somatic: true,
        material: { required: false, description: null },
      },
      duration: { description: "Instantaneous", concentration: false },
    },
  };
  obsoleteV2Spell.school = "EV";
  obsoleteV2Spell.source = null;
  obsoleteV2Spell.classes = ["School: Evocation", "Wizard", "Wizard"];
  (obsoleteV2Spell.casting as Record<string, unknown>).time = "Action";
  ((obsoleteV2Spell.casting as Record<string, unknown>).duration as Record<string, unknown>).description =
    "Concentration, up to 10 minute";
  obsoleteV2Spell.description = ["A spell.\n\nSource:\tTest Grimoire p. 12"];

  assert.throws(
    () => parseNativeCompendiumBatch(batch("spells", [obsoleteV2Spell])),
    /invalid/u,
  );
});


test("legacy duplicated feat metadata is promoted and stored once", () => {
  const source: Record<string, unknown> = { ...samples.feats[0]!, source: undefined, prerequisite: undefined };
  const parsed = parseNativeCompendiumBatch(batch("feats", [{
    ...source,
    mechanics: { ...(source.mechanics as Record<string, unknown> ?? {}), source: "Legacy Book", prerequisite: "Dexterity 13 or higher", repeatable: true },
  }])).entries[0]!;
  assert.equal(parsed.source, "Legacy Book");
  assert.equal(parsed.prerequisite, "Dexterity 13 or higher");
  assert.equal(parsed.repeatable, true);
  assert.equal((parsed.mechanics as Record<string, unknown> | undefined)?.source, undefined);
  assert.equal((parsed.mechanics as Record<string, unknown> | undefined)?.prerequisite, undefined);
});


test("legacy class description fields migrate to one descriptions array", () => {
  const source = { ...samples.classes[0]!, description: "Primary class lore.", descriptions: ["Primary class lore."] };
  const parsed = parseNativeCompendiumBatch(batch("classes", [source])).entries[0]!;
  assert.deepEqual(parsed.descriptions, ["Primary class lore."]);
  assert.equal(parsed.description, undefined);
});
