import { describe, expect, it } from "vitest";
import { applyExclusiveGroupReplacement, getExclusiveGroupReplacementChoice } from "./LevelUpExclusiveChoiceUtils";

const fighterChoices = [
  {
    id: "cc_fighter_fighting_style",
    name: "Fighting Style",
    options: [
      { id: "cco_fighter_fighting_style_archery", name: "Archery", features: ["cf_fighter_1_fighting_style_archery"] },
      { id: "cco_fighter_fighting_style_defense", name: "Defense", features: ["cf_fighter_1_fighting_style_defense"] },
      { id: "cco_fighter_fighting_style_dueling", name: "Dueling", features: ["cf_fighter_1_fighting_style_dueling"] },
    ],
  },
];

const fighterAutolevels = [
  {
    level: 1,
    features: [
      { id: "cf_fighter_1_fighting_style_archery", name: "Fighting Style: Archery" },
      { id: "cf_fighter_1_fighting_style_defense", name: "Fighting Style: Defense" },
      { id: "cf_fighter_1_fighting_style_dueling", name: "Fighting Style: Dueling" },
    ],
  },
];

describe("getExclusiveGroupReplacementChoice", () => {
  it("resolves the currently-held option from chosenOptionals", () => {
    const choice = getExclusiveGroupReplacementChoice({
      choices: fighterChoices,
      autolevels: fighterAutolevels,
      groupName: "Fighting Style",
      level: 4,
      chosenOptionals: ["Fighting Style: Archery"],
    });

    expect(choice?.currentOptionId).toBe("cco_fighter_fighting_style_archery");
    expect(choice?.currentSelectionNames).toEqual(["Fighting Style: Archery"]);
    expect(choice?.options.map((option) => option.id)).toEqual([
      "cco_fighter_fighting_style_archery",
      "cco_fighter_fighting_style_defense",
      "cco_fighter_fighting_style_dueling",
    ]);
  });

  it("returns null when the class has no group by that name", () => {
    const choice = getExclusiveGroupReplacementChoice({
      choices: fighterChoices,
      autolevels: fighterAutolevels,
      groupName: "Pact Boon",
      level: 4,
      chosenOptionals: ["Fighting Style: Archery"],
    });
    expect(choice).toBeNull();
  });

  it("reports no current option when nothing in chosenOptionals matches the group", () => {
    const choice = getExclusiveGroupReplacementChoice({
      choices: fighterChoices,
      autolevels: fighterAutolevels,
      groupName: "Fighting Style",
      level: 4,
      chosenOptionals: [],
    });
    expect(choice?.currentOptionId).toBeNull();
  });
});

describe("applyExclusiveGroupReplacement", () => {
  const choice = getExclusiveGroupReplacementChoice({
    choices: fighterChoices,
    autolevels: fighterAutolevels,
    groupName: "Fighting Style",
    level: 4,
    chosenOptionals: ["Fighting Style: Archery", "Some Other Feature"],
  })!;

  it("swaps the old option's feature names for the new option's, leaving unrelated entries untouched", () => {
    const next = applyExclusiveGroupReplacement({
      chosenOptionals: ["Fighting Style: Archery", "Some Other Feature"],
      choice,
      selectedOptionId: "cco_fighter_fighting_style_dueling",
    });
    expect(next).toEqual(["Some Other Feature", "Fighting Style: Dueling"]);
  });

  it("is a no-op when the selected option matches what's already held", () => {
    const next = applyExclusiveGroupReplacement({
      chosenOptionals: ["Fighting Style: Archery", "Some Other Feature"],
      choice,
      selectedOptionId: "cco_fighter_fighting_style_archery",
    });
    expect(next).toEqual(["Fighting Style: Archery", "Some Other Feature"]);
  });

  it("is a no-op when nothing was selected", () => {
    const next = applyExclusiveGroupReplacement({
      chosenOptionals: ["Fighting Style: Archery"],
      choice,
      selectedOptionId: null,
    });
    expect(next).toEqual(["Fighting Style: Archery"]);
  });
});
