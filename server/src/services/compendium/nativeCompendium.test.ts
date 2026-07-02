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
import { convertCompendiumXmlToNative } from "./convertXmlToNative.js";
import { assertCanonicalV2Entry, collectV2MonsterSpellIds } from "./nativeCompendiumV2.js";
import { mergeCanonicalV2Edit } from "./canonicalCompendiumEdits.js";
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
    challenge: { rating: "2", numeric: 2, xp: 450 },
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
      attack: { toHit: 4, reach: "5ft", range: null, melee: true, ranged: false, damage: "1d8+2", damageType: "slashing" },
      attacks: [],
    }],
    reactions: [],
    legendaryActions: [],
    spellcasting: [],
    spells: [],
  }],
  items: [{
    schemaVersion: 2,
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
    classes: ["Wizard"],
    description: ["Test spell."],
  }],
  classes: [{
    schemaVersion: 2,
    id: "c_test",
    name: "Test Class",
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
    id: "r_test", name: "Test Species", source: null,
    size: "M", speed: 30, spellcastingAbility: null, resistances: [], vision: [], choices: {}, traits: [],
  }],
  backgrounds: [{
    id: "bg_test",
    name: "Test Background",
    description: "A compact background.",
    proficiencies: {},
  }],
  feats: [{
    schemaVersion: 2,
    id: "f_test", name: "Test Feat", source: null,
    category: "General", prerequisite: null, repeatable: false,
    description: "Test feat.", mechanics: {},
  }],
  decks: [{
    schemaVersion: 2,
    id: "deck:test:one",
    deckName: "Test Deck",
    deckKey: "test",
    cardName: "One",
    cardKey: "one",
    text: "Test card.",
    sort: 1,
  }],
  bastions: [
    { schemaVersion: 2, kind: "space", id: "bastion-space:test", name: "Test Space", squares: 4, sort: 1 },
    { schemaVersion: 2, kind: "order", id: "bastion-order:test", name: "Test Order", sort: 1 },
    {
      schemaVersion: 2,
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
    version: 2,
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
      assert.equal(exported.version, 2);
      assert.equal(exported.category, category);
    }

    const monster = exportNativeCompendiumBatch(db, "monsters").entries[0];
    assert.equal(monster?.name, "Test Guardian");
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

test("native v2 remains canonical in storage", () => {
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

test("editor replacements preserve canonical-only fields", () => {
  const monster = samples.monsters[0]!;
  const replacement = structuredClone(monster);
  delete replacement.source;
  delete replacement.description;
  delete replacement.spellcasting;
  delete replacement.spells;
  delete (replacement.classification as Record<string, unknown>).alignment;
  const existing = compactMonsterEntry({
    ...monster,
    source: "Test Source",
    description: "Canonical description",
    spellcasting: [{
      id: "innate",
      name: "Innate Spellcasting",
      description: "The guardian casts spells.",
    }],
    spells: [{ id: "s_test", name: "Test Spell" }],
    classification: {
      ...(monster.classification as Record<string, unknown>),
      alignment: "Neutral",
    },
  });
  const mergedMonster = mergeCanonicalV2Edit("monsters", existing, replacement);

  assert.equal(mergedMonster.source, "Test Source");
  assert.equal(mergedMonster.description, "Canonical description");
  assert.equal((mergedMonster.spellcasting as unknown[]).length, 1);
  assert.equal((mergedMonster.spells as unknown[]).length, 1);
  assert.equal(
    (mergedMonster.classification as Record<string, unknown>).alignment,
    "Neutral",
  );
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
    assert.equal(bundle.batches.length, 2);

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
      version: 2,
      exportedAt: "2026-06-28T00:00:00.000Z",
      batches: [
        { category: "items", entries: samples.items },
        {
          category: "spells",
          entries: [{ ...samples.spells[0], level: 10 }],
        },
      ],
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

test("XML conversion returns one native V2 bundle without a destination database", () => {
  const document = convertCompendiumXmlToNative(`
    <compendium>
      <monster>
        <name>Converted Guardian</name>
        <cr>1</cr>
        <ac>15</ac>
        <hp>22</hp>
        <action>
          <name>Strike</name>
          <text>Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage.</text>
        </action>
      </monster>
      <item>
        <name>Converted Key</name>
        <type>Wondrous Item</type>
        <magic>1</magic>
      </item>
    </compendium>
  `);

  assert.equal(document.format, "beholden.compendium");
  assert.equal(document.version, 2);
  assert.deepEqual(
    document.batches.map((entry) => entry.category),
    ["monsters", "items"],
  );
  assert.equal(document.batches[0]?.entries[0]?.name, "Converted Guardian");
  assert.equal(
    ((document.batches[0]?.entries[0]?.actions as Array<Record<string, unknown>>)?.[0]?.attack as Record<string, unknown>)?.toHit,
    4,
  );
  assert.equal(document.batches[1]?.entries[0]?.name, "Converted Key");
});

test("native batch parser rejects foreign formats and mixed envelopes", () => {
  assert.throws(
    () => parseNativeCompendiumBatch({ format: "other", version: 2, category: "items", entries: [] }),
    /Expected format/u,
  );
  assert.throws(
    () => parseNativeCompendiumBatch({ format: "beholden.compendium", version: 2, category: "everything", entries: [] }),
    /Unknown compendium category/u,
  );
});

test("native batch parser rejects earlier non-canonical V2 spell exports", () => {
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

test("v2 monster spell references use id for adventure dependencies", () => {
  const ids = collectV2MonsterSpellIds([{
    spells: [
      { id: "s_fire_bolt", name: "Fire Bolt" },
      { id: "s_shield", name: "Shield" },
      { spellId: "s_legacy_wrong_key", name: "Legacy Shape" },
    ],
  }]);
  assert.deepEqual(Array.from(ids), ["s_fire_bolt", "s_shield"]);
});

test("AI guide native JSON examples match the strict v2 importer", () => {
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
    if (category) assertCanonicalV2Entry(category, document, 0);
  }
});
