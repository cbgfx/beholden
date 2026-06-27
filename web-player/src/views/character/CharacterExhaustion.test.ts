import { describe, expect, it } from "vitest";
import {
  getExhaustedSpeed,
  getExhaustionD20Penalty,
  getExhaustionEffects,
} from "./CharacterExhaustion";

describe("2024 Exhaustion", () => {
  it("applies a -2 D20 Test penalty and -5 feet of speed per level", () => {
    expect(getExhaustionD20Penalty(3)).toBe(6);
    expect(getExhaustedSpeed(30, 3)).toBe(15);
    expect(getExhaustionEffects(3)).toEqual(["D20 Tests −6", "Speed −15 ft."]);
  });

  it("clamps speed at zero and reports death at level six", () => {
    expect(getExhaustedSpeed(25, 6)).toBe(0);
    expect(getExhaustionEffects(6)).toContain("Death");
  });
});
