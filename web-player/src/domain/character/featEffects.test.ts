import { describe, expect, it } from "vitest";
import { deriveFeatHitPointMaxBonus } from "@/domain/character/featEffects";

describe("deriveFeatHitPointMaxBonus", () => {
  it("uses the feat's current prose instead of its name", () => {
    expect(deriveFeatHitPointMaxBonus([{
      id: "durable-build",
      name: "Durable Build",
      text: "Your Hit Point maximum increases by 3 for each character level you have.",
    }], 5)).toBe(15);
  });

  it("uses structured compendium mechanics when prose has no supported pattern", () => {
    expect(deriveFeatHitPointMaxBonus([{
      id: "custom-vitality",
      name: "Custom Vitality",
      text: "You are exceptionally resilient.",
      parsed: {
        grants: {
          effects: [{
            type: "hit_points",
            mode: "max_bonus",
            amount: { kind: "character_level", multiplier: 4 },
          }],
        },
      },
    }], 3)).toBe(12);
  });
});
