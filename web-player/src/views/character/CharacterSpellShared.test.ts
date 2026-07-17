import { describe, expect, it } from "vitest";
import { getScaledSpellDamage } from "./CharacterSpellShared";

describe("typed spell display rolls", () => {
  it("selects the highest authored cantrip row at the character level", () => {
    const spell = {
      id: "s_toll_the_dead", name: "Toll the Dead", level: 0,
      rolls: [0, 5, 11, 17].map((level, index) => ({
        formula: `${index + 1}d8`, effect: "necrotic", scaling: "character_level", level,
      })),
    };
    expect(getScaledSpellDamage(spell, 7, 0)).toEqual({ dice: "2d8", type: "necrotic", types: ["necrotic"] });
  });

  it("preserves every icon type for a mixed damage display", () => {
    const spell = {
      id: "s_flame_strike", name: "Flame Strike", level: 5,
      rolls: [{ formula: "5d6+5d6", effect: ["fire", "radiant"] }],
    };
    expect(getScaledSpellDamage(spell, 9, 9)).toEqual({
      dice: "5d6+5d6", type: "fire", types: ["fire", "radiant"],
    });
  });

  it("keeps Magic Missile as one authored dart", () => {
    const spell = {
      id: "s_magic_missile", name: "Magic Missile", level: 1,
      rolls: [{ formula: "1d4+1", effect: "force" }],
    };
    expect(getScaledSpellDamage(spell, 20, 9)?.dice).toBe("1d4+1");
  });
});
