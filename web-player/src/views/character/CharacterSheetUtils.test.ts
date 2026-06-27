import { describe, expect, it } from "vitest";
import { featPrerequisitesMet } from "@/views/character/CharacterSheetUtils";

describe("featPrerequisitesMet ability requirements", () => {
  it("accepts either ability in a shared-threshold alternative", () => {
    const text = "Prerequisite: Strength or Dexterity 13+";
    expect(featPrerequisitesMet(text, { level: 4, scores: { str: 13, dex: 8 } })).toBe(true);
    expect(featPrerequisitesMet(text, { level: 4, scores: { str: 8, dex: 13 } })).toBe(true);
    expect(featPrerequisitesMet(text, { level: 4, scores: { str: 8, dex: 8 } })).toBe(false);
  });

  it("accepts alternatives with separately written thresholds", () => {
    const text = "Prerequisite: Strength 13+ or Dexterity 13+";
    expect(featPrerequisitesMet(text, { level: 4, scores: { str: 13, dex: 8 } })).toBe(true);
    expect(featPrerequisitesMet(text, { level: 4, scores: { str: 8, dex: 13 } })).toBe(true);
  });

  it("requires every ability joined by and", () => {
    const text = "Prerequisite: Dexterity 13+ and Wisdom 13+";
    expect(featPrerequisitesMet(text, { level: 4, scores: { dex: 13, wis: 13 } })).toBe(true);
    expect(featPrerequisitesMet(text, { level: 4, scores: { dex: 13, wis: 12 } })).toBe(false);
  });

  it("understands the or-higher wording", () => {
    const text = "Prerequisite: Strength or Dexterity score of 13 or higher";
    expect(featPrerequisitesMet(text, { level: 4, scores: { str: 13, dex: 8 } })).toBe(true);
  });
});
