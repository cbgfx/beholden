import test from "node:test";
import { MonsterSchema } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { validMonster, fails, passes } from './grandCompendiumSchemas.fixtures.js';

// ── Monster ───────────────────────────────────────────────────────────────────

test("MonsterSchema: accepts canonical sample", () => {
  passes(MonsterSchema, validMonster);
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


test("MonsterSchema: rejects the retired npc import marker", () => {
  fails(MonsterSchema, { ...validMonster, npc: true });
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
