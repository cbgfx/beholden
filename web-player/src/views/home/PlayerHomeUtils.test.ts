import { describe, expect, it } from "vitest";
import { normalizeCharacterTransfer } from "./PlayerHomeUtils";

describe("normalizeCharacterTransfer", () => {
  it("preserves stored AC and Speed and is idempotent", () => {
    const character = {
      name: "Facts Only",
      className: "Barbarian",
      species: "Human",
      level: 7,
      hpMax: 70,
      hpCurrent: 70,
      ac: 17,
      speed: 40,
      characterData: {
        classes: [{ className: "Barbarian", level: 7 }],
        selectedFeatureNames: ["Fast Movement", "Unarmored Defense"],
      },
    };

    const once = normalizeCharacterTransfer(character);
    const twice = normalizeCharacterTransfer(once);

    expect(once.ac).toBe(17);
    expect(once.speed).toBe(40);
    expect(twice.ac).toBe(17);
    expect(twice.speed).toBe(40);
  });
});
