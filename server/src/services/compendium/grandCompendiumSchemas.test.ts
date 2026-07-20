import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  MonsterSchema,
  ItemSchema,
  SpellSchema,
  ClassTalentSchema,
  ClassSchema,
  SpeciesSchema,
  BackgroundSchema,
  FeatSchema,
  DeckSchema,
  BastionSchema,
  CATEGORY_SCHEMAS,
  parseGrandCompendiumEntry,
  formatGrandCompendiumIssues,
  type NativeCompendiumCategory,
} from "./grandCompendiumSchemas.js";

// ── Canonical samples (mirror nativeCompendium.test.ts) ──────────────────────

const validMonster = {
  id: "m_test_guardian",
  ruleset: "5.5e",
  name: "Test Guardian",
  classification: {
    size: "M", type: "construct", description: "Medium construct",
  },
  challenge: { rating: "2", xp: 450 },
  armorClass: { value: 15 },
  hitPoints: { average: 30, formula: "4d8 + 12" },
  movement: { walk: 30 },
  abilities: { str: 14, dex: 10, con: 16, int: 3, wis: 10, cha: 5 },
  actions: [{
    id: "strike",
    name: "Strike",
    description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage.",
    attack: { toHit: 4, reach: "5ft", melee: true },
    damage: { roll: "1d8+2", type: "slashing" },
  }],
};

const validItem = {
  id: "i_test_blade",
  ruleset: "5.5e",
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
  ruleset: "5.5e",
  name: "Test Spark",
  level: 1,
  school: "Evocation",
  casting: {
    time: "1 action",
    range: "60 feet",
    components: { verbal: true as const, somatic: true as const },
    duration: { description: "Instantaneous" },
  },
  access: ["sl_wizard"],
  description: ["Test spell."],
};

const validClass = {
  id: "c_test",
  ruleset: "5.5e",
  name: "Test Class",
  description: "A test class.",
  hitDie: 8,
  primaryAbility: "int",
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
  ruleset: "5.5e",
  name: "Test Species",
  size: "M",
  speed: 30,
  traits: [],
};

const validBackground = {
  id: "bg_test",
  ruleset: "5.5e",
  name: "Test Background",
  description: "A compact test background.",
  proficiencies: {
    skills: ["Insight", "Religion"],
    abilityScores: ["Intelligence", "Wisdom", "Charisma"],
  },
};

const validFeat = {
  id: "f_test",
  ruleset: "5.5e",
  name: "Test Feat",
  description: "Test feat.",
};

const validDeck = {
  schemaVersion: 2,
  ruleset: "5.5e",
  id: "deck:test:one",
  deckName: "Test Deck",
  deckKey: "test",
  cardName: "One",
  cardKey: "one",
  text: "Test card.",
  sort: 1,
};

const validBastionSpace = { schemaVersion: 2, ruleset: "5.5e", kind: "space", id: "bastion-space:test", name: "Test Space", squares: 4, sort: 1 };
const validBastionOrder = { schemaVersion: 2, ruleset: "5.5e", kind: "order", id: "bastion-order:test", name: "Test Order", sort: 1 };
const validBastionFacility = {
  schemaVersion: 2,
  ruleset: "5.5e",
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

test("Grand entries require a supported ruleset", () => {
  passes(MonsterSchema, { ...validMonster, ruleset: "5e" });
  const { ruleset: _ruleset, ...missingRuleset } = validMonster;
  fails(MonsterSchema, missingRuleset);
  fails(MonsterSchema, { ...validMonster, ruleset: "6e" });
});

test("MonsterSchema: accepts a reviewed choice of damage types", () => {
  passes(MonsterSchema, {
    ...validMonster,
    actions: [{ ...validMonster.actions[0], damage: { roll: "1d6+3", type: ["acid", "cold", "fire"] } }],
  });
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

test("MonsterSchema: accepts compact Multiattack routines and replacements", () => {
  passes(MonsterSchema, {
    ...validMonster,
    actions: [
      { id: "multiattack", name: "Multiattack", description: "Makes two attacks.", routine: [{ choose: ["strike", "bolt"], count: 2 }], replace: { with: ["roar"] } },
      validMonster.actions[0],
      { id: "bolt", name: "Bolt", description: "A ranged attack." },
      { id: "roar", name: "Roar", description: "A frightening roar." },
    ],
  });
});

test("MonsterSchema: rejects broken or recursive Multiattack references", () => {
  fails(MonsterSchema, {
    ...validMonster,
    actions: [
      { id: "multiattack", name: "Multiattack", description: "Makes two attacks.", routine: [{ use: "missing", count: 2 }] },
      validMonster.actions[0],
    ],
  });
  fails(MonsterSchema, {
    ...validMonster,
    actions: [{ id: "multiattack", name: "Multiattack", description: "Repeats itself.", routine: [{ use: "multiattack", count: 2 }] }],
  });
});

test("MonsterSchema: accepts compact area and selected-target facts", () => {
  passes(MonsterSchema, { ...validMonster, actions: [{ ...validMonster.actions[0], area: "cone" }] });
  passes(MonsterSchema, { ...validMonster, actions: [{ ...validMonster.actions[0], targets: 3 }] });
});

test("MonsterSchema: rejects contradictory or meaningless target facts", () => {
  fails(MonsterSchema, { ...validMonster, actions: [{ ...validMonster.actions[0], area: "cone", targets: 3 }] });
  fails(MonsterSchema, { ...validMonster, actions: [{ ...validMonster.actions[0], targets: 1 }] });
});

test("MonsterSchema: accepts compact recharge facts and rejects conversion metadata", () => {
  passes(MonsterSchema, { ...validMonster, actions: [{ ...validMonster.actions[0], recharge: { roll: 5 } }] });
  passes(MonsterSchema, { ...validMonster, actions: [{ ...validMonster.actions[0], recharge: { uses: 3, period: "day" } }] });
  passes(MonsterSchema, { ...validMonster, actions: [{ ...validMonster.actions[0], recharge: { period: "long_rest" } }] });
  fails(MonsterSchema, { ...validMonster, actions: [{ ...validMonster.actions[0], recharge: { kind: "roll", minimumRoll: 5, source: "D5" } }] });
});

test("MonsterSchema: keeps legendary economy and lair narrative out of action entries", () => {
  passes(MonsterSchema, {
    ...validMonster,
    legendaryUses: 3,
    legendaryActions: [{ id: "lash", name: "Lash", description: "Makes one Strike attack." }],
    lair: [{ name: "Test Lair", description: "The guardian's lair has special effects." }],
  });
  fails(MonsterSchema, { ...validMonster, legendaryUses: 3 });
  fails(MonsterSchema, {
    ...validMonster,
    legendaryActions: [{ id: "header", name: "Legendary Actions (3/Turn)", description: "Header.", category: "lair" }],
  });
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

test("MonsterSchema: rejects zero armor class and hit points", () => {
  fails(MonsterSchema, { ...validMonster, armorClass: { value: 0 } });
  fails(MonsterSchema, { ...validMonster, hitPoints: { average: 0 } });
});

test("MonsterSchema: permits omitted AC and HP for unresolved variable stat blocks", () => {
  const { armorClass: _armorClass, hitPoints: _hitPoints, ...variableMonster } = validMonster;
  passes(MonsterSchema, variableMonster);
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
    ruleset: "5.5e",
    name: "Rope",
    type: "Adventuring Gear",
    rarity: "common",
    description: "",
  });
});

test("ItemSchema: accepts a canonical weapon mastery assignment", () => {
  passes(ItemSchema, { ...validItem, weapon: { ...validItem.weapon, mastery: "Sap" } });
});

test("ItemSchema: rejects an invented weapon mastery assignment", () => {
  fails(ItemSchema, { ...validItem, weapon: { ...validItem.weapon, mastery: "Smash" } });
});

test("ItemSchema: rejects contradictory weapon and shield facts", () => {
  fails(ItemSchema, { ...validItem, armor: { ac: 16 } });
  passes(ItemSchema, { ...validItem, type: "Shield", weapon: undefined, armor: { ac: 2 }, proficiency: "shield" });
});

test("ItemSchema: accepts exact ammunition families and rejects inconsistent placement", () => {
  passes(ItemSchema, { ...validItem, weapon: { ...validItem.weapon, properties: ["M", "A"], ammo: "arrow" } });
  passes(ItemSchema, { ...validItem, type: "Ammo", weapon: undefined, proficiency: undefined, ammo: "arrow" });
  passes(ItemSchema, { ...validItem, weapon: undefined, proficiency: undefined, usage: "held" });
  fails(ItemSchema, { ...validItem, weapon: { ...validItem.weapon, ammo: "arrow" } });
  fails(ItemSchema, { ...validItem, ammo: "arrow" });
  fails(ItemSchema, { ...validItem, type: "Ammo", weapon: undefined, proficiency: undefined, ammo: "rocket" });
});

test("ItemSchema: accepts compact canonical bundles and rejects ambiguous contents", () => {
  passes(ItemSchema, {
    ...validItem,
    bundle: { container: "i_backpack", items: { i_torch: 10, i_rations: 10 } },
  });
  fails(ItemSchema, { ...validItem, bundle: { container: "Backpack", items: { i_torch: 10 } } });
  fails(ItemSchema, { ...validItem, bundle: { container: "i_backpack", items: {} } });
  fails(ItemSchema, { ...validItem, bundle: { container: "i_backpack", items: { i_backpack: 1 } } });
});

test("ItemSchema: accepts sparse containers and requires a container to ignore weight", () => {
  passes(ItemSchema, { ...validItem, container: true });
  passes(ItemSchema, { ...validItem, container: true, ignoreWeight: true });
  fails(ItemSchema, { ...validItem, ignoreWeight: true });
  fails(ItemSchema, { ...validItem, container: false });
  fails(ItemSchema, { ...validItem, container: true, ignoreWeight: false });
});

test("ItemSchema: accepts shared structured item effects", () => {
  passes(ItemSchema, {
    ...validItem,
    effects: [{ type: "ability_score", mode: "set_minimum", ability: "str", choiceCount: 1, amount: 19 }],
  });
  fails(ItemSchema, { ...validItem, effects: [] });
  // `resolution` is not an Item fact — items with effects are inherently mixed; the label
  // carried no information and was removed.
  fails(ItemSchema, { ...validItem, resolution: "mixed" });
});

test("ItemSchema: accepts compact item use pools and typed depletion outcomes", () => {
  passes(ItemSchema, { ...validItem, uses: 7 });
  passes(ItemSchema, { ...validItem, uses: { max: 7, recover: "1d6+1", depletion: { destroy: 1 } } });
  passes(ItemSchema, { ...validItem, uses: { max: "1d8+1", recover: false, depletion: "mundane" } });
  passes(ItemSchema, { ...validItem, uses: { max: 20, recover: "2d8+4", depletion: { loseProperties: 1, regain: { "20": "1d8+2" } } } });
});

test("ItemSchema: rejects ambiguous or invalid item use pools", () => {
  fails(ItemSchema, { ...validItem, uses: 0 });
  fails(ItemSchema, { ...validItem, uses: { max: 7 } });
  fails(ItemSchema, { ...validItem, uses: { max: "seven", recover: false } });
  fails(ItemSchema, { ...validItem, uses: { max: 7, depletion: { destroy: 21 } } });
  fails(ItemSchema, { ...validItem, uses: { max: 7, depletion: {} } });
});

test("ItemSchema: accepts compact item spell access by canonical ID", () => {
  passes(ItemSchema, { ...validItem, spells: { s_magic_missile: 1, s_light: 0 } });
  passes(ItemSchema, { ...validItem, spells: { s_fireball: { cost: 5, level: 5 }, s_cure_wounds: { cost: "level", maxLevel: 4 } }, spellcasting: "character" });
  passes(ItemSchema, { ...validItem, spells: { s_hold_person: 2 }, spellcasting: { dc: 17 } });
  passes(ItemSchema, { ...validItem, spells: { s_wish: { uses: "1d3" } } });
});

test("ItemSchema: accepts bound, stored, choice, and explicit random spell templates", () => {
  passes(ItemSchema, { ...validItem, spellTemplate: { kind: "bound", level: 3, list: "class", consume: true, dc: 15 } });
  passes(ItemSchema, { ...validItem, spellTemplate: { kind: "stored", capacity: 5, minLevel: 1, maxLevel: 5 } });
  passes(ItemSchema, { ...validItem, spellTemplate: { kind: "choice", list: "Wizard", minLevel: 1, uses: 1, recovery: "short_rest" } });
  passes(ItemSchema, { ...validItem, spellTemplate: [
    { kind: "choice", list: "Wizard", minLevel: 1, uses: 1 },
    { kind: "random", die: "1d10", when: "choice_failed", outcomes: { "1-2": "s_fireball", "3": { id: "s_invisibility", note: "self" } } },
  ] });
});

test("ItemSchema: rejects vague or malformed random spell templates", () => {
  fails(ItemSchema, { ...validItem, spellTemplate: { kind: "random", die: "d100", outcomes: { "1": "s_fireball" } } });
  fails(ItemSchema, { ...validItem, spellTemplate: { kind: "random", die: "1d100", outcomes: {} } });
  fails(ItemSchema, { ...validItem, spellTemplate: { kind: "random", die: "1d100", outcomes: { low: "s_fireball" } } });
  fails(ItemSchema, { ...validItem, spellTemplate: [{ kind: "choice", list: "Wizard" }] });
});

test("ItemSchema: rejects unresolved or empty item spell access", () => {
  fails(ItemSchema, { ...validItem, spells: {} });
  fails(ItemSchema, { ...validItem, spells: { magic_missile: 1 } });
  fails(ItemSchema, { ...validItem, spells: { s_magic_missile: -1 } });
  fails(ItemSchema, { ...validItem, spells: { s_magic_missile: {} } });
  fails(ItemSchema, { ...validItem, spells: { s_magic_missile: 1 }, spellcasting: {} });
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

test("SpellSchema: accepts compact typed checks and mixed damage display", () => {
  passes(SpellSchema, {
    ...validSpell,
    check: ["attack", "dex"],
    rolls: [{ formula: "5d6+5d6", effect: ["fire", "radiant"] }],
  });
});

test("SpellSchema: rejects a one-element effect array", () => {
  fails(SpellSchema, { ...validSpell, rolls: [{ formula: "1d8", effect: ["fire"] }] });
});

test("SpellSchema: accepts a spell with all default fields omitted", () => {
  passes(SpellSchema, {
    id: "s_spell_like_feature",
    ruleset: "5.5e",
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

test("ClassTalentSchema: accepts a compact invocation", () => {
  passes(ClassTalentSchema, {
    ruleset: "5.5e",
    id: "ct_invocation_test",
    name: "Invocation: Test",
    kind: "invocation",
    description: ["Test rules."],
  });
});

test("ClassTalentSchema: accepts typed prerequisites and sparse repeatability", () => {
  passes(ClassTalentSchema, {
    ruleset: "5.5e",
    id: "ct_invocation_test",
    name: "Invocation: Test",
    kind: "invocation",
    prerequisite: { level: 5, talent: "ct_invocation_pact_of_blade", cantrip: "attack_damage" },
    repeatable: true,
    description: ["Display rules."],
  });
  fails(ClassTalentSchema, {
    ruleset: "5.5e",
    id: "ct_invocation_test",
    name: "Invocation: Test",
    kind: "invocation",
    prerequisite: {},
    description: ["Display rules."],
  });
});

test("ClassTalentSchema: accepts deterministic effects without spell-shaped metadata", () => {
  passes(ClassTalentSchema, {
    ruleset: "5.5e",
    id: "ct_invocation_armor_of_shadows",
    name: "Invocation: Armor of Shadows",
    kind: "invocation",
    effects: [{ type: "spell_grant", spellName: "Mage Armor", mode: "at_will", castsWithoutSlot: true }],
    description: ["Display rules."],
  });
});

test("ClassTalentSchema: accepts typed persistent Invocation choices", () => {
  passes(ClassTalentSchema, {
    ruleset: "5.5e",
    id: "ct_invocation_repelling_blast",
    name: "Invocation: Repelling Blast",
    kind: "invocation",
    repeatable: true,
    effects: [{
      type: "spell_choice",
      choiceId: "repelling_blast_cantrip",
      mode: "select",
      count: { kind: "fixed", value: 1 },
      level: 0,
      spellLists: ["sl_warlock"],
      filters: { damage: true, attack: true, known: true },
    }],
    description: ["Display rules."],
  });
});

test("ClassTalentSchema: accepts a stable Origin Feat choice", () => {
  passes(ClassTalentSchema, {
    ruleset: "5.5e",
    id: "ct_invocation_lessons_of_the_first_ones",
    name: "Invocation: Lessons of the First Ones",
    kind: "invocation",
    repeatable: true,
    effects: [{
      type: "feat_choice",
      choiceId: "lessons_origin_feat",
      mode: "learn",
      count: { kind: "fixed", value: 1 },
      category: "origin",
    }],
    description: ["Display rules."],
  });
});

test("ClassTalentSchema: rejects spell fields and unknown kinds", () => {
  fails(ClassTalentSchema, {
    ruleset: "5.5e",
    id: "ct_invocation_test",
    name: "Invocation: Test",
    kind: "spell",
    level: 0,
    description: ["Test rules."],
  });
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

test("ClassSchema: accepts an already-known-spell fallback choice", () => {
  passes(ClassSchema, {
    ...validClass,
    levels: [{ level: 3, features: [{
      id: "improved_illusions",
      name: "Improved Illusions",
      description: "",
      choices: [{ id: "fc_improved_illusions_replacement", kind: "spell", lists: ["sl_wizard"], level: 0, mode: "known", ifKnown: "Minor Illusion" }],
    }] }],
  });
});

test("ClassSchema: accepts explicit subclass ownership and choice branches", () => {
  passes(ClassSchema, {
    ...validClass,
    subclasses: { level: 3, options: { sc_test_alpha: "Alpha", sc_test_beta: "Beta" } },
    choices: [{
      id: "cc_test_order",
      name: "Test Order",
      options: [
        { id: "cco_first", name: "First", features: ["first_feature", "first_improvement"] },
        { id: "cco_second", name: "Second", features: ["second_feature"] },
      ],
    }],
    levels: [
      { level: 1, features: [
        { id: "first_feature", name: "First", description: "" },
        { id: "second_feature", name: "Second", description: "" },
      ] },
      { level: 3, features: [{ id: "alpha_feature", name: "Alpha Feature", description: "", subclass: "sc_test_alpha" }] },
      { level: 7, features: [{ id: "first_improvement", name: "First Improvement", description: "" }] },
    ],
  });
});

test("ClassSchema: accepts compact explicit subclass spellcasting progression", () => {
  passes(ClassSchema, {
    ...validClass,
    subclasses: { level: 3, options: {
      sc_test_arcane: {
        name: "Arcane",
        spellcasting: {
          ability: "int",
          list: "sl_wizard",
          progression: [
            { level: 3, cantrips: 2, prepared: 3, slots: [2] },
            { level: 4, prepared: 4, slots: [3] },
            { level: 7, prepared: 5, slots: [4, 2] },
          ],
        },
      },
    } },
  });
});

test("ClassSchema: rejects empty and duplicate subclass spellcasting progression rows", () => {
  fails(ClassSchema, {
    ...validClass,
    subclasses: { level: 3, options: {
      sc_test_arcane: {
        name: "Arcane",
        spellcasting: { ability: "int", list: "sl_wizard", progression: [{ level: 3 }, { level: 3, slots: [2] }] },
      },
    } },
  });
});

test("ClassSchema: rejects unknown subclass ownership", () => {
  fails(ClassSchema, {
    ...validClass,
    subclasses: { level: 3, options: { sc_test_alpha: "Alpha" } },
    levels: [{ level: 3, features: [{ id: "bad", name: "Bad", description: "", subclass: "sc_test_missing" }] }],
  });
});

test("ClassSchema: rejects class choices that reference missing features", () => {
  fails(ClassSchema, {
    ...validClass,
    choices: [{ id: "cc_test", name: "Test", options: [
      { id: "cco_first", name: "First", features: ["missing"] },
      { id: "cco_second", name: "Second", features: ["also_missing"] },
    ] }],
  });
});

test("ClassSchema: accepts absent optional fields", () => {
  passes(ClassSchema, {
    id: "c_bare",
    ruleset: "5.5e",
    name: "Bare Class",
    description: "",
    primaryAbility: "str",
    proficiencies: { savingThrows: ["str", "con"], skills: { choose: 0, from: [] }, armor: [], weapons: [] },
    levels: [{ level: 1 }],
  });
});

test("ClassSchema: accepts a compact editable note template on a feature", () => {
  passes(ClassSchema, {
    ...validClass,
    levels: [{ level: 2, features: [{
      id: "plans",
      name: "Plans",
      description: "Consult the table.",
      noteTemplate: { id: "nt_artificer_plans_known", title: "Plans Known", text: "Plan 1:" },
    }] }],
  });
});

test("ClassSchema: rejects duplicate note-template identities", () => {
  fails(ClassSchema, {
    ...validClass,
    levels: [{ level: 2, features: ["First", "Second"].map((name) => ({
      name, description: "", noteTemplate: { id: "nt_duplicate", title: "Notes", text: "Entry:" },
    })) }],
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

test("SpeciesSchema: stores vision as a trait effect, not a duplicate top-level fact", () => {
  const full = {
    ...validSpecies,
    traits: [{
      id: "darkvision",
      name: "Darkvision",
      description: "See in the dark.",
      effects: [{ type: "senses", mode: "grant", senses: [{ kind: "darkvision", range: 60 }] }],
    }],
  };
  passes(SpeciesSchema, full);
});

test("SpeciesSchema: accepts absent optional fields", () => {
  passes(SpeciesSchema, { id: "r_x", ruleset: "5.5e", name: "Bare", speed: 30, traits: [] });
});

test("SpeciesSchema: rejects the retired top-level vision field", () => {
  fails(SpeciesSchema, { ...validSpecies, vision: [] });
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

test("SpeciesSchema: rejects unknown top-level field", () => {
  fails(SpeciesSchema, { ...validSpecies, subraces: [] });
});

// ── Background ────────────────────────────────────────────────────────────────

test("BackgroundSchema: accepts canonical sample", () => {
  passes(BackgroundSchema, validBackground);
});

test("BackgroundSchema: accepts fixed and constrained Feat references", () => {
  passes(BackgroundSchema, {
    ...validBackground,
    proficiencies: { ...validBackground.proficiencies, feat: "f_tough" },
  });
  passes(BackgroundSchema, {
    ...validBackground,
    proficiencies: {
      ...validBackground.proficiencies,
      featChoice: { count: 1, from: ["f_alert", "f_tough"] },
    },
  });
});

test("BackgroundSchema: rejects embedded Feat copies", () => {
  fails(BackgroundSchema, {
    ...validBackground,
    proficiencies: { ...validBackground.proficiencies, feats: [{ name: "Tough", parsed: {} }] },
  });
});

test("BackgroundSchema: accepts background with traits (shared trait contract, effects included)", () => {
  const full = {
    ...validBackground,
    traits: [{
      id: "trait_1",
      name: "Wanderer",
      description: "You have an excellent memory for maps and geography.",
      resolution: "automatic",
      effects: [{ type: "modifier", target: "skill_check", mode: "advantage", appliesTo: ["Survival"] }],
    }],
  };
  passes(BackgroundSchema, full);
});

test("BackgroundSchema: rejects a trait without an id (traits share the species trait contract)", () => {
  fails(BackgroundSchema, {
    ...validBackground,
    traits: [{ name: "Wanderer", description: "You know the roads." }],
  });
});

test("BackgroundSchema: accepts structured equipment choices", () => {
  passes(BackgroundSchema, {
    ...validBackground,
    equipment: {
      options: [
        {
          id: "A",
          entries: [
            { kind: "item", itemId: "i_dagger", quantity: 2 },
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
        entries: [{ kind: "item", itemId: "i_dagger", quantity: 0 }],
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

test("FeatSchema: uses omitted category for General and compact codes for exceptions", () => {
  passes(FeatSchema, validFeat);
  for (const category of ["O", "E", "F"]) {
    passes(FeatSchema, { ...validFeat, category });
  }
  fails(FeatSchema, { ...validFeat, category: "G" });
  fails(FeatSchema, { ...validFeat, category: "Other" });
});

test("FeatSchema: rejects the old per-entry schema version", () => {
  fails(FeatSchema, { ...validFeat, schemaVersion: 2 });
});

test("FeatSchema: rejects prose prerequisites", () => {
  fails(FeatSchema, { ...validFeat, prerequisite: "Proficiency with martial weapons" });
});

test("FeatSchema: accepts object prerequisite", () => {
  passes(FeatSchema, { ...validFeat, prerequisite: { level: 4, ability: { any: ["str"] } } });
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

test("FeatSchema: accepts absent prerequisite", () => {
  passes(FeatSchema, validFeat);
});

test("FeatSchema: rejects converter-only mechanics metadata", () => {
  fails(FeatSchema, {
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
      grants: { abilityIncreases: { strength: 1 } },
    },
  });
});

test("FeatSchema: accepts spell-linked uses and rejects ambiguous links", () => {
  passes(FeatSchema, {
    ...validFeat,
    mechanics: { uses: [{ count: 1, note: "free cast", grantsSpell: "Shield" }] },
  });
  passes(FeatSchema, {
    ...validFeat,
    mechanics: { uses: [{ count: 1, note: "free cast", grantsChoiceId: "level_1_spell" }] },
  });
  fails(FeatSchema, {
    ...validFeat,
    mechanics: { uses: [{ count: 1, note: "free cast", grantsSpell: "Shield", grantsChoiceId: "level_1_spell" }] },
  });
});

test("FeatSchema: accepts a level number as the compact prerequisite form", () => {
  passes(FeatSchema, { ...validFeat, prerequisite: 4 });
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

test("CATEGORY_SCHEMAS covers all ten categories", () => {
  const categories: NativeCompendiumCategory[] = [
    "monsters", "items", "spells", "classTalents", "classes", "species", "backgrounds", "feats", "decks", "bastions",
  ];
  for (const cat of categories) {
    assert.ok(cat in CATEGORY_SCHEMAS, `Missing schema for category: ${cat}`);
  }
  assert.equal(Object.keys(CATEGORY_SCHEMAS).length, 10);
});

// ── parseGrandCompendiumEntry ─────────────────────────────────────────────────────

test("parseGrandCompendiumEntry returns parsed monster", () => {
  const result = parseGrandCompendiumEntry("monsters", validMonster);
  assert.ok(result && typeof result === "object");
});

test("parseGrandCompendiumEntry returns parsed bastion space", () => {
  const result = parseGrandCompendiumEntry("bastions", validBastionSpace);
  assert.ok(result && typeof result === "object");
});

test("parseGrandCompendiumEntry throws ZodError for invalid monster", () => {
  assert.throws(
    () => parseGrandCompendiumEntry("monsters", { ...validMonster, challenge: { rating: "2", numeric: 2, xp: -100 } }),
    (err) => err instanceof ZodError,
  );
});

test("parseGrandCompendiumEntry throws ZodError for unknown category field", () => {
  assert.throws(
    () => parseGrandCompendiumEntry("items", { ...validItem, unknownField: true }),
    (err) => err instanceof ZodError,
  );
});

// ── formatGrandCompendiumIssues ───────────────────────────────────────────────────

test("formatGrandCompendiumIssues renders root-level path", () => {
  const result = MonsterSchema.safeParse({ ...validMonster, id: "" });
  assert.equal(result.success, false);
  const msg = formatGrandCompendiumIssues(result.error!);
  assert.ok(msg.includes("id:"), `Expected "id:" in: ${msg}`);
});

test("formatGrandCompendiumIssues renders nested path for armorClass.value", () => {
  const result = MonsterSchema.safeParse({ ...validMonster, armorClass: { value: -5 } });
  assert.equal(result.success, false);
  const msg = formatGrandCompendiumIssues(result.error!);
  assert.ok(msg.includes("armorClass.value"), `Expected "armorClass.value" in: ${msg}`);
});

test("formatGrandCompendiumIssues renders deeply nested path for casting component", () => {
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
  const msg = formatGrandCompendiumIssues(result.error!);
  assert.ok(
    msg.includes("casting.components.material"),
    `Expected "casting.components.material" in: ${msg}`,
  );
});

test("formatGrandCompendiumIssues renders duplicate action ID path", () => {
  const result = MonsterSchema.safeParse({
    ...validMonster,
    actions: [
      { id: "bite", name: "Bite", description: "Chomp." },
      { id: "bite", name: "Bite Again", description: "Chomp harder." },
    ],
  });
  assert.equal(result.success, false);
  const msg = formatGrandCompendiumIssues(result.error!);
  assert.ok(msg.includes("actions.1.id"), `Expected "actions.1.id" in: ${msg}`);
});

test("formatGrandCompendiumIssues renders class duplicate level path", () => {
  const result = ClassSchema.safeParse({
    ...validClass,
    levels: [
      { level: 2 },
      { level: 2 },
    ],
  });
  assert.equal(result.success, false);
  const msg = formatGrandCompendiumIssues(result.error!);
  assert.ok(msg.includes("levels.1.level"), `Expected "levels.1.level" in: ${msg}`);
});
