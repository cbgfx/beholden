import test from "node:test";
import assert from "node:assert/strict";
import { preserveForeignClassProficiencies, preserveProficienciesOnLevelUp } from "./levelUpProficiencies.js";

test("level-up cannot discard permanent proficiencies from an incomplete client snapshot", () => {
  const result = preserveProficienciesOnLevelUp(
    { proficiencies: {
      skills: [{ name: "Survival", source: "Barbarian" }],
      armor: [{ name: "Medium Armor", source: "Barbarian" }],
      weapons: [{ name: "Martial Weapons", source: "Barbarian" }],
      saves: [{ name: "Strength", source: "Barbarian" }],
    } },
    { proficiencies: {
      skills: [{ name: "Perception", source: "Primal Knowledge" }],
      armor: [],
      weapons: [],
      saves: [],
    } },
    true,
  );

  assert.deepEqual(result?.proficiencies, {
    skills: [
      { name: "Survival", source: "Barbarian" },
      { name: "Perception", source: "Primal Knowledge" },
    ],
    armor: [{ name: "Medium Armor", source: "Barbarian" }],
    weapons: [{ name: "Martial Weapons", source: "Barbarian" }],
    saves: [{ name: "Strength", source: "Barbarian" }],
    tools: undefined,
    languages: undefined,
  });
});

test("ordinary character edits may intentionally replace proficiencies", () => {
  const incoming = { proficiencies: { armor: [] } };
  assert.equal(preserveProficienciesOnLevelUp(
    { proficiencies: { armor: [{ name: "Medium Armor" }] } },
    incoming,
    false,
  ), incoming);
});

test("single-class progression rebuild preserves grants owned by another class", () => {
  const result = preserveForeignClassProficiencies(
    { proficiencies: {
      spells: [{ id: "hex", name: "Hex", source: "Pact Magic", classEntryId: "class_warlock" }],
      skills: [{ name: "Arcana", source: "Wizard", sourceKey: "class:class_wizard" }],
    } },
    { proficiencies: { spells: [], skills: [{ name: "Athletics", source: "Fighter", classEntryId: "class_fighter" }] } },
    "class_fighter",
  );
  assert.deepEqual(result?.proficiencies, {
    spells: [{ id: "hex", name: "Hex", source: "Pact Magic", classEntryId: "class_warlock" }],
    skills: [
      { name: "Arcana", source: "Wizard", sourceKey: "class:class_wizard" },
      { name: "Athletics", source: "Fighter", classEntryId: "class_fighter" },
    ],
  });
});
