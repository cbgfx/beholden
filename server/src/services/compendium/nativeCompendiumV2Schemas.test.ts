import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  MonsterSchema,
  ItemSchema,
  SpellSchema,
  ClassSchema,
  SpeciesSchema,
  BackgroundSchema,
  FeatSchema,
  DeckSchema,
  BastionSchema,
  CATEGORY_SCHEMAS,
  parseCanonicalV2Entry,
  formatCanonicalV2Issues,
  type NativeCompendiumCategory,
} from "./nativeCompendiumV2Schemas.js";

// ── Canonical samples (mirror nativeCompendium.test.ts) ──────────────────────

const validMonster = {
  id: "m_test_guardian",
  name: "Test Guardian",
  classification: {
    size: "M", type: "construct", description: "Medium construct",
  },
  challenge: { rating: "2", numeric: 2, xp: 450 },
  armorClass: { value: 15 },
  hitPoints: { average: 30, formula: "4d8 + 12" },
  movement: { walk: 30 },
  abilities: { str: 14, dex: 10, con: 16, int: 3, wis: 10, cha: 5 },
  actions: [{
    id: "strike",
    name: "Strike",
    description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage.",
    attack: { toHit: 4, reach: "5ft", melee: true, damage: "1d8+2", damageType: "slashing" },
  }],
};

const validItem = {
  id: "i_test_blade",
  name: "Test Blade",
  type: "Melee Weapon",
  rarity: "rare",
  magical: true,
  equippable: true,
  weight: 3,
  value: 100,
  proficiency: "Martial Weapons",
  weapon: {
    damage: "1d8", twoHandedDamage: "1d10", damageType: "S", properties: ["V"],
  },
  description: "Test rules.",
};

const validSpell = {
  id: "s_test_spark",
  name: "Test Spark",
  level: 1,
  school: "Evocation",
  casting: {
    time: "1 action",
    range: "60 feet",
    components: { verbal: true as const, somatic: true as const },
    duration: { description: "Instantaneous" },
  },
  classes: ["Wizard"],
  description: ["Test spell."],
};

const validClass = {
  id: "c_test",
  name: "Test Class",
  description: "A test class.",
  hitDie: 8,
  proficiencies: {
    savingThrows: ["int", "wis"],
    skills: { choose: 2, from: ["Arcana", "History"] },
    armor: ["Light Armor"],
    weapons: ["Simple Weapons"],
  },
  spellcasting: { ability: "int", slotRecovery: "long_rest" },
  levels: [{
    level: 1,
    cantripsKnown: 2,
    spellSlots: { "1": 2 },
  }],
};

const validSpecies = {
  id: "r_test",
  name: "Test Species",
  size: "M",
  speed: 30,
  vision: [],
  traits: [],
};

const validBackground = {
  id: "bg_test",
  name: "Test Background",
  description: "A compact test background.",
  proficiencies: {
    skills: ["Insight", "Religion"],
    abilityScores: ["Intelligence", "Wisdom", "Charisma"],
  },
};

const validFeat = {
  id: "f_test",
  name: "Test Feat",
  category: "General",
  description: "Test feat.",
};

const validDeck = {
  schemaVersion: 2,
  id: "deck:test:one",
  deckName: "Test Deck",
  deckKey: "test",
  cardName: "One",
  cardKey: "one",
  text: "Test card.",
  sort: 1,
};

const validBastionSpace = { schemaVersion: 2, kind: "space", id: "bastion-space:test", name: "Test Space", squares: 4, sort: 1 };
const validBastionOrder = { schemaVersion: 2, kind: "order", id: "bastion-order:test", name: "Test Order", sort: 1 };
const validBastionFacility = {
  schemaVersion: 2,
  kind: "facility",
  id: "bastion-facility:test",
  name: "Test Facility",
  facilityType: "special",
  orders: ["Test Order"],
  description: "Test facility.",
};

// ── Helper ────────────────────────────────────────────────────────────────────

function fails(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown): void {
  const result = schema.safeParse(value);
  assert.equal(result.success, false, "Expected validation to fail but it passed");
}

function passes(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown): void {
  const result = schema.safeParse(value);
  assert.equal(result.success, true, "Expected validation to pass but it failed");
}

// ── Monster ───────────────────────────────────────────────────────────────────

test("MonsterSchema: accepts canonical sample", () => {
  passes(MonsterSchema, validMonster);
});

test("MonsterSchema: uses the batch version instead of repeating it per entry", () => {
  passes(MonsterSchema, validMonster);
  fails(MonsterSchema, { ...validMonster, schemaVersion: 1 });
});

test("MonsterSchema: accepts omitted inapplicable ability scores", () => {
  passes(MonsterSchema, { ...validMonster, abilities: { str: 14 } });
});

test("MonsterSchema: accepts action without attack", () => {
  const noAttack = {
    ...validMonster,
    actions: [{
      id: "roar", name: "Roar", description: "The creature roars.",
    }],
  };
  passes(MonsterSchema, noAttack);
});

test("MonsterSchema: rejects negative XP", () => {
  fails(MonsterSchema, { ...validMonster, challenge: { rating: "2", numeric: 2, xp: -1 } });
});

test("MonsterSchema: rejects ability score below 1", () => {
  fails(MonsterSchema, { ...validMonster, abilities: { str: 0, dex: 10, con: 16, int: 3, wis: 10, cha: 5 } });
});

test("MonsterSchema: rejects ability score above 30", () => {
  fails(MonsterSchema, { ...validMonster, abilities: { str: 31, dex: 10, con: 16, int: 3, wis: 10, cha: 5 } });
});

test("MonsterSchema: rejects fractional ability score", () => {
  fails(MonsterSchema, { ...validMonster, abilities: { str: 14.5, dex: 10, con: 16, int: 3, wis: 10, cha: 5 } });
});

test("MonsterSchema: rejects negative armorClass value", () => {
  fails(MonsterSchema, { ...validMonster, armorClass: { value: -1 } });
});

test("MonsterSchema: rejects negative hitPoints average", () => {
  fails(MonsterSchema, { ...validMonster, hitPoints: { average: -5 } });
});

test("MonsterSchema: rejects negative movement value", () => {
  fails(MonsterSchema, { ...validMonster, movement: { walk: -10 } });
});

test("MonsterSchema: rejects unknown field in armorClass", () => {
  fails(MonsterSchema, { ...validMonster, armorClass: { value: 15, extra: "nope" } });
});

test("MonsterSchema: rejects unknown field in classification", () => {
  fails(MonsterSchema, {
    ...validMonster,
    classification: { size: "M", type: "construct", description: "Medium construct", alignment: "neutral", extra: true },
  });
});

test("MonsterSchema: rejects unknown top-level field", () => {
  fails(MonsterSchema, { ...validMonster, alignment: "lawful neutral" });
});

test("MonsterSchema: rejects duplicate action IDs", () => {
  const dup = {
    ...validMonster,
    actions: [
      { id: "strike", name: "Strike", description: "Hit." },
      { id: "strike", name: "Strike Again", description: "Hit again." },
    ],
  };
  fails(MonsterSchema, dup);
});

test("MonsterSchema: rejects duplicate trait IDs", () => {
  const dup = {
    ...validMonster,
    traits: [
      { id: "keen", name: "Keen Senses", description: "Advantage on perception." },
      { id: "keen", name: "Keen Senses Duplicate", description: "Duplicate." },
    ],
  };
  fails(MonsterSchema, dup);
});

test("MonsterSchema: rejects missing id", () => {
  const { id: _id, ...noId } = validMonster;
  fails(MonsterSchema, noId);
});

test("MonsterSchema: rejects invalid SIZE in classification", () => {
  fails(MonsterSchema, { ...validMonster, classification: { ...validMonster.classification, size: "X" } });
});

// ── Item ──────────────────────────────────────────────────────────────────────

test("ItemSchema: accepts canonical sample", () => {
  passes(ItemSchema, validItem);
});

test("ItemSchema: accepts an item with every optional field omitted", () => {
  passes(ItemSchema, {
    id: "i_rope",
    name: "Rope",
    type: "Adventuring Gear",
    rarity: "common",
    description: "",
  });
});

test("ItemSchema: rejects negative value", () => {
  fails(ItemSchema, { ...validItem, value: -50 });
});

test("ItemSchema: rejects negative weight", () => {
  fails(ItemSchema, { ...validItem, weight: -1 });
});

test("ItemSchema: rejects negative armor class", () => {
  fails(ItemSchema, { ...validItem, armor: { ac: -2 } });
});

test("ItemSchema: rejects unknown field in armor", () => {
  fails(ItemSchema, { ...validItem, armor: { ac: 18, bonus: 2 } });
});

test("ItemSchema: rejects unknown field in weapon", () => {
  fails(ItemSchema, { ...validItem, weapon: { ...validItem.weapon, extraDamage: "1d4" } });
});

test("ItemSchema: rejects unknown top-level field", () => {
  fails(ItemSchema, { ...validItem, enchantments: [] });
});

// ── Spell ─────────────────────────────────────────────────────────────────────

test("SpellSchema: accepts canonical sample", () => {
  passes(SpellSchema, validSpell);
});

test("SpellSchema: accepts a spell with all default fields omitted", () => {
  passes(SpellSchema, {
    id: "s_spell_like_feature",
    name: "Spell-like Feature",
    description: ["Feature text."],
  });
});

test("SpellSchema: rejects the old per-entry schema version", () => {
  fails(SpellSchema, { ...validSpell, schemaVersion: 2 });
});

test("SpellSchema: rejects abbreviated school codes", () => {
  fails(SpellSchema, { ...validSpell, school: "EV" });
});

test("SpellSchema: accepts cantrip (level 0)", () => {
  passes(SpellSchema, { ...validSpell, level: 0 });
});

test("SpellSchema: accepts 9th-level spell", () => {
  passes(SpellSchema, { ...validSpell, level: 9 });
});

test("SpellSchema: rejects level above 9", () => {
  fails(SpellSchema, { ...validSpell, level: 10 });
});

test("SpellSchema: rejects negative level", () => {
  fails(SpellSchema, { ...validSpell, level: -1 });
});

test("SpellSchema: rejects fractional level", () => {
  fails(SpellSchema, { ...validSpell, level: 1.5 });
});

test("SpellSchema: rejects unknown field in casting", () => {
  fails(SpellSchema, { ...validSpell, casting: { ...validSpell.casting, prepared: true } });
});

test("SpellSchema: rejects unknown field in casting.components", () => {
  fails(SpellSchema, {
    ...validSpell,
    casting: {
      ...validSpell.casting,
      components: { ...validSpell.casting.components, focus: true },
    },
  });
});

test("SpellSchema: rejects the old verbose material object", () => {
  fails(SpellSchema, {
    ...validSpell,
    casting: {
      ...validSpell.casting,
      components: {
        ...validSpell.casting.components,
        material: { required: true, description: "50 gp" },
      },
    },
  });
});

test("SpellSchema: rejects unknown field in casting.duration", () => {
  fails(SpellSchema, {
    ...validSpell,
    casting: {
      ...validSpell.casting,
      duration: { description: "Instantaneous", permanent: true },
    },
  });
});

// ── Class ─────────────────────────────────────────────────────────────────────

test("ClassSchema: accepts canonical sample", () => {
  passes(ClassSchema, validClass);
});

test("ClassSchema: accepts class with features and resources", () => {
  const withFeatures = {
    ...validClass,
    levels: [{
      level: 1,
      cantripsKnown: 2,
      spellSlots: { "1": 2 },
      features: [
        { id: "spellcasting", name: "Spellcasting", description: "You can cast spells." },
        { id: "arcane_recovery", name: "Arcane Recovery", description: "Recover spell slots." },
      ],
      resources: [
        { name: "Arcane Recovery Uses", uses: 1, recovery: "long_rest" },
      ],
    }],
  };
  passes(ClassSchema, withFeatures);
});

test("ClassSchema: accepts absent optional fields", () => {
  passes(ClassSchema, {
    id: "c_bare",
    name: "Bare Class",
    description: "",
    proficiencies: { savingThrows: ["str", "con"], skills: { choose: 0, from: [] }, armor: [], weapons: [] },
    spellcasting: { slotRecovery: "long_rest" },
    levels: [{ level: 1 }],
  });
});

test("ClassSchema: accepts abilityScoreImprovement true", () => {
  passes(ClassSchema, { ...validClass, levels: [{ level: 4, abilityScoreImprovement: true }] });
});

test("ClassSchema: rejects abilityScoreImprovement false (must be omitted)", () => {
  fails(ClassSchema, { ...validClass, levels: [{ level: 4, abilityScoreImprovement: false }] });
});

test("ClassSchema: rejects empty spellSlots object (must be omitted)", () => {
  fails(ClassSchema, { ...validClass, levels: [{ level: 1, spellSlots: {} }] });
});

test("ClassSchema: rejects empty features array (must be omitted)", () => {
  fails(ClassSchema, { ...validClass, levels: [{ level: 1, features: [] }] });
});

test("ClassSchema: rejects empty resources array (must be omitted)", () => {
  fails(ClassSchema, { ...validClass, levels: [{ level: 1, resources: [] }] });
});

test("ClassSchema: rejects empty tools object (must be omitted)", () => {
  fails(ClassSchema, { ...validClass, proficiencies: { ...validClass.proficiencies, tools: {} } });
});

test("ClassSchema: rejects duplicate level numbers", () => {
  fails(ClassSchema, {
    ...validClass,
    levels: [{ level: 1 }, { level: 1 }],
  });
});

test("ClassSchema: rejects level number above 20", () => {
  fails(ClassSchema, { ...validClass, levels: [{ level: 21 }] });
});

test("ClassSchema: rejects level number below 1", () => {
  fails(ClassSchema, { ...validClass, levels: [{ level: 0 }] });
});

test("ClassSchema: rejects invalid slotRecovery value", () => {
  fails(ClassSchema, { ...validClass, spellcasting: { ability: "int", slotRecovery: "dawn" } });
});

test("ClassSchema: rejects saving throw that is not an ability name", () => {
  fails(ClassSchema, {
    ...validClass,
    proficiencies: { ...validClass.proficiencies, savingThrows: ["intelligence", "wisdom"] },
  });
});

test("ClassSchema: rejects negative resource uses", () => {
  fails(ClassSchema, {
    ...validClass,
    levels: [{
      ...validClass.levels[0],
      resources: [{ name: "Ki", uses: -1, recovery: "short_rest" }],
    }],
  });
});

test("ClassSchema: rejects fractional cantripsKnown", () => {
  fails(ClassSchema, {
    ...validClass,
    levels: [{ ...validClass.levels[0], cantripsKnown: 1.5 }],
  });
});

test("ClassSchema: rejects duplicate feature IDs within a level", () => {
  fails(ClassSchema, {
    ...validClass,
    levels: [{
      level: 1,
      features: [
        { id: "feat_a", name: "Feature A", description: "" },
        { id: "feat_a", name: "Feature A Again", description: "" },
      ],
    }],
  });
});

test("ClassSchema: rejects unknown field in proficiencies", () => {
  fails(ClassSchema, {
    ...validClass,
    proficiencies: { ...validClass.proficiencies, shields: ["all"] },
  });
});

test("ClassSchema: rejects negative spellSlot count", () => {
  fails(ClassSchema, {
    ...validClass,
    levels: [{ ...validClass.levels[0], spellSlots: { "1": -1 } }],
  });
});

// ── Species ───────────────────────────────────────────────────────────────────

test("SpeciesSchema: accepts canonical sample", () => {
  passes(SpeciesSchema, validSpecies);
});

test("SpeciesSchema: accepts species with vision and traits", () => {
  const full = {
    ...validSpecies,
    vision: [{ type: "darkvision", range: 60 }],
    traits: [{ id: "darkvision", name: "Darkvision", description: "See in the dark." }],
  };
  passes(SpeciesSchema, full);
});

test("SpeciesSchema: accepts absent optional fields", () => {
  passes(SpeciesSchema, { id: "r_x", name: "Bare", speed: 30, vision: [], traits: [] });
});

test("SpeciesSchema: accepts non-default choices", () => {
  const withChoices = {
    ...validSpecies,
    choices: { hasChosenSize: true as const, skillChoice: { count: 1, from: null } },
  };
  passes(SpeciesSchema, withChoices);
});

test("SpeciesSchema: rejects empty choices object (must be omitted instead)", () => {
  fails(SpeciesSchema, { ...validSpecies, choices: {} });
});

test("SpeciesSchema: accepts trait with scaling roll", () => {
  const withTrait = {
    ...validSpecies,
    traits: [{ id: "t1", name: "Breath", description: "Exhale.", scalingRolls: [{ formula: "2d6" }] }],
  };
  passes(SpeciesSchema, withTrait);
});

test("SpeciesSchema: rejects empty scalingRolls array (must be omitted)", () => {
  fails(SpeciesSchema, {
    ...validSpecies,
    traits: [{ id: "t1", name: "Breath", description: "Exhale.", scalingRolls: [] }],
  });
});

test("SpeciesSchema: rejects invalid size enum", () => {
  fails(SpeciesSchema, { ...validSpecies, size: "Z" });
});

test("SpeciesSchema: rejects negative speed", () => {
  fails(SpeciesSchema, { ...validSpecies, speed: -10 });
});

test("SpeciesSchema: rejects fractional speed", () => {
  fails(SpeciesSchema, { ...validSpecies, speed: 30.5 });
});

test("SpeciesSchema: rejects negative vision range", () => {
  fails(SpeciesSchema, { ...validSpecies, vision: [{ type: "darkvision", range: -60 }] });
});

test("SpeciesSchema: rejects unknown field in vision entry", () => {
  fails(SpeciesSchema, { ...validSpecies, vision: [{ type: "darkvision", range: 60, color: "gray" }] });
});

test("SpeciesSchema: rejects unknown top-level field", () => {
  fails(SpeciesSchema, { ...validSpecies, subraces: [] });
});

// ── Background ────────────────────────────────────────────────────────────────

test("BackgroundSchema: accepts canonical sample", () => {
  passes(BackgroundSchema, validBackground);
});

test("BackgroundSchema: accepts background with traits", () => {
  const full = {
    ...validBackground,
    traits: [{ name: "Wanderer", description: "You know the roads." }],
  };
  passes(BackgroundSchema, full);
});

test("BackgroundSchema: accepts structured equipment choices", () => {
  passes(BackgroundSchema, {
    ...validBackground,
    equipment: {
      options: [
        {
          id: "A",
          entries: [
            { kind: "item", name: "Dagger", quantity: 2 },
            { kind: "currency", denomination: "GP", amount: 15 },
          ],
        },
      ],
    },
  });
});

test("BackgroundSchema: rejects invalid structured equipment quantities", () => {
  fails(BackgroundSchema, {
    ...validBackground,
    equipment: {
      description: "Invalid",
      options: [{
        id: "A",
        entries: [{ kind: "item", name: "Dagger", quantity: 0 }],
      }],
    },
  });
});

test("BackgroundSchema: rejects unknown field in equipment", () => {
  fails(BackgroundSchema, { ...validBackground, equipment: { description: "Pack", weight: 5 } });
});

test("BackgroundSchema: rejects missing equipment description", () => {
  fails(BackgroundSchema, { ...validBackground, equipment: {} });
});

test("BackgroundSchema: rejects unknown top-level field", () => {
  fails(BackgroundSchema, { ...validBackground, ideals: [] });
});

// ── Feat ──────────────────────────────────────────────────────────────────────

test("FeatSchema: accepts canonical sample", () => {
  passes(FeatSchema, validFeat);
});

test("FeatSchema: rejects the old per-entry schema version", () => {
  fails(FeatSchema, { ...validFeat, schemaVersion: 2 });
});

test("FeatSchema: accepts string prerequisite", () => {
  passes(FeatSchema, { ...validFeat, prerequisite: "Proficiency with martial weapons" });
});

test("FeatSchema: accepts object prerequisite", () => {
  passes(FeatSchema, { ...validFeat, prerequisite: { level: 4, ability: "str", minimum: 13 } });
});

test("FeatSchema: rejects unknown top-level field", () => {
  fails(FeatSchema, { ...validFeat, benefit: "You gain +1 to Strength." });
});

test("FeatSchema: rejects unknown mechanic fields", () => {
  fails(FeatSchema, { ...validFeat, mechanics: { inventedMechanic: true } });
});

test("ClassSchema: rejects unknown structured effect kinds", () => {
  fails(ClassSchema, {
    ...validClass,
    levels: [{
      level: 1,
      features: [{
        id: "mystery",
        name: "Mystery",
        description: "",
        effects: [{ kind: "invented_effect", value: "oops" }],
      }],
    }],
  });
});

test("FeatSchema: accepts repeatable only when true", () => {
  passes(FeatSchema, { ...validFeat, repeatable: true });
  fails(FeatSchema, { ...validFeat, repeatable: false });
});

test("FeatSchema: accepts absent category", () => {
  const { category: _category, ...withoutCategory } = validFeat;
  passes(FeatSchema, withoutCategory);
});

test("FeatSchema: accepts absent prerequisite", () => {
  passes(FeatSchema, validFeat);
});

test("FeatSchema: accepts sparse mechanics — no grants, choices, or uses", () => {
  passes(FeatSchema, {
    ...validFeat,
    mechanics: { baseName: "Test Feat", source: "Test Source" },
  });
});

test("FeatSchema: rejects empty mechanics", () => {
  fails(FeatSchema, { ...validFeat, mechanics: {} });
});

test("FeatSchema: accepts mechanics with partial grants", () => {
  passes(FeatSchema, {
    ...validFeat,
    mechanics: {
      baseName: "Test Feat",
      grants: { abilityIncreases: { strength: 1 } },
    },
  });
});

test("FeatSchema: rejects number as prerequisite", () => {
  fails(FeatSchema, { ...validFeat, prerequisite: 4 });
});

test("FeatSchema: rejects boolean as prerequisite", () => {
  fails(FeatSchema, { ...validFeat, prerequisite: true });
});

// ── Deck ──────────────────────────────────────────────────────────────────────

test("DeckSchema: accepts canonical sample", () => {
  passes(DeckSchema, validDeck);
});

test("DeckSchema: rejects missing sort field", () => {
  const { sort: _s, ...noSort } = validDeck;
  fails(DeckSchema, noSort);
});

test("DeckSchema: rejects fractional sort", () => {
  fails(DeckSchema, { ...validDeck, sort: 1.5 });
});

test("DeckSchema: rejects empty deckKey", () => {
  fails(DeckSchema, { ...validDeck, deckKey: "" });
});

test("DeckSchema: rejects unknown field", () => {
  fails(DeckSchema, { ...validDeck, flipped: false });
});

// ── Bastion ───────────────────────────────────────────────────────────────────

test("BastionSchema: accepts space entry", () => {
  passes(BastionSchema, validBastionSpace);
});

test("BastionSchema: accepts order entry", () => {
  passes(BastionSchema, validBastionOrder);
});

test("BastionSchema: accepts facility entry", () => {
  passes(BastionSchema, validBastionFacility);
});

test("BastionSchema: accepts space with optional fields", () => {
  passes(BastionSchema, { ...validBastionSpace, nameKey: "test_space", minimumLevel: 5 });
});

test("BastionSchema: accepts facility with optional sort and hirelings", () => {
  passes(BastionSchema, { ...validBastionFacility, sort: 3, hirelings: 2, allowMultiple: false });
});

test("BastionSchema: rejects invalid kind", () => {
  fails(BastionSchema, { kind: "room", id: "bastion-room:test", name: "Room", sort: 1 });
});

test("BastionSchema: rejects space without squares", () => {
  const { squares: _sq, ...noSquares } = validBastionSpace;
  fails(BastionSchema, noSquares);
});

test("BastionSchema: rejects space with zero squares", () => {
  fails(BastionSchema, { ...validBastionSpace, squares: 0 });
});

test("BastionSchema: rejects facility without description", () => {
  const { description: _d, ...noDesc } = validBastionFacility;
  fails(BastionSchema, noDesc);
});

test("BastionSchema: rejects facility without facilityType", () => {
  const { facilityType: _ft, ...noType } = validBastionFacility;
  fails(BastionSchema, noType);
});

test("BastionSchema: rejects unknown field on space", () => {
  fails(BastionSchema, { ...validBastionSpace, description: "A room." });
});

test("BastionSchema: rejects unknown field on order", () => {
  fails(BastionSchema, { ...validBastionOrder, orders: [] });
});

test("BastionSchema: rejects minimumLevel above 20", () => {
  fails(BastionSchema, { ...validBastionSpace, minimumLevel: 21 });
});

// ── CATEGORY_SCHEMAS ─────────────────────────────────────────────────────────

test("CATEGORY_SCHEMAS covers all nine categories", () => {
  const categories: NativeCompendiumCategory[] = [
    "monsters", "items", "spells", "classes", "species", "backgrounds", "feats", "decks", "bastions",
  ];
  for (const cat of categories) {
    assert.ok(cat in CATEGORY_SCHEMAS, `Missing schema for category: ${cat}`);
  }
  assert.equal(Object.keys(CATEGORY_SCHEMAS).length, 9);
});

// ── parseCanonicalV2Entry ─────────────────────────────────────────────────────

test("parseCanonicalV2Entry returns parsed monster", () => {
  const result = parseCanonicalV2Entry("monsters", validMonster);
  assert.ok(result && typeof result === "object");
});

test("parseCanonicalV2Entry returns parsed bastion space", () => {
  const result = parseCanonicalV2Entry("bastions", validBastionSpace);
  assert.ok(result && typeof result === "object");
});

test("parseCanonicalV2Entry throws ZodError for invalid monster", () => {
  assert.throws(
    () => parseCanonicalV2Entry("monsters", { ...validMonster, challenge: { rating: "2", numeric: 2, xp: -100 } }),
    (err) => err instanceof ZodError,
  );
});

test("parseCanonicalV2Entry throws ZodError for unknown category field", () => {
  assert.throws(
    () => parseCanonicalV2Entry("items", { ...validItem, unknownField: true }),
    (err) => err instanceof ZodError,
  );
});

// ── formatCanonicalV2Issues ───────────────────────────────────────────────────

test("formatCanonicalV2Issues renders root-level path", () => {
  const result = MonsterSchema.safeParse({ ...validMonster, id: "" });
  assert.equal(result.success, false);
  const msg = formatCanonicalV2Issues(result.error!);
  assert.ok(msg.includes("id:"), `Expected "id:" in: ${msg}`);
});

test("formatCanonicalV2Issues renders nested path for armorClass.value", () => {
  const result = MonsterSchema.safeParse({ ...validMonster, armorClass: { value: -5 } });
  assert.equal(result.success, false);
  const msg = formatCanonicalV2Issues(result.error!);
  assert.ok(msg.includes("armorClass.value"), `Expected "armorClass.value" in: ${msg}`);
});

test("formatCanonicalV2Issues renders deeply nested path for casting component", () => {
  const result = SpellSchema.safeParse({
    ...validSpell,
    casting: {
      ...validSpell.casting,
      components: {
        ...validSpell.casting.components,
        material: { required: true, description: "50 gp", extra: "bad" },
      },
    },
  });
  assert.equal(result.success, false);
  const msg = formatCanonicalV2Issues(result.error!);
  assert.ok(
    msg.includes("casting.components.material"),
    `Expected "casting.components.material" in: ${msg}`,
  );
});

test("formatCanonicalV2Issues renders duplicate action ID path", () => {
  const result = MonsterSchema.safeParse({
    ...validMonster,
    actions: [
      { id: "bite", name: "Bite", description: "Chomp." },
      { id: "bite", name: "Bite Again", description: "Chomp harder." },
    ],
  });
  assert.equal(result.success, false);
  const msg = formatCanonicalV2Issues(result.error!);
  assert.ok(msg.includes("actions.1.id"), `Expected "actions.1.id" in: ${msg}`);
});

test("formatCanonicalV2Issues renders class duplicate level path", () => {
  const result = ClassSchema.safeParse({
    ...validClass,
    levels: [
      { level: 2 },
      { level: 2 },
    ],
  });
  assert.equal(result.success, false);
  const msg = formatCanonicalV2Issues(result.error!);
  assert.ok(msg.includes("levels.1.level"), `Expected "levels.1.level" in: ${msg}`);
});
