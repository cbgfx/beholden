import { describe, expect, it } from "vitest";
import { buildProficiencyKeySet } from "./useLevelUpDerivedState";

describe("buildProficiencyKeySet", () => {
  it("combines normalized existing proficiencies with chosen class-feature picks of the matching category", () => {
    const keys = buildProficiencyKeySet(
      "skill",
      ["Athletics", "Perception"],
      [
        { key: "classfeature:cf_1", category: "skill" },
        { key: "classfeature:cf_2", category: "tool" },
      ],
      { "classfeature:cf_1": ["Stealth"], "classfeature:cf_2": ["Thieves' Tools"] },
    );
    expect(keys).toEqual(new Set(["athletics", "perception", "stealth"]));
  });

  it("ignores class-feature choices from a different category", () => {
    const keys = buildProficiencyKeySet(
      "tool",
      [],
      [{ key: "classfeature:cf_1", category: "skill" }],
      { "classfeature:cf_1": ["Stealth"] },
    );
    expect(keys).toEqual(new Set());
  });

  it("ignores class-feature choices with no chosen value yet", () => {
    const keys = buildProficiencyKeySet(
      "language",
      ["Common"],
      [{ key: "classfeature:cf_1", category: "language" }],
      {},
    );
    expect(keys).toEqual(new Set(["common"]));
  });
});
