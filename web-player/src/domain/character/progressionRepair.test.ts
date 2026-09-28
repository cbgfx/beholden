import { describe, expect, it } from "vitest";
import { resetAmbiguousProgressionBaseline } from "@beholden/shared/domain/progressionRepair";

describe("resetAmbiguousProgressionBaseline", () => {
  it("preserves current visible choices without guessing ownership and removes ambiguous history", () => {
    const repaired = resetAmbiguousProgressionBaseline({
      level: 5, hpMax: 42, constitution: 14,
      characterData: {
        classes: [{ id: "fighter", level: 4 }, { id: "wizard", level: 1 }],
        progressionRepairIssues: [
          { code: "ambiguous-feat-ownership", message: "feat" },
          { code: "ambiguous-hp-ownership", message: "hp" },
          { code: "ambiguous-selection-ownership", message: "selection" },
        ],
        chosenLevelUpFeats: [
          { level: 4, featId: "alert" },
          { level: 4, classEntryId: "fighter", classLevel: 4, featId: "durable" },
        ],
        chosenInvocations: ["lesson", "lesson"], chosenOptionals: ["archery"], extraFeatIds: ["magic-initiate"],
      },
    });
    expect(repaired.progressionRepairIssues).toEqual([]);
    expect(repaired.chosenLevelUpFeats).toEqual([{ level: 4, classEntryId: "fighter", classLevel: 4, featId: "durable" }]);
    const occurrences = repaired.progressionSelectionOccurrences as Array<{ valueId: string; classEntryId: null }>;
    expect(occurrences.map((entry) => entry.valueId)).toEqual(["lesson", "lesson", "archery", "magic-initiate"]);
    expect(occurrences.every((entry) => entry.classEntryId === null)).toBe(true);
    expect((repaired.hpProgressionHistory as Array<{ legacyBaseline?: boolean }>)[0]?.legacyBaseline).toBe(true);
  });
});
