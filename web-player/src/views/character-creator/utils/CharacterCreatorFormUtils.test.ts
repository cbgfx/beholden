import { describe, expect, it } from "vitest";
import { getOptionalGroups } from "./CharacterCreatorFormUtils";
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
