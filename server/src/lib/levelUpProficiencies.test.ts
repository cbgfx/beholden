import test from "node:test";
import assert from "node:assert/strict";
import { preserveProficienciesOnLevelUp } from "./levelUpProficiencies.js";

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
