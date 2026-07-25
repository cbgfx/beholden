import { describe, expect, it } from "vitest";

import { getLongRestOverrides, getLongRestRecovery } from "./CharacterRestRecovery";

describe("getLongRestRecovery", () => {
  it("restores all spent Hit Point Dice and reduces Exhaustion by one", () => {
    expect(getLongRestRecovery(8, 3)).toEqual({
      hitDiceCurrent: 8,
      exhaustion: 2,
    });
  });

  it("does not reduce Exhaustion below zero", () => {
    expect(getLongRestRecovery(4, 0)).toEqual({
      hitDiceCurrent: 4,
      exhaustion: 0,
    });
  });
});

describe("getLongRestOverrides", () => {
  it("clears temporary, stat, and ability-score overrides", () => {
    expect(getLongRestOverrides(false, false)).toEqual({
      tempHp: 0,
      acBonus: 0,
      hpMaxBonus: 0,
      inspiration: false,
      abilityScores: {},
    });
  });

  it("preserves existing inspiration and grants it for Resourceful", () => {
    expect(getLongRestOverrides(true, false).inspiration).toBe(true);
    expect(getLongRestOverrides(false, true).inspiration).toBe(true);
  });
});
