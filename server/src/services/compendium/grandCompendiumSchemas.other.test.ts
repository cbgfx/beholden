import assert from "node:assert/strict";
import test from "node:test";
import { MonsterSchema, SpellSchema, ClassSchema, SpeciesSchema, BackgroundSchema, FeatSchema, DeckSchema, BastionSchema, CATEGORY_SCHEMAS, formatGrandCompendiumIssues, type NativeCompendiumCategory } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { validMonster, validSpell, validClass, validSpecies, validBackground, validFeat, validDeck, validBastionSpace, validBastionOrder, validBastionFacility, fails, passes } from './grandCompendiumSchemas.fixtures.js';

test("Grand entries require a supported ruleset", () => {
  passes(MonsterSchema, { ...validMonster, ruleset: "5e" });
  const { ruleset: _ruleset, ...missingRuleset } = validMonster;
  fails(MonsterSchema, missingRuleset);
  fails(MonsterSchema, { ...validMonster, ruleset: "6e" });
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


test("FeatSchema: preserves prerequisites that cannot be structured", () => {
  passes(FeatSchema, { ...validFeat, prerequisite: "Proficiency with martial weapons" });
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


test("FeatSchema: accepts a school-restricted spell choice", () => {
  passes(FeatSchema, {
    ...validFeat,
    mechanics: {
      choices: [{
        id: "fey_touched_spell",
        type: "spell",
        count: 1,
        level: 1,
        schools: ["Divination", "Enchantment"],
      }],
      uses: [{ count: 1, note: "free cast", grantsChoiceId: "fey_touched_spell" }],
      spellcastingAbility: "cha",
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


test("BastionSchema: accepts a rules entry with special facility slots", () => {
  passes(BastionSchema, {
    ruleset: "5.5e", kind: "rules", id: "bastion-rules:test", name: "Test Rules",
    specialFacilitySlots: [{ level: 5, count: 2 }, { level: 9, count: 4 }],
  });
});


test("BastionSchema: rejects a rules entry without slots", () => {
  fails(BastionSchema, { ruleset: "5.5e", kind: "rules", id: "bastion-rules:test", name: "Test Rules", specialFacilitySlots: [] });
});


test("BastionSchema: accepts space build and upgrade costs", () => {
  passes(BastionSchema, {
    ...validBastionSpace,
    basicAdd: { costGp: 500, days: 20 },
    basicUpgrade: { to: "roomy", costGp: 500, days: 25 },
  });
});


test("BastionSchema: accepts facility sizes and an upgrade", () => {
  passes(BastionSchema, {
    ...validBastionFacility,
    spaces: ["cramped", "roomy", "vast"],
    upgrade: { to: "vast", costGp: 2000, hirelingsDelta: 1, summary: "Counts as two gardens." },
  });
});


test("BastionSchema: rejects an upgrade without a cost", () => {
  fails(BastionSchema, { ...validBastionFacility, upgrade: { to: "vast" } });
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
