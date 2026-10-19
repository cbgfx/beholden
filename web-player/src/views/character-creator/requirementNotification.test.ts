import { expect, it } from "vitest";
import { requirementNotification } from "./creatorRequirements";
import type { ProgressionRequirement } from "@beholden/shared/domain/progressionRequirements";
const missing: ProgressionRequirement = { id: "feat-spells", state: "incomplete", message: "Choose two cantrips." };
it("counts only unmet requirements and progression repairs", () => {
  expect(requirementNotification([missing, { id: "name", state: "complete", message: "Name" }, { id: "none", state: "not_applicable", message: "None" }, { id: "migration:ambiguous", state: "failed", message: "Repair" }])).toEqual([missing, { id: "migration:ambiguous", state: "failed", message: "Repair" }]);
  expect(requirementNotification([])).toEqual([]);
});
it("waits for hydration and option loading without flagging network failures", () => {
  expect(requirementNotification([missing], true)).toEqual([]);
  for (const state of ["loading", "failed"] as const) expect(requirementNotification([missing, { id: "load:class", state, message: "Class options" }])).toEqual([]);
});
