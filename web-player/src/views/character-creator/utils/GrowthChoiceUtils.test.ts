import { describe, expect, it } from "vitest";
import { sanitizeGrowthChoiceSelections, type GrowthChoiceDefinition } from "./GrowthChoiceUtils";

function maneuverDefinition(): GrowthChoiceDefinition {
  return {
    key: "growth:maneuvers:2",
    sourceKey: "class:battle-master:2",
    category: "maneuver",
    title: "Maneuvers",
    sourceLabel: "Level 3: Combat Superiority (Battle Master)",
    totalCount: 3,
    gainedAtLevel: 3,
    replacementSupported: false,
    replacementLimit: 0,
  };
}

describe("sanitizeGrowthChoiceSelections", () => {
  it("preserves a hydrated character's saved picks while their options are still loading", () => {
    // optionEntriesByKey has no entry for this definition's key at all -- the async talent
    // fetch that would populate it hasn't resolved yet. That must be read as "unknown", not
    // "these picks don't match anything", or a freshly-opened editor would wipe every
    // maneuver/metamagic/infusion pick made by a previously-saved character.
    const definition = maneuverDefinition();
    const result = sanitizeGrowthChoiceSelections({
      definitions: [definition],
      currentSelections: { [definition.key]: ["m_precision_attack", "m_riposte"] },
      optionEntriesByKey: {},
    });

    expect(result[definition.key]).toEqual(["m_precision_attack", "m_riposte"]);
  });

  it("prunes picks that no longer match once the real options have loaded", () => {
    const definition = maneuverDefinition();
    const result = sanitizeGrowthChoiceSelections({
      definitions: [definition],
      currentSelections: { [definition.key]: ["m_precision_attack", "m_not_a_real_maneuver"] },
      optionEntriesByKey: {
        [definition.key]: [
          { id: "m_precision_attack", name: "Precision Attack" },
          { id: "m_riposte", name: "Riposte" },
        ],
      },
    });

    expect(result[definition.key]).toEqual(["m_precision_attack"]);
  });

  it("drops a choice once its loaded options are known to contain no matches", () => {
    // An explicit [] (present in the map) means the fetch completed and found nothing --
    // distinct from the key being entirely absent (still loading), which must not prune.
    const definition = maneuverDefinition();
    const result = sanitizeGrowthChoiceSelections({
      definitions: [definition],
      currentSelections: { [definition.key]: ["m_precision_attack"] },
      optionEntriesByKey: { [definition.key]: [] },
    });

    expect(result[definition.key]).toBeUndefined();
  });
});
