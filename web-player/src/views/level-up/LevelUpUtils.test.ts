import { describe, expect, it } from "vitest";
import { deriveFeatAbilityBonuses } from "@/views/level-up/LevelUpUtils";

describe("deriveFeatAbilityBonuses", () => {
  it("awards Great Weapon Master's fixed Strength increase from its feat text", () => {
    expect(deriveFeatAbilityBonuses({
      chosenFeatDetail: {
        id: "f_great_weapon_master",
        text: "Ability Score Increase. Increase your Strength score by 1, to a maximum of 20.",
        parsed: { grants: { abilityIncreases: {} } },
      },
      chosenFeatOptions: {},
      featChoiceEntries: [],
      nextLevel: 4,
    })).toEqual({ str: 1 });
  });

  it("does not duplicate a fixed increase already supplied by parsed grants", () => {
    expect(deriveFeatAbilityBonuses({
      chosenFeatDetail: {
        id: "f_great_weapon_master",
        text: "Ability Score Increase. Increase your Strength score by 1, to a maximum of 20.",
        parsed: { grants: { abilityIncreases: { strength: 1 } } },
      },
      chosenFeatOptions: {},
      featChoiceEntries: [],
      nextLevel: 4,
    })).toEqual({ str: 1 });
  });
});
