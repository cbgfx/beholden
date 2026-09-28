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
      parsed: { grants: { abilityIncreases: { constitution: 1 } } },
    };
    expect(applyExtraFeatAbilityScores(BASE_SCORES, [durable], {}).scores.con).toBe(15);
    expect(applyExtraFeatAbilityScores({ ...BASE_SCORES, con: 20 }, [durable], {}).scores.con).toBe(20);
  });

  it("applies only a valid constrained choice", () => {
    const feat = {
      id: "physical-boon",
      name: "Physical Boon",
      parsed: { choices: [{ id: "ability", type: "ability_score", count: 1, options: ["Strength", "Dexterity", "Constitution"], amount: 1 }] },
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
      parsed: { choices: [{ id: "ability", type: "ability_score", count: 1, options: null, amount: 1, maximum: 30 }] },
    };
    const result = applyExtraFeatAbilityScores(
      { ...BASE_SCORES, wis: 20 },
      [feat],
      { [feat.id]: ["wis"] },
    );
    expect(result.scores.wis).toBe(21);
  });

  it("supports the canonical ASI split without reading its description", () => {
    const feat = {
      id: "asi",
      name: "Ability Score Improvement",
      text: "This text is display-only.",
      parsed: { choices: [{ id: "ability", type: "ability_score", count: 1, options: null, amount: 2, split: true as const }] },
    };
    const spec = getExtraFeatAbilityChoiceSpec(feat);
    expect(spec?.allowedCounts).toEqual([1, 2]);
    expect(applyExtraFeatAbilityScores(BASE_SCORES, [feat], { asi: ["str"] }).scores.str).toBe(14);
    const split = applyExtraFeatAbilityScores(BASE_SCORES, [feat], { asi: ["str", "dex"] }).scores;
    expect(split.str).toBe(13);
    expect(split.dex).toBe(15);
  });
});
