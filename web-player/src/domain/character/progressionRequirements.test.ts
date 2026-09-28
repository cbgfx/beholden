import { describe, expect, it } from "vitest";
import { countOrdinaryPreparations, evaluateChoiceRequirement, evaluateSpellSelectionRequirement, requirementBlocks, retainPendingRequirements, validAsiAllocation } from "@beholden/shared/domain/progressionRequirements";

describe("shared progression requirements", () => {
  const choice = { id: "feat:spell", message: "Choose a spell", selected: ["bless"], count: 1, step: 8 };
  it("does not complete a selected choice until its definitions resolve", () => {
    for (const state of [{ loading: true }, { failed: true }]) {
      expect(requirementBlocks(evaluateChoiceRequirement({ ...choice, ...state }))).toBe(true);
    }
    expect(evaluateChoiceRequirement({ ...choice, options: [] }).state).toBe("incomplete");
    expect(evaluateChoiceRequirement({ ...choice, options: ["bless"] }).state).toBe("complete");
  });
  it("rejects duplicate and ineligible choices while allowing explicit repeatable choices", () => {
    expect(evaluateChoiceRequirement({ ...choice, count: 2, selected: ["bless", "bless"] }).state).toBe("incomplete");
    expect(evaluateChoiceRequirement({ ...choice, options: ["shield"] }).state).toBe("incomplete");
    expect(evaluateChoiceRequirement({ ...choice, count: 2, selected: ["bless", "bless"], repeatable: true }).state).toBe("complete");
  });
  it("keeps a gate reachable during failed refresh and removes it only once definitions resolve", () => {
    const previous = [evaluateChoiceRequirement(choice)];
    const loading = [{ id: "load:class", message: "Retry class", state: "failed" as const, step: 2 }];
    const pending = retainPendingRequirements(previous, loading);
    expect(pending).toContainEqual({ ...previous[0], state: "loading" });
    expect(pending.find((entry) => entry.id === choice.id)?.step).toBe(8);
    expect(retainPendingRequirements(pending, [{ ...loading[0], state: "complete" }])).toHaveLength(1);
  });
  it("uses the same ASI rules at every boundary", () => {
    expect(validAsiAllocation({ wis: 1, con: 1 }, { wis: 19, con: 15 })).toBe(true);
    for (const bonuses of [{ wis: 2 }, { con: -1, wis: 3 }, { wis: 1.5, con: 0.5 }, { bogus: 2 }] as Record<string, number>[]) {
      expect(validAsiAllocation(bonuses, { wis: 19, con: 15 })).toBe(false);
    }
  });
  it("counts Diego's ordinary preparations without domain/feat always-prepared grants", () => {
    const ordinary = Array.from({ length: 12 }, (_, i) => `ordinary-${i}`);
    const alwaysPrepared = new Set(["fireball", "misty-step"]);
    expect(countOrdinaryPreparations([...ordinary, "fireball", "misty-step", "fireball"], alwaysPrepared)).toBe(12);
    expect(countOrdinaryPreparations([...ordinary, "ordinary-extra", "fireball"], alwaysPrepared)).toBe(13);
    expect(countOrdinaryPreparations([...ordinary, ordinary[0]], alwaysPrepared)).toBe(12);
    expect(countOrdinaryPreparations([...ordinary, "fireball"], new Set())).toBe(13);
  });
  it("does not count a flexible caster's stored list as prepared, but still checks bounded class choices", () => {
    const args = { selected: Array.from({ length: 24 }, (_, i) => String(i)), capacity: 12, applicable: true };
    expect(requirementBlocks(evaluateSpellSelectionRequirement({ ...args, managedOnSheet: true }))).toBe(false);
    expect(requirementBlocks(evaluateSpellSelectionRequirement({ ...args, managedOnSheet: false }))).toBe(true);
    expect(requirementBlocks(evaluateChoiceRequirement({ ...choice, selected: [] }))).toBe(true);
  });
});
