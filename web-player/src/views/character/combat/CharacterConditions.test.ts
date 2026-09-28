import { describe, expect, it } from "vitest";
import type { ConditionInstance } from "@/views/character/CharacterSheetTypes";
import { toggleConditionInstance } from "./CharacterConditions";

describe("toggleConditionInstance", () => {
  it("removes only the selected source-bound condition instance", () => {
    const first: ConditionInstance = { key: "hexed", casterId: "caster-1", hexAbility: "str" };
    const second: ConditionInstance = { key: "hexed", casterId: "caster-2", hexAbility: "dex" };

    expect(toggleConditionInstance([first, second], "hexed", first)).toEqual([second]);
  });

  it("retains key-based toggle behavior when no instance is supplied", () => {
    expect(toggleConditionInstance([{ key: "poisoned" }], "poisoned")).toEqual([]);
    expect(toggleConditionInstance([], "poisoned")).toEqual([{ key: "poisoned" }]);
  });
});
