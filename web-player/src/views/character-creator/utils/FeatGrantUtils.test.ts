import { describe, expect, it } from "vitest";
import { collectFeatTaggedEntries } from "./FeatGrantUtils";

describe("feat maneuver choices", () => {
  it("persists selected Martial Adept options as maneuvers, not weapon proficiencies", () => {
    const feat = {
      name: "Martial Adept",
      parsed: {
        grants: { skills: [], tools: [], languages: [], armor: [], weapons: [], savingThrows: [], spells: [], cantrips: [], abilityIncreases: {} },
        choices: [{ id: "maneuvers", type: "proficiency" as const, count: 2, options: ["Trip Attack", "Riposte"], anyOf: ["maneuver"] }],
      },
    };
    const result = collectFeatTaggedEntries({
      feat,
      selectedChoices: { "feat:maneuvers": ["Trip Attack", "Riposte"] },
      getChoiceKey: () => "feat:maneuvers",
    });

    expect(result.maneuvers.map((entry) => entry.name)).toEqual(["Trip Attack", "Riposte"]);
    expect(result.weapons).toEqual([]);
  });
});
