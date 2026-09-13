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

  it("uses Toll the Dead's d8 track unless the missing-hit-points condition is known", () => {
    const spell = {
      id: "s_toll_the_dead", name: "Toll the Dead", level: 0,
      rolls: [
        ...[0, 5, 11, 17].map((level, index) => ({ formula: `${index + 1}d8`, effect: "necrotic", level })),
        ...[0, 5, 11, 17].map((level, index) => ({ formula: `${index + 1}d12`, effect: "necrotic", level })),
      ],
    };
    expect(getScaledSpellDamage(spell, 7, 0)?.dice).toBe("2d8");
  });

  it("infers Booming Blade damage from its authored roll description", () => {
    const spell = {
      id: "s_booming_blade", name: "Booming Blade", level: 0,
      rolls: [0, 5, 11, 17].map((level, index) => ({ formula: `${index + 1}d8`, description: "Thunder Damage", level })),
    };
    expect(getScaledSpellDamage(spell, 11, 0)).toEqual({ dice: "3d8", type: "thunder", types: ["thunder"] });
  });

  it("supplies Green-Flame Blade's missing cantrip scaling rolls", () => {
    const spell = { id: "s_green_flame_blade", name: "Green-Flame Blade", level: 0, rolls: [] };
    expect(getScaledSpellDamage(spell, 4, 0)).toBeNull();
    expect(getScaledSpellDamage(spell, 11, 0)).toEqual({ dice: "2d8", type: "fire", types: ["fire"] });
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

  it("resolves the literal SPELL token to the caster's actual spellcasting modifier", () => {
    // Reproduces the real bug: Healing Word's roll formula is authored as "2d4+SPELL" (meaning
    // "add the caster's spellcasting modifier"), but nothing substituted a real number for it —
    // the player just saw the literal text "+SPELL" with no way to know what it meant.
    const healingWord = {
      id: "s_healing_word", name: "Healing Word", level: 1,
      rolls: [{ formula: "2d4+SPELL", level: 1, effect: "healing" }],
    };
    expect(getScaledSpellDamage(healingWord, 7, 1, 3)?.dice).toBe("2d4+3");
    expect(getScaledSpellDamage(healingWord, 7, 1, -1)?.dice).toBe("2d4-1");
    expect(getScaledSpellDamage(healingWord, 7, 1, 0)?.dice).toBe("2d4+0");
    // No modifier supplied: strip the unresolvable token rather than show it as literal text.
    expect(getScaledSpellDamage(healingWord, 7, 1)?.dice).toBe("2d4");
  });

  it("shows a leveled spell's roll for the target slot level, not its highest authored upcast", () => {
    // Reproduces the real bug: Healing Word displayed under a level-7 character's 1st-level
    // slots section showed 18d4 (the level-9 upcast row) instead of 2d4 (the base roll), because
    // the selector always took the last authored row regardless of what level was being shown.
    const healingWord = {
      id: "s_healing_word", name: "Healing Word", level: 1,
      rolls: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => ({
        formula: `${level * 2}d4+SPELL`, level, effect: "healing",
      })),
    };
    expect(getScaledSpellDamage(healingWord, 7, 1, 3)?.dice).toBe("2d4+3");
    expect(getScaledSpellDamage(healingWord, 7, 3, 3)?.dice).toBe("6d4+3");
  });
});
