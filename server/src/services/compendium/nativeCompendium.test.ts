import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import {
  NATIVE_COMPENDIUM_CATEGORIES,
  exportNativeCompendiumBatch,
  exportNativeCompendiumBundle,
  importNativeCompendiumBatch,
  importNativeCompendiumDocument,
  parseNativeCompendiumBatch,
  parseNativeCompendiumDocument,
  previewNativeCompendiumDocument,
  type NativeCompendiumCategory,
} from "./nativeCompendium.js";
import { assertGrandCompendiumEntry, collectGrandMonsterSpellIds } from "./grandCompendium.js";
import { compactBackgroundEntry } from "./backgroundCompaction.js";
import { compactClassEntry } from "./classCompaction.js";
import { compactFeatEntry } from "./featCompaction.js";
import { compactItemEntry } from "./itemCompaction.js";
import { compactMonsterEntry } from "./monsterCompaction.js";
import { compactSpeciesEntry } from "./speciesCompaction.js";
import { compactSpellEntry } from "./spellCompaction.js";

const samples: Record<NativeCompendiumCategory, Array<Record<string, unknown>>> = {
  monsters: [{
    schemaVersion: 2,
    ruleset: "5.5e",
    id: "m_test_guardian",
    name: "Test Guardian",
    source: null,
    classification: {
      size: "M", type: "construct", description: "Medium construct",
      sortName: null, alignment: null, ancestry: null, environment: [],
    },
    description: null,
    initiativeBonus: null,
    passivePerception: null,
    npc: false,
    challenge: { rating: "2", xp: 450 },
    armorClass: { value: 15, source: null },
    hitPoints: { average: 30, formula: "4d8 + 12" },
    movement: { walk: 30, burrow: null, climb: null, fly: null, swim: null, hover: false },
    abilities: { str: 14, dex: 10, con: 16, int: 3, wis: 10, cha: 5 },
    proficiencies: { savingThrows: [], skills: [] },
    defenses: { vulnerabilities: [], resistances: [], damageImmunities: [], conditionImmunities: [] },
    senses: [],
    languages: [],
    traits: [],
    actions: [{
      id: "strike",
      name: "Strike",
      description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage.",
      category: null,
      recharge: null,
      attack: { toHit: 4, reach: "5ft", range: null, melee: true, ranged: false },
      damage: { roll: "1d8+2", type: "slashing" },
    }],
    reactions: [],
    legendaryActions: [],
    spellcasting: [],
    spells: [],
  }],
  items: [{
    schemaVersion: 2,
    ruleset: "5.5e",
    id: "i_test_blade",
    name: "Test Blade",
    source: null,
    classification: { type: "Melee Weapon", typeKey: "melee_weapon", rarity: "rare", magical: true },
    attunement: { required: false, requirements: null },
    equipment: { equippable: true, weight: 3, value: 100, proficiency: "Martial Weapons" },
    armor: { armorClass: null, stealthDisadvantage: false, strengthRequirement: null },
    weapon: {
      oneHandedDamage: "1d8", twoHandedDamage: "1d10", damageType: "S",
      range: null, properties: ["V"],
    },
    detail: null,
    modifiers: [],
    rolls: [],
    description: ["Test rules."],
  }],
  spells: [{
    ruleset: "5.5e",
    id: "s_test_spark",
    name: "Test Spark",
    level: 1,
    school: "Evocation",
    casting: {
      time: "1 action",
      range: "60 feet",
      components: { verbal: true, somatic: true },
      duration: { description: "Instantaneous" },
    },
    access: ["sl_wizard"],
    description: ["Test spell."],
  }],
  classTalents: [{
    ruleset: "5.5e",
    id: "ct_invocation_test",
    name: "Invocation: Test",
    kind: "invocation",
    description: ["A test class talent."],
  }],
  classes: [{
    schemaVersion: 2,
    ruleset: "5.5e",
    id: "c_test",
    name: "Test Class",
    spellLists: { sl_wizard: "Wizard" },
    description: "A test class.",
    hitDie: 8,
    startingWealth: null,
    proficiencies: {
      savingThrows: ["int", "wis"],
      skills: { choose: 2, from: ["Arcana", "History"] },
      armor: ["Light Armor"],
      weapons: ["Simple Weapons"],
      tools: { fixed: [], choices: [], notes: [] },
    },
    spellcasting: { ability: "int", slotRecovery: "long_rest" },
    levels: [{
      level: 1,
      abilityScoreImprovement: false,
      cantripsKnown: 2,
      spellSlots: { "1": 2 },
      features: [],
      resources: [],
    }],
  }],
  species: [{
    schemaVersion: 2,
    ruleset: "5.5e",
    id: "r_test", name: "Test Species", source: null,
    size: "M", speed: 30, spellcastingAbility: null, resistances: [], vision: [], choices: {}, traits: [],
  }],
  backgrounds: [{
    ruleset: "5.5e",
    id: "bg_test",
    name: "Test Background",
    description: "A compact background.",
    proficiencies: {},
  }],
  feats: [{
    schemaVersion: 2,
    ruleset: "5.5e",
    id: "f_test", name: "Test Feat", source: null,
    category: "General", prerequisite: null, repeatable: false,
    description: "Test feat.", mechanics: {},
  }],
  decks: [{
    schemaVersion: 2,
    ruleset: "5.5e",
    id: "deck:test:one",
    deckName: "Test Deck",
    deckKey: "test",
    cardName: "One",
    cardKey: "one",
    text: "Test card.",
    sort: 1,
  }],
  bastions: [
    { schemaVersion: 2, ruleset: "5.5e", kind: "space", id: "bastion-space:test", name: "Test Space", squares: 4, sort: 1 },
    { schemaVersion: 2, ruleset: "5.5e", kind: "order", id: "bastion-order:test", name: "Test Order", sort: 1 },
    {
      schemaVersion: 2,
      ruleset: "5.5e",
      kind: "facility",
      id: "bastion-facility:test",
      name: "Test Facility",
      facilityType: "special",
      orders: ["Test Order"],
      description: "Test facility.",
    },
  ],
};

samples.monsters = samples.monsters.map(compactMonsterEntry);
samples.items = samples.items.map(compactItemEntry);
samples.spells = samples.spells.map(compactSpellEntry);
samples.classes = samples.classes.map(compactClassEntry);
samples.species = samples.species.map(compactSpeciesEntry);
samples.backgrounds = samples.backgrounds.map(compactBackgroundEntry);
samples.feats = samples.feats.map(compactFeatEntry);

function batch(category: NativeCompendiumCategory, entries = samples[category]) {
  return {
    format: "beholden.compendium",
    schema: "grand",
    category,
    exportedAt: "2026-06-28T00:00:00.000Z",
    entries,
  };
}

test("native compendium round-trips every category", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    for (const category of NATIVE_COMPENDIUM_CATEGORIES) {
      const result = importNativeCompendiumBatch(db, batch(category));
      const exported = exportNativeCompendiumBatch(db, category);
      assert.equal(result.imported, samples[category].length);
      assert.equal(exported.entries.length, samples[category].length);
      assert.equal(exported.format, "beholden.compendium");
      assert.equal(exported.schema, "grand");
      assert.equal(exported.category, category);
    }

    const monster = exportNativeCompendiumBatch(db, "monsters").entries[0];
    assert.equal(monster?.name, "Test Guardian");
    assert.equal(monster?.ruleset, "5.5e");
    assert.equal((db.prepare("SELECT ruleset FROM compendium_monsters WHERE id = ?").get("m_test_guardian") as { ruleset: string }).ruleset, "5.5e");
    assert.ok(Array.isArray(monster?.actions));
    assert.equal(
      exportNativeCompendiumBatch(db, "monsters", ["m_test_guardian"]).entries.length,
      1,
    );
    assert.equal(
      exportNativeCompendiumBatch(db, "monsters", ["m_missing"]).entries.length,
      0,
    );
  } finally {
    db.close();
  }
});

test("native imports replace matching IDs", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("items"));
    importNativeCompendiumBatch(db, batch("items", [compactItemEntry({
      schemaVersion: 2,
      id: "i_test_blade",
      name: "Test Blade, Revised",
      source: null,
      classification: { type: "Melee Weapon", typeKey: "melee_weapon", rarity: "legendary", magical: true },
      attunement: { required: true, requirements: null },
      equipment: { equippable: true, weight: 3, value: 1000, proficiency: "Martial Weapons" },
      armor: { armorClass: null, stealthDisadvantage: false, strengthRequirement: null },
      weapon: {
        oneHandedDamage: "1d8", twoHandedDamage: "1d10", damageType: "S",
        range: null, properties: ["V"],
      },
      detail: null,
      modifiers: [],
      rolls: [],
      description: ["Replacement rules."],
    })]));

    const exported = exportNativeCompendiumBatch(db, "items");
    assert.equal(exported.entries.length, 1);
    assert.equal(exported.entries[0]?.name, "Test Blade, Revised");
    assert.equal(exported.entries[0]?.rarity, "legendary");
    assert.equal(exported.entries[0]?.description, "Replacement rules.");
  } finally {
    db.close();
  }
});

test("Grand remains canonical in storage", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("monsters"));
    importNativeCompendiumBatch(db, batch("classes"));

    const monsterRow = db.prepare(
      "SELECT data_json FROM compendium_monsters WHERE id = ?",
    ).get("m_test_guardian") as { data_json: string };
    const classRow = db.prepare(
      "SELECT data_json FROM compendium_classes WHERE id = ?",
    ).get("c_test") as { data_json: string };
    const storedMonster = JSON.parse(monsterRow.data_json) as Record<string, unknown>;
    const storedClass = JSON.parse(classRow.data_json) as Record<string, unknown>;

    assert.ok(storedMonster.armorClass);
    assert.equal(storedMonster.ac, undefined);
    assert.ok(Array.isArray(storedClass.levels));
    assert.equal(storedClass.autolevels, undefined);

  } finally {
    db.close();
  }
});

test("native importer accepts a multi-category bundle atomically", () => {
  const source = new Database(":memory:");
  const destination = new Database(":memory:");
  source.exec(SCHEMA_SQL);
  destination.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(source, batch("monsters"));
    importNativeCompendiumBatch(source, batch("items"));
    const bundle = exportNativeCompendiumBundle(source);
    const serialized = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
    assert.equal(serialized.batches, undefined);
    assert.ok(Array.isArray(serialized.monsters));
    assert.ok(Array.isArray(serialized.items));

    const result = importNativeCompendiumDocument(destination, bundle);
    assert.equal(result.imported, 2);
    assert.deepEqual(
      result.batches.map((entry) => entry.category),
      ["monsters", "items"],
    );
    assert.equal(exportNativeCompendiumBatch(destination, "monsters").entries.length, 1);
    assert.equal(exportNativeCompendiumBatch(destination, "items").entries.length, 1);
  } finally {
    source.close();
    destination.close();
  }
});

test("native preview validates without writing and counts replacements", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    importNativeCompendiumBatch(db, batch("items"));
    const preview = previewNativeCompendiumDocument(db, batch("items", [
      samples.items[0]!,
      {
        ...samples.items[0]!,
        id: "i_new_blade",
        name: "New Blade",
      },
    ]));

    assert.deepEqual(preview, {
      entries: 2,
      additions: 1,
      replacements: 1,
      batches: [{
        category: "items",
        entries: 2,
        additions: 1,
        replacements: 1,
      }],
    });
    assert.equal(exportNativeCompendiumBatch(db, "items").entries.length, 1);
  } finally {
    db.close();
  }
});

test("native documents reject duplicate IDs before preview or import", () => {
  assert.throws(
    () => parseNativeCompendiumBatch(batch("items", [
      samples.items[0]!,
      samples.items[0]!,
    ])),
    /duplicates id "i_test_blade"/u,
  );
});

test("invalid native bundles make no partial writes", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const document = {
      format: "beholden.compendium",
      schema: "grand",
      exportedAt: "2026-06-28T00:00:00.000Z",
      items: samples.items,
      spells: [{ ...samples.spells[0], level: 10 }],
    };
    assert.throws(
      () => importNativeCompendiumDocument(db, document),
      /spells entry 1 is invalid/u,
    );
    assert.equal(exportNativeCompendiumBatch(db, "items").entries.length, 0);
    assert.equal(exportNativeCompendiumBatch(db, "spells").entries.length, 0);
  } finally {
    db.close();
  }
});

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
    // A label identical to the catalog name is a duplicated fact — the API projects it at read time.
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("backgrounds", [withEquipment("Test Blade")])),
      /duplicates the catalog name of i_test_blade/u,
    );
    // A label that intentionally differs (flavor/display ordering) is a real fact and passes.
    const preview = previewNativeCompendiumDocument(db, batch("backgrounds", [withEquipment("Blade (ceremonial)")]));
    assert.equal(preview.entries, 1);
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
      /partial replacement \(1\/20 levels\)/u,
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

test("import guardrails require typed, resolvable Feat prerequisites", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  try {
    const prose = { ...samples.feats[0], prerequisite: "Level 4+" };
    assert.throws(
      () => previewNativeCompendiumDocument(db, batch("feats", [prose])),
      /prerequisite/u,
    );
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
      /traits\.0 is marked automatic but has no effects, scalingRolls, or preparedSpellProgression/u,
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
  // `automatic` feats whose entire mechanic is a `mechanics.choices` entry (no `grants` at all) —
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

test("Grand monster spell references use id for adventure dependencies", () => {
  const ids = collectGrandMonsterSpellIds([{
    spells: [
      { id: "s_fire_bolt", name: "Fire Bolt" },
      { id: "s_shield", name: "Shield" },
      { spellId: "s_legacy_wrong_key", name: "Legacy Shape" },
    ],
  }]);
  assert.deepEqual(Array.from(ids), ["s_fire_bolt", "s_shield"]);
});

test("AI guide native JSON examples match the strict Grand importer", () => {
  const guidePath = fileURLToPath(
    new URL("../../../../BEHOLDEN_AI_CONTENT_GUIDE.md", import.meta.url),
  );
  const compendiumSection = fs.readFileSync(guidePath, "utf8").split("\n# Character import")[0] ?? "";
  const documents = Array.from(
    compendiumSection.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/gu),
    (match) => JSON.parse(match[1] ?? "{}") as Record<string, unknown>,
  );

  for (const document of documents.filter((value) => value.format === "beholden.compendium")) {
    parseNativeCompendiumDocument(document);
  }
  for (const adventure of documents.filter((value) => value.format === "beholden.adventure")) {
    const batches = Array.isArray(adventure.compendium) ? adventure.compendium : [];
    for (const embedded of batches) parseNativeCompendiumBatch(embedded);
  }

  const categoryFor = (entry: Record<string, unknown>): NativeCompendiumCategory | null => {
    const id = String(entry.id ?? "");
    if (id.startsWith("s_")) return "spells";
    if (id.startsWith("c_")) return "classes";
    if (id.startsWith("r_")) return "species";
    if (id.startsWith("bg_")) return "backgrounds";
    if (id.startsWith("f_")) return "feats";
    if (id.startsWith("deck:")) return "decks";
    if (entry.kind && id.startsWith("bastion-")) return "bastions";
    return null;
  };
  for (const document of documents) {
    const category = categoryFor(document);
    if (category) assertGrandCompendiumEntry(category, document, 0);
  }
});
