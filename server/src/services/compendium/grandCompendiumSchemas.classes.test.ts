import test from "node:test";
import { ClassSchema } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { validClass, fails, passes } from './grandCompendiumSchemas.fixtures.js';

// ── Class ─────────────────────────────────────────────────────────────────────

test("ClassSchema: accepts canonical sample", () => {
  passes(ClassSchema, validClass);
});


test("ClassSchema: accepts typed multiclass requirements and spellcasting contribution", () => {
  passes(ClassSchema, {
    ...validClass,
    multiclass: {
      requirements: { ability: { any: ["str", "dex"] }, minimum: 13 },
      armor: ["Light Armor"],
      spellcasting: { progression: "half", rounding: "up" },
      exceptions: ["Round this class's contribution up."],
    },
  });
});


test("ClassSchema: accepts a 5e ability-modifier preparation formula", () => {
  passes(ClassSchema, {
    ...validClass,
    spellcasting: {
      ability: "wis",
      list: "sl_cleric",
      preparedSpellChanges: "long_rest",
      preparedFormula: { classLevelDivisor: 1, rounding: "down", minimum: 1 },
    },
  });
  passes(ClassSchema, {
    ...validClass,
    spellcasting: {
      ability: "cha",
      list: "sl_paladin",
      preparedSpellChanges: "long_rest",
      preparedFormula: { classLevelDivisor: 2, rounding: "down", minimum: 1 },
    },
  });
});


test("ClassSchema: rejects unsupported prepared-spell divisors", () => {
  fails(ClassSchema, {
    ...validClass,
    spellcasting: { ability: "wis", preparedFormula: { classLevelDivisor: 3 } },
  });
});


test("ClassSchema: requires multiclass prerequisites and rejects invalid caster contribution", () => {
  fails(ClassSchema, { ...validClass, multiclass: { armor: ["Light Armor"] } });
  fails(ClassSchema, {
    ...validClass,
    multiclass: {
      requirements: { ability: "int", minimum: 13 },
      spellcasting: { progression: "full", rounding: "up" },
    },
  });
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


test("ClassSchema: accepts a persisted table-facing selection", () => {
  passes(ClassSchema, {
    ...validClass,
    levels: [{ level: 1, features: [{
      id: "natural_explorer",
      name: "Natural Explorer",
      description: "Choose a favored terrain.",
      choices: [{ id: "fc_ranger_favored_terrain_1", kind: "selection", label: "Favored Terrain", count: 1, options: ["Forest", "Underdark"] }],
    }] }],
  });
});


test("ClassSchema: accepts a typed maneuver replacement", () => {
  passes(ClassSchema, {
    ...validClass,
    levels: [{
      level: 4,
      features: [{
        name: "Martial Versatility",
        description: "Replace one maneuver.",
        choices: [{ id: "fc_fighter_maneuver_replacement_4", kind: "replacement", target: "maneuver", count: 1 }],
      }],
    }],
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
          contribution: "third",
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
    descriptions: ["A bare class."],
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
