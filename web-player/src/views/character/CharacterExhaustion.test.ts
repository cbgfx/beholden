import { describe, expect, it } from "vitest";
import {
  getExhaustedSpeed,
  getExhaustionD20Penalty,
  getExhaustionEffects,
  getExhaustionHpMaxMultiplier,
  hasExhaustionAbilityCheckDisadvantage,
  hasExhaustionAttackAndSaveDisadvantage,
} from "./CharacterExhaustion";

describe("2024 Exhaustion", () => {
  it("applies a -2 D20 Test penalty and -5 feet of speed per level", () => {
    expect(getExhaustionD20Penalty("5.5e", 3)).toBe(6);
    expect(getExhaustedSpeed("5.5e", 30, 3)).toBe(15);
    expect(getExhaustionEffects("5.5e", 3)).toEqual(["D20 Tests −6", "Speed −15 ft."]);
  });

  it("clamps speed at zero and reports death at level six", () => {
    expect(getExhaustedSpeed("5.5e", 25, 6)).toBe(0);
    expect(getExhaustionEffects("5.5e", 6)).toContain("Death");
  });

  it("never applies disadvantage — 2024 exhaustion is purely numeric", () => {
    expect(hasExhaustionAbilityCheckDisadvantage("5.5e", 6)).toBe(false);
    expect(hasExhaustionAttackAndSaveDisadvantage("5.5e", 6)).toBe(false);
  });

  it("never halves hit point maximum", () => {
    expect(getExhaustionHpMaxMultiplier("5.5e", 6)).toBe(1);
  });
});

describe("2014 Exhaustion", () => {
  it("has no flat d20 penalty at any level", () => {
    expect(getExhaustionD20Penalty("5e", 3)).toBe(0);
    expect(getExhaustionD20Penalty("5e", 6)).toBe(0);
  });

  it("halves speed at tier 2, zeroes it at tier 5", () => {
    expect(getExhaustedSpeed("5e", 30, 1)).toBe(30);
    expect(getExhaustedSpeed("5e", 30, 2)).toBe(15);
    expect(getExhaustedSpeed("5e", 31, 3)).toBe(15);
    expect(getExhaustedSpeed("5e", 30, 5)).toBe(0);
  });

  it("imposes disadvantage on ability checks starting at tier 1", () => {
    expect(hasExhaustionAbilityCheckDisadvantage("5e", 1)).toBe(true);
    expect(hasExhaustionAbilityCheckDisadvantage("5e", 0)).toBe(false);
  });

  it("imposes disadvantage on attack rolls and saves starting at tier 3, not before", () => {
    expect(hasExhaustionAttackAndSaveDisadvantage("5e", 2)).toBe(false);
    expect(hasExhaustionAttackAndSaveDisadvantage("5e", 3)).toBe(true);
  });

  it("halves hit point maximum starting at tier 4, not before", () => {
    expect(getExhaustionHpMaxMultiplier("5e", 3)).toBe(1);
    expect(getExhaustionHpMaxMultiplier("5e", 4)).toBe(0.5);
    expect(getExhaustionHpMaxMultiplier("5e", 6)).toBe(0.5);
  });

  it("reports tiered, non-numeric effects text and death at level six", () => {
    expect(getExhaustionEffects("5e", 1)).toEqual(["Disadvantage on ability checks"]);
    expect(getExhaustionEffects("5e", 4)).toEqual([
      "Disadvantage on ability checks",
      "Speed halved",
      "Disadvantage on attack rolls and saving throws",
      "Hit point maximum halved",
    ]);
    expect(getExhaustionEffects("5e", 6)).toContain("Death");
  });
});
