import { describe, expect, it } from "vitest";
import { reconcileSelectedSpellIds } from "./LevelUpHelpers";

describe("reconcileSelectedSpellIds", () => {
  it("preserves duplicate IDs only for repeatable ClassTalents", () => {
    expect(reconcileSelectedSpellIds(
      ["ct_lessons", "ct_lessons", "ct_armor", "ct_armor"],
      [
        { id: "ct_lessons", name: "Lessons", repeatable: true },
        { id: "ct_armor", name: "Armor", repeatable: false },
      ],
    )).toEqual(["ct_lessons", "ct_lessons", "ct_armor"]);
  });
});
