import { describe, expect, it } from "vitest";

import { getClassExpertiseChoices, type CreatorClassDetailLike } from "./CharacterCreatorClassCoreUtils";

describe("getClassExpertiseChoices", () => {
  const bard = {
    autolevels: [{
      level: 3,
      slots: null,
      features: [{
        name: "Expertise",
        choices: [{ kind: "expertise", known: { "3": 2, "10": 4 } }],
      }],
    }],
  } satisfies CreatorClassDetailLike;

  it("converts cumulative Expertise targets into incremental grants", () => {
    expect(getClassExpertiseChoices(bard, 10)).toEqual([
      expect.objectContaining({ key: "classexpertise:3:Expertise", count: 2 }),
      expect.objectContaining({ key: "classexpertise:10:Expertise", count: 2 }),
    ]);
  });

  it("offers only the newly gained Expertise choices during level 10", () => {
    const choices = getClassExpertiseChoices(bard, 10)
      .filter((choice) => choice.key.startsWith("classexpertise:10:"));

    expect(choices).toHaveLength(1);
    expect(choices[0]?.count).toBe(2);
  });
});
