import test from "node:test";
import { SpellSchema, ClassTalentSchema } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { validSpell, fails, passes } from './grandCompendiumSchemas.fixtures.js';

// ── Spell ─────────────────────────────────────────────────────────────────────

test("SpellSchema: accepts canonical sample", () => {
  passes(SpellSchema, validSpell);
});


test("SpellSchema: accepts a compact typed check and mixed damage display", () => {
  passes(SpellSchema, {
    ...validSpell,
    check: "dex",
    rolls: [{ formula: "5d6+5d6", effect: ["fire", "radiant"] }],
  });
});


test("SpellSchema: rejects multiple resolution types", () => {
  fails(SpellSchema, { ...validSpell, check: ["attack", "dex"] });
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
