import { describe, expect, it } from "vitest";
import { multiclassRequirementMet } from "./multiclassEligibility";

describe("multiclassRequirementMet", () => {
  const scores = { str: 13, dex: 12, int: 14, wis: 10, cha: 13 };
  it("supports fixed, all, and any requirements", () => {
    expect(multiclassRequirementMet("str", 13, scores)).toBe(true);
    expect(multiclassRequirementMet({ all: ["str", "cha"] }, 13, scores)).toBe(true);
    expect(multiclassRequirementMet({ all: ["str", "wis"] }, 13, scores)).toBe(false);
    expect(multiclassRequirementMet({ any: ["dex", "int"] }, 13, scores)).toBe(true);
  });
});
