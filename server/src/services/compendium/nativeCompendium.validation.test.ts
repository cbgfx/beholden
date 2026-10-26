import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { exportNativeCompendiumBatch, importNativeCompendiumBatch, importNativeCompendiumDocument, previewNativeCompendiumDocument } from "./nativeCompendium.js";
import { samples, batch } from './nativeCompendium.fixtures.js';

test("import guardrails reject unresolved references without partial writes", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const monster = structuredClone(samples.monsters[0]!);
    monster.spells = [{ id: "s_missing_spell" }];
    const document = {
      format: "beholden.compendium", schema: "grand",
      items: samples.items,
      monsters: [monster],
    };
    assert.throws(() => importNativeCompendiumDocument(db, document), /unknown spell "s_missing_spell"/u);
    assert.equal(exportNativeCompendiumBatch(db, "items").entries.length, 0);
    assert.equal(exportNativeCompendiumBatch(db, "monsters").entries.length, 0);
  } finally { db.close(); }
});


test("import guardrails reject unresolved item spell IDs", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const item = { ...structuredClone(samples.items[0]!), spells: { s_missing_spell: 1 } };
    const document = {
      format: "beholden.compendium", schema: "grand",
      items: [item],
    };
    assert.throws(() => importNativeCompendiumDocument(db, document), /unknown spell "s_missing_spell"/u);
    assert.equal(exportNativeCompendiumBatch(db, "items").entries.length, 0);
  } finally { db.close(); }
});


test("import guardrails require explicit, resolvable background item IDs", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const background = {
      ...samples.backgrounds[0],
      equipment: { description: "Starting gear", options: [{ id: "A", entries: [
        { kind: "item", name: "Imaginary Blade", quantity: 1 },
      ] }] },
    };
    assert.throws(() => importNativeCompendiumDocument(db, batch("backgrounds", [background])), /itemId/u);
    const unresolved = {
      ...background,
      equipment: { description: "Starting gear", options: [{ id: "A", entries: [
        { kind: "item", itemId: "i_missing_blade", quantity: 1 },
      ] }] },
    };
    assert.throws(() => previewNativeCompendiumDocument(db, batch("backgrounds", [unresolved])), /unknown item id "i_missing_blade"/u);
  } finally { db.close(); }
});


test("import guardrails reject a background equipment sourceLabel that duplicates the catalog item name", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    importNativeCompendiumBatch(db, batch("items"));
    const withEquipment = (sourceLabel: string) => ({
      ...samples.backgrounds[0],
      equipment: { options: [{ id: "A", entries: [
        { kind: "item", itemId: "i_test_blade", quantity: 1, sourceLabel },
      ] }] },
    });
    // A label identical to the catalog name is a duplicated fact â€” the API projects it at read time.
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("backgrounds", [withEquipment("Test Blade")])),
      /duplicates the catalog name of i_test_blade/u,
    );
    // A label that intentionally differs (flavor/display ordering) is a real fact and passes.
    const preview = previewNativeCompendiumDocument(db, batch("backgrounds", [withEquipment("Blade (ceremonial)")]));
    assert.equal(preview.entries, 1);
  } finally { db.close(); }
});


test("import guardrails allow a uniquely shared item from the other ruleset", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    importNativeCompendiumBatch(db, batch("items", [{ ...samples.items[0], ruleset: "5e" }]));
    const background = {
      ...samples.backgrounds[0],
      ruleset: "5.5e",
      equipment: { options: [{ id: "A", entries: [
        { kind: "item", itemId: "i_test_blade", quantity: 1, sourceLabel: "Ceremonial blade" },
      ] }] },
    };
    assert.doesNotThrow(() => previewNativeCompendiumDocument(db, batch("backgrounds", [background])));
  } finally { db.close(); }
});


test("import guardrails reject unresolved Background Feat references", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const background = structuredClone(samples.backgrounds[0]!);
    (background.proficiencies as Record<string, unknown>).feat = "f_missing_origin_feat";
    assert.throws(() => previewNativeCompendiumDocument(db, batch("backgrounds", [background])), /unknown feat id/u);
  } finally { db.close(); }
});


test("import guardrails reject corrupted mechanical vocabulary", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const cls = structuredClone(samples.classes[0]!);
    ((cls.proficiencies as Record<string, unknown>).skills as Record<string, unknown>).from = ["Sleight 0f Hand"];
    assert.throws(() => importNativeCompendiumDocument(db, batch("classes", [cls])), /unknown skill|corrupted mechanical text/u);
  } finally { db.close(); }
});


test("import guardrails reject broken spell ability placeholders", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const spell = { ...samples.spells[0], rolls: [{ formula: "2d8+%0", effect: "healing" }] };
    assert.throws(() => previewNativeCompendiumDocument(db, batch("spells", [spell])), /broken %0 ability placeholder/u);
  } finally { db.close(); }
});


test("import guardrails reject destructive partial class replacements", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const complete = {
      ...samples.classes[0],
      levels: Array.from({ length: 20 }, (_, index) => ({ level: index + 1 })),
    };
    importNativeCompendiumBatch(db, batch("classes", [complete]));
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("classes", samples.classes)),
      /partial replacement \(1\/20 levels; missing levels 2, 3, 4/u,
    );
  } finally { db.close(); }
});


test("import guardrails reject unknown spell access IDs and fake choice feats", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const spell = { ...samples.spells[0], access: ["sl_unknown_list"] };
    assert.throws(() => previewNativeCompendiumDocument(db, batch("spells", [spell])), /unknown spell-list id/u);
    const feat = { ...samples.feats[0], name: "A Dark Gift feat of your choice" };
    assert.throws(() => previewNativeCompendiumDocument(db, batch("feats", [feat])), /choice sentence, not a catalog feat/u);
  } finally { db.close(); }
});


test("import guardrails reject skills misparsed as saving-throw grants", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const feat = { ...samples.feats[0], mechanics: { grants: { savingThrows: ["Perception"] } } };
    assert.throws(() => previewNativeCompendiumDocument(db, batch("feats", [feat])), /non-ability saving throw/u);
  } finally { db.close(); }
});


test("import guardrails reject broken and duplicate Feat choice identities", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const brokenReference = {
      ...samples.feats[0],
      mechanics: {
        choices: [{ id: "spell_1", type: "spell", count: 1, dependsOnChoiceId: "missing_list" }],
      },
    };
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("feats", [brokenReference])),
      /dependsOnChoiceId references unknown choice/u,
    );

    const duplicateIdentity = {
      ...samples.feats[0],
      mechanics: {
        choices: [
          { id: "ability_1", type: "ability_score", count: 1, options: ["Strength"], amount: 1 },
          { id: "ability_1", type: "ability_score", count: 1, options: ["Dexterity"], amount: 1 },
        ],
      },
    };
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("feats", [duplicateIdentity])),
      /id duplicates "ability_1"/u,
    );
  } finally { db.close(); }
});


test("import guardrails retain prose Feat prerequisites and require typed references to resolve", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const prose = { ...samples.feats[0], prerequisite: "Level 4+" };
    assert.doesNotThrow(() => previewNativeCompendiumDocument(db, batch("feats", [prose])));
    const unresolved = { ...samples.feats[0], prerequisite: { feat: "f_missing" } };
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("feats", [unresolved])),
      /prerequisite references unknown feat id "f_missing"/u,
    );
  } finally { db.close(); }
});


test("import guardrails accept the canonical known-cantrip replacement target", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const feat = {
      ...samples.feats[0],
      mechanics: {
        choices: [{
          id: "replacement_cantrip_1",
          type: "spell",
          count: 1,
          level: 0,
          dependencyKind: "replacement",
          replacementFor: "known_cantrip",
        }],
      },
    };
    assert.doesNotThrow(() => previewNativeCompendiumDocument(db, batch("feats", [feat])));
  } finally { db.close(); }
});


test("import guardrails reject a species trait marked automatic with no structured mechanics", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const species = {
      ...samples.species[0],
      traits: [{ id: "t_test", name: "Integrated Protection", description: "You gain a +1 bonus to your Armor Class.", resolution: "automatic" }],
    };
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("species", [species])),
      /traits\.0 is marked automatic but has no effects, scalingRolls, preparedSpellProgression, or species-level ability score increase/u,
    );
  } finally { db.close(); }
});


test("import guardrails accept a species trait marked automatic once it carries real structured effects", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const species = {
      ...samples.species[0],
      traits: [{
        id: "t_test",
        name: "Integrated Protection",
        description: "You gain a +1 bonus to your Armor Class.",
        resolution: "automatic",
        effects: [{ type: "armor_class", mode: "bonus", bonus: { kind: "fixed", value: 1 } }],
      }],
    };
    assert.doesNotThrow(() => previewNativeCompendiumDocument(db, batch("species", [species])));
  } finally { db.close(); }
});


test("import guardrails reject a feat marked automatic with no structured grants", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const feat: Record<string, unknown> = { ...samples.feats[0], resolution: "automatic" };
    delete feat.mechanics;
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("feats", [feat])),
      /is marked automatic but grants no structured mechanics/u,
    );
  } finally { db.close(); }
});


test("import guardrails accept a feat marked automatic once it grants real structured mechanics", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const feat = { ...samples.feats[0], resolution: "automatic", mechanics: { grants: { skills: ["Athletics"] } } };
    assert.doesNotThrow(() => previewNativeCompendiumDocument(db, batch("feats", [feat])));
  } finally { db.close(); }
});


test("import guardrails accept a feat marked automatic whose only structured mechanics are player choices", () => {
  // Found via a full-corpus review: Ability Score Improvement and Blessed Warrior are both real
  // `automatic` feats whose entire mechanic is a `mechanics.choices` entry (no `grants` at all) â€”
  // the guardrail's first version only checked `grants`/`uses`/`preparedSpellProgression` and
  // wrongly flagged both as incomplete.
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const feat = {
      ...samples.feats[0],
      resolution: "automatic",
      mechanics: {
        choices: [{ id: "ability_1", type: "ability_score", count: 1, options: ["Strength", "Dexterity"], amount: 2 }],
      },
    };
    assert.doesNotThrow(() => previewNativeCompendiumDocument(db, batch("feats", [feat])));
  } finally { db.close(); }
});
