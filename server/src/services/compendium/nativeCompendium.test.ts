import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import {
  BEHOLDEN_COMPENDIUM_FORMAT,
  BEHOLDEN_COMPENDIUM_VERSION,
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
import { trimCompendiumBlobColumns } from "./blobHygiene.js";
import {
  mergeCanonicalV2Edit,
  upgradeStoredCanonicalV2Entries,
} from "./nativeCompendiumV2Migration.js";
import {
  parseStoredCanonicalCompendiumEntry,
  parseStoredCompendiumEntry,
} from "./storedCompendium.js";
import { backfillMonsterSpellRefs } from "./normalizeMonsterSpellRefs.js";
import { parseFeat } from "../../lib/featParser.js";

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
    importNativeCompendiumBatch(db, batch("items", [{
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
    }]));

    const exported = exportNativeCompendiumBatch(db, "items");
    assert.equal(exported.entries.length, 1);
    assert.equal(exported.entries[0]?.name, "Test Blade, Revised");
    assert.equal(exported.entries[0]?.rarity, "legendary");
    assert.equal(exported.entries[0]?.description, "Replacement rules.");
  } finally {
    db.close();
  }
});

test("native v2 remains canonical in storage and survives legacy blob hygiene", () => {
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

    trimCompendiumBlobColumns(db);
    assert.deepEqual(
      JSON.parse((db.prepare("SELECT data_json FROM compendium_monsters WHERE id = ?")
        .get("m_test_guardian") as { data_json: string }).data_json),
      storedMonster,
    );
  } finally {
    db.close();
  }
});

test("canonical read boundary converts a legacy class row during migration", () => {
  const canonical = parseStoredCanonicalCompendiumEntry("classes", JSON.stringify({
    id: "c_legacy",
    name: "Legacy Class",
    hd: 8,
    proficiency: "Wisdom, Charisma",
    numSkills: 2,
    armor: "Light Armor",
    weapons: "Simple Weapons",
    tools: "None",
    slotsReset: "L",
    spellAbility: "Wisdom",
    description: "Legacy description.",
    autolevels: [],
  }));
  assert.equal(canonical.hitDie, 8);
  assert.equal(canonical.description, "Legacy description.");
  assert.ok(Array.isArray(canonical.levels));
  assert.equal(canonical.autolevels, undefined);
});

test("older canonical v2 rows are upgraded without falling through the legacy path", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const oldClass = structuredClone(samples.classes[0]!);
    delete oldClass.schemaVersion;
    delete oldClass.startingWealth;
    const spellcasting = oldClass.spellcasting as Record<string, unknown>;
    spellcasting.ability = "Intelligence";
    for (const level of oldClass.levels as Array<Record<string, unknown>>) {
      for (const feature of (level.features ?? []) as Array<Record<string, unknown>>) {
        delete feature.scalingRolls;
      }
    }
    db.prepare(
      "INSERT INTO compendium_classes (id, name, name_key, hd, data_json) VALUES (?, ?, ?, ?, ?)",
    ).run(oldClass.id, oldClass.name, "test class", oldClass.hitDie, JSON.stringify(oldClass));

    const before = parseStoredCompendiumEntry("classes", JSON.stringify(oldClass));
    assert.equal((before.autolevels as unknown[]).length, (oldClass.levels as unknown[]).length);

    trimCompendiumBlobColumns(db);
    assert.deepEqual(
      JSON.parse((db.prepare("SELECT data_json FROM compendium_classes WHERE id = ?")
        .get(oldClass.id) as { data_json: string }).data_json),
      oldClass,
    );

    assert.equal(upgradeStoredCanonicalV2Entries(db), 1);
    const stored = JSON.parse((db.prepare(
      "SELECT data_json FROM compendium_classes WHERE id = ?",
    ).get(oldClass.id) as { data_json: string }).data_json) as Record<string, unknown>;
    assertCanonicalV2Entry("classes", stored, 0);

    const exported = exportNativeCompendiumBatch(db, "classes");
    assert.equal(
      (exported.entries[0]?.levels as unknown[]).length,
      (oldClass.levels as unknown[]).length,
    );
  } finally {
    db.close();
  }
});

test("startup refreshes affected Fighting Style mechanics for existing canonical rows", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const styles = [
    {
      id: "f_style_blessed_warrior",
      name: "Fighting Style: Blessed Warrior",
      description: "You learn two Cleric cantrips of your choice. The chosen cantrips count as Paladin spells for you, and Charisma is your spellcasting ability for them.",
    },
    {
      id: "f_style_dueling",
      name: "Fighting Style: Dueling",
      description: "When you're holding a Melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
    },
    {
      id: "f_style_great_weapon",
      name: "Fighting Style: Great Weapon Fighting",
      description: "When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3.",
    },
    {
      id: "f_style_interception",
      name: "Fighting Style: Interception",
      description: "You can take a Reaction to reduce the damage dealt to the target.",
    },
    {
      id: "f_style_protection",
      name: "Fighting Style: Protection",
      description: "You can take a Reaction to interpose your Shield.",
    },
    {
      id: "f_style_thrown",
      name: "Fighting Style: Thrown Weapon Fighting",
      description: "When you hit with a ranged attack roll using a weapon that has the Thrown property, you gain a +2 bonus to the damage roll.",
    },
  ];

  try {
    const insert = db.prepare(
      "INSERT INTO compendium_feats (id, name, name_key, data_json) VALUES (?, ?, ?, ?)",
    );
    for (const style of styles) {
      insert.run(
        style.id,
        style.name,
        style.name.toLowerCase(),
        JSON.stringify({
          ...samples.feats[0],
          ...style,
          category: "Fighting Style",
          mechanics: {},
        }),
      );
    }

    assert.equal(upgradeStoredCanonicalV2Entries(db), 6);

    const blessed = JSON.parse((db.prepare(
      "SELECT data_json FROM compendium_feats WHERE id = ?",
    ).get("f_style_blessed_warrior") as { data_json: string }).data_json) as {
      mechanics: {
        choices: Array<{ options: string[] }>;
        spellcastingAbility: string;
      };
    };
    assert.deepEqual(blessed.mechanics.choices[0]!.options, ["Cleric"]);
    assert.equal(blessed.mechanics.spellcastingAbility, "cha");

    for (const id of ["f_style_dueling", "f_style_thrown"]) {
      const stored = JSON.parse((db.prepare(
        "SELECT data_json FROM compendium_feats WHERE id = ?",
      ).get(id) as { data_json: string }).data_json) as {
        mechanics: {
          grants: {
            effects: Array<{
              target: string;
              amount: { value: number };
            }>;
          };
        };
      };
      assert.equal(stored.mechanics.grants.effects[0]!.target, "damage_roll");
      assert.equal(stored.mechanics.grants.effects[0]!.amount.value, 2);
    }

    for (const id of ["f_style_great_weapon", "f_style_interception", "f_style_protection"]) {
      const stored = JSON.parse((db.prepare(
        "SELECT data_json FROM compendium_feats WHERE id = ?",
      ).get(id) as { data_json: string }).data_json) as {
        mechanics: {
          grants: {
            effects: Array<{ resolution: string }>;
          };
        };
      };
      assert.equal(stored.mechanics.grants.effects[0]!.resolution, "manual");
    }

    assert.equal(upgradeStoredCanonicalV2Entries(db), 0, "refresh must be idempotent");
  } finally {
    db.close();
  }
});

test("startup backfills conservative feat resolution on existing canonical rows", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const {
      resolution: _resolution,
      resolutionNotes: _resolutionNotes,
      ...mechanics
    } = parseFeat({
      name: "Actor",
      text: "You gain proficiency in the Deception skill.",
    });
    const feat = {
      ...samples.feats[0],
      id: "f_existing_actor",
      name: "Actor",
      description: "You gain structured benefits and additional benefits described by this feat.",
      mechanics,
    };
    db.prepare(
      "INSERT INTO compendium_feats (id, name, name_key, data_json) VALUES (?, ?, ?, ?)",
    ).run(feat.id, feat.name, "actor", JSON.stringify(feat));

    assert.equal(upgradeStoredCanonicalV2Entries(db), 1);
    const stored = JSON.parse((db.prepare(
      "SELECT data_json FROM compendium_feats WHERE id = ?",
    ).get(feat.id) as { data_json: string }).data_json) as {
      resolution: string;
      resolutionNotes?: string[];
      mechanics: { resolution?: string; resolutionNotes?: string[] };
    };
    assert.equal(stored.resolution, "mixed");
    assert.equal(stored.resolutionNotes, undefined);
    assert.equal(stored.mechanics.resolution, undefined);
    assert.equal(stored.mechanics.resolutionNotes, undefined);
    const legacy = parseStoredCompendiumEntry("feats", JSON.stringify(stored));
    const parsed = legacy.parsed as Record<string, unknown>;
    assert.equal(parsed.resolution, "mixed");
    assert.ok(
      (parsed.resolutionNotes as string[]).some((note) => /until reviewed/i.test(note)),
    );
    assert.equal(upgradeStoredCanonicalV2Entries(db), 0, "backfill must be idempotent");
  } finally {
    db.close();
  }
});

test("startup structures equipment choices on existing canonical backgrounds", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const background = {
      ...samples.backgrounds[0],
      id: "bg_existing_acolyte",
      name: "Acolyte",
      equipment: {
        description: "Choose A or B: (A) Dagger, Parchment (10 sheets), 8 GP; or (B) 50 GP",
      },
    };
    db.prepare(
      "INSERT INTO compendium_backgrounds (id, name, name_key, data_json) VALUES (?, ?, ?, ?)",
    ).run(background.id, background.name, "acolyte", JSON.stringify(background));

    assert.equal(upgradeStoredCanonicalV2Entries(db), 1);
    const stored = JSON.parse((db.prepare(
      "SELECT data_json FROM compendium_backgrounds WHERE id = ?",
    ).get(background.id) as { data_json: string }).data_json) as {
      equipment: { options: Array<{ id: string; entries: unknown[] }> };
    };
    assert.deepEqual(stored.equipment.options.map((option) => option.id), ["A", "B"]);
    assert.deepEqual(stored.equipment.options[1]?.entries, [
      { kind: "currency", denomination: "GP", amount: 50 },
    ]);
    assert.equal(upgradeStoredCanonicalV2Entries(db), 0, "backfill must be idempotent");
  } finally {
    db.close();
  }
});

test("native import normalizes legacy verbose backgrounds to compact V2", () => {
  const batch = parseNativeCompendiumBatch({
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    version: BEHOLDEN_COMPENDIUM_VERSION,
    category: "backgrounds",
    exportedAt: "2026-01-01T00:00:00.000Z",
    entries: [{
      schemaVersion: 2,
      id: "bg_legacy",
      name: "Legacy Background",
      source: null,
      proficiencies: {
        skills: { fixed: ["Insight", "Religion"], choose: 0, from: null },
        tools: { fixed: [], choose: 0, from: null },
        languages: { fixed: [], choose: 0, from: null },
        feats: [],
        featChoice: 0,
        abilityScores: ["Intelligence", "Wisdom", "Charisma"],
        abilityScoreChoose: 0,
      },
      equipment: { description: "" },
      traits: [{
        id: "description",
        name: "Description",
        description: "Legacy prose.",
        category: null,
        scalingRolls: [],
        preparedSpellProgression: [],
        resolution: "manual",
      }],
    }],
  });

  assert.deepEqual(batch.entries, [{
    id: "bg_legacy",
    name: "Legacy Background",
    description: "Legacy prose.",
    proficiencies: {
      skills: ["Insight", "Religion"],
      abilityScores: ["Intelligence", "Wisdom", "Charisma"],
    },
  }]);
});

test("spell-reference maintenance leaves older canonical monsters untouched", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  try {
    const oldMonster = structuredClone(samples.monsters[0]!);
    delete oldMonster.schemaVersion;
    delete oldMonster.description;
    delete oldMonster.initiativeBonus;
    delete oldMonster.passivePerception;
    oldMonster.spells = [{ id: "s_test", name: "Test Spell" }];
    db.prepare(
      "INSERT INTO compendium_monsters (id, name, name_key, data_json) VALUES (?, ?, ?, ?)",
    ).run(oldMonster.id, oldMonster.name, "test guardian", JSON.stringify(oldMonster));

    backfillMonsterSpellRefs(db);
    const stored = JSON.parse((db.prepare(
      "SELECT data_json FROM compendium_monsters WHERE id = ?",
    ).get(oldMonster.id) as { data_json: string }).data_json);
    assert.deepEqual(stored, oldMonster);
  } finally {
    db.close();
  }
});

test("legacy-shaped editor replacements preserve canonical-only fields", () => {
  const monster = samples.monsters[0]!;
  const replacement = structuredClone(monster);
  replacement.source = null;
  replacement.description = null;
  replacement.spellcasting = [];
  replacement.spells = [];
  (replacement.classification as Record<string, unknown>).alignment = null;
  const mergedMonster = mergeCanonicalV2Edit("monsters", {
    ...monster,
    source: "Test Source",
    description: "Canonical description",
    spellcasting: [{
      id: "innate",
      name: "Innate Spellcasting",
      description: "The guardian casts spells.",
      category: null,
      recharge: null,
      attack: null,
      attacks: [],
    }],
    spells: [{ id: "s_test", name: "Test Spell" }],
    classification: {
      ...(monster.classification as Record<string, unknown>),
      alignment: "Neutral",
    },
  }, replacement);

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

test("legacy XML conversion returns one native bundle without a destination database", () => {
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

test("native batch parser normalizes earlier V2 spell exports during migration", () => {
  const legacyV2Spell: Record<string, unknown> = {
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
  legacyV2Spell.school = "EV";
  legacyV2Spell.source = null;
  legacyV2Spell.classes = ["School: Evocation", "Wizard", "Wizard"];
  (legacyV2Spell.casting as Record<string, unknown>).time = "Action";
  ((legacyV2Spell.casting as Record<string, unknown>).duration as Record<string, unknown>).description =
    "Concentration, up to 10 minute";
  legacyV2Spell.description = ["A spell.\n\nSource:\tTest Grimoire p. 12"];

  const parsed = parseNativeCompendiumBatch(batch("spells", [legacyV2Spell]));
  const spell = parsed.entries[0]!;
  assert.equal(spell.school, "Evocation");
  assert.equal(spell.source, "Test Grimoire p. 12");
  assert.deepEqual(spell.classes, ["Wizard"]);
  assert.equal((spell.casting as Record<string, unknown>).time, "Action");
  assert.equal(
    ((spell.casting as Record<string, unknown>).duration as Record<string, unknown>).description,
    "Concentration, up to 10 Minutes",
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
