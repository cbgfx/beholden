import test from "node:test";
import { ItemSchema } from "@beholden/shared/domain/compendium/grandCompendiumSchemas";
import { validItem, fails, passes } from './grandCompendiumSchemas.fixtures.js';

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
  passes(ItemSchema, { ...validItem, type: "Ammunition", weapon: undefined, proficiency: undefined, ammo: "arrow" });
  passes(ItemSchema, { ...validItem, weapon: undefined, proficiency: undefined, usage: "held" });
  fails(ItemSchema, { ...validItem, weapon: { ...validItem.weapon, ammo: "arrow" } });
  fails(ItemSchema, { ...validItem, ammo: "arrow" });
  fails(ItemSchema, { ...validItem, type: "Ammunition", weapon: undefined, proficiency: undefined, ammo: "rocket" });
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


test("ItemSchema: accepts compact item use pools and long-rest recovery", () => {
  passes(ItemSchema, { ...validItem, uses: 7 });
  passes(ItemSchema, { ...validItem, uses: { max: 7, recover: "1d6+1" } });
  passes(ItemSchema, { ...validItem, uses: { max: "1d8+1", recover: false } });
});


test("ItemSchema: rejects ambiguous or invalid item use pools", () => {
  fails(ItemSchema, { ...validItem, uses: 0 });
  fails(ItemSchema, { ...validItem, uses: { max: 7 } });
  fails(ItemSchema, { ...validItem, uses: { max: "seven", recover: false } });
  fails(ItemSchema, { ...validItem, uses: { max: 7, depletion: { destroy: 1 } } });
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
