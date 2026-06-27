import { describe, expect, it } from "vitest";

import { getLongRestRecovery } from "./CharacterRestRecovery";

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
