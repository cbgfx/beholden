import { describe, expect, it } from "vitest";
import {
  applyExtraFeatAbilityScores,
  getExtraFeatAbilityChoiceSpec,
  isValidExtraFeatAbilityChoice,
} from "@/domain/character/extraFeatAbilityScores";

const BASE_SCORES = {
  str: 12,
  dex: 14,
  con: 14,
  int: 10,
  wis: 13,
  cha: 8,
};

describe("extra feat ability scores", () => {
  it("applies and caps fixed increases such as Durable", () => {
    const durable = {
      id: "durable",
      name: "Durable",
      text: "Increase your Constitution score by 1, to a maximum of 20.",
    };
    expect(applyExtraFeatAbilityScores(BASE_SCORES, [durable], {}).scores.con).toBe(15);
    expect(applyExtraFeatAbilityScores({ ...BASE_SCORES, con: 20 }, [durable], {}).scores.con).toBe(20);
  });

  it("applies only a valid constrained choice", () => {
    const feat = {
      id: "physical-boon",
      name: "Physical Boon",
      text: "Increase your Strength, Dexterity, or Constitution score by 1, to a maximum of 20.",
    };
    const spec = getExtraFeatAbilityChoiceSpec(feat);
    expect(spec?.options).toEqual(["str", "dex", "con"]);
    expect(isValidExtraFeatAbilityChoice(spec, ["dex"])).toBe(true);
    expect(isValidExtraFeatAbilityChoice(spec, ["wis"])).toBe(false);
    expect(applyExtraFeatAbilityScores(BASE_SCORES, [feat], { [feat.id]: ["dex"] }).scores.dex).toBe(15);
    expect(applyExtraFeatAbilityScores(BASE_SCORES, [feat], { [feat.id]: ["wis"] }).scores.wis).toBe(13);
  });

  it("supports unrestricted choices and a maximum of 30", () => {
    const feat = {
      id: "epic-boon",
      name: "Epic Boon",
      text: "Increase one ability score of your choice by 1, to a maximum of 30.",
    };
    const result = applyExtraFeatAbilityScores(
      { ...BASE_SCORES, wis: 20 },
      [feat],
      { [feat.id]: ["wis"] },
    );
    expect(result.scores.wis).toBe(21);
  });
});
