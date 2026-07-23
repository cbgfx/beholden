import { describe, expect, it } from "vitest";
import { deriveRaceAbilityBonuses, getOptionalGroups, initForm, resolvedScores } from "./CharacterCreatorFormUtils";
import type { ClassDetail } from "./CharacterCreatorTypes";

function classDetail(overrides: Partial<ClassDetail>): ClassDetail {
  return {
    id: "c_fighter", name: "Fighter", hd: 10, numSkills: 2, proficiency: "", slotsReset: "L",
    armor: "", weapons: "", tools: "", description: "", autolevels: [], ...overrides,
  };
}

describe("getOptionalGroups", () => {
  it("uses explicit Grand class choices instead of guessing from option count", () => {
    const features = Array.from({ length: 6 }, (_, index) => ({
      id: `cf_style_${index + 1}`,
      name: `Fighting Style: ${index + 1}`,
      text: `Style ${index + 1}`,
      optional: true,
    }));
    const result = getOptionalGroups(classDetail({
      choices: [{
        id: "cc_fighting_style",
        name: "Fighting Style",
        options: features.map((feature, index) => ({ id: `cco_style_${index + 1}`, name: `Style ${index + 1}`, features: [feature.id] })),
      }],
      autolevels: [{ level: 1, scoreImprovement: false, slots: null, features, counters: [] }],
    }), 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ level: 1, name: "Fighting Style", exclusive: true });
    expect(result[0]?.features).toHaveLength(6);
  });

  it("selects every feature in a bundled option as one exclusive choice", () => {
    const features = [
      { id: "cf_a", name: "Feature A", text: "A", optional: true },
      { id: "cf_b", name: "Feature B", text: "B", optional: true },
      { id: "cf_c", name: "Feature C", text: "C", optional: true },
    ];
    const [group] = getOptionalGroups(classDetail({
      choices: [{ id: "cc_path", name: "Path", options: [
        { id: "cco_ab", name: "A and B", features: ["cf_a", "cf_b"] },
        { id: "cco_c", name: "C", features: ["cf_c"] },
      ] }],
      autolevels: [{ level: 2, scoreImprovement: false, slots: null, features, counters: [] }],
    }), 2);

    expect(group?.features[0]).toMatchObject({ name: "A and B", selectionNames: ["Feature A", "Feature B"] });
  });
});

describe("deriveRaceAbilityBonuses", () => {
  const baseForm = () => initForm(null, new URLSearchParams());

  it("applies a fully fixed race increase with no player choice (Dwarf, Hill)", () => {
    const bonuses = deriveRaceAbilityBonuses({ abilityScoreIncrease: { con: 2, wis: 1 } }, null, baseForm());
    expect(bonuses).toEqual({ con: 2, wis: 1 });
  });

  it("combines a fixed amount with a simple player choice (Half-Elf: Cha+2 fixed, two free +1s)", () => {
    const form = { ...baseForm(), chosenRaceAbilityChoices: ["str", "int"] };
    const bonuses = deriveRaceAbilityBonuses({ abilityScoreIncrease: { cha: 2 } }, { amount: 1, flexible: false }, form);
    expect(bonuses).toEqual({ cha: 2, str: 1, int: 1 });
  });

  it("applies only the flexible split/even picks for a fully flexible race (Aasimar), ignoring chosenRaceAbilityChoices", () => {
    const form = { ...baseForm(), chosenRaceAbilityChoices: ["str"], raceAbilityBonuses: { dex: 2, cha: 1 } };
    const bonuses = deriveRaceAbilityBonuses(null, { amount: 1, flexible: true }, form);
    expect(bonuses).toEqual({ dex: 2, cha: 1 });
  });

  it("contributes nothing for a 2024 species with no abilityScoreIncrease", () => {
    const bonuses = deriveRaceAbilityBonuses({ abilityScoreIncrease: null }, null, baseForm());
    expect(bonuses).toEqual({});
  });
});

describe("resolvedScores with race bonuses", () => {
  it("adds race bonuses on top of standard-array base scores", () => {
    // STANDARD_ARRAY[0] === 15, so every ability starts at 15 before race bonuses.
    const form = {
      ...initForm(null, new URLSearchParams()),
      abilityMethod: "standard" as const,
      standardAssign: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    };
    const scores = resolvedScores(form, undefined, { con: 2, wis: 1 });
    expect(scores.con).toBe(17);
    expect(scores.wis).toBe(16);
    expect(scores.str).toBe(15);
  });

  it("caps race bonuses at 20", () => {
    const form = {
      ...initForm(null, new URLSearchParams()),
      abilityMethod: "pointbuy" as const,
      pbScores: { str: 10, dex: 10, con: 19, int: 10, wis: 10, cha: 10 },
    };
    const scores = resolvedScores(form, undefined, { con: 5 });
    expect(scores.con).toBe(20);
  });
});
