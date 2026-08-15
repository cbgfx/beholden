import { describe, expect, it } from "vitest";
import { divineFuryDamageForFeature } from "./CharacterCombatPanels";

describe("Divine Fury combat action", () => {
  it("recognizes both compendium name formats and scales from the class progression level", () => {
    expect(divineFuryDamageForFeature({
      id: "divine-fury-2014",
      name: "Divine Fury (Path of the Zealot)",
      text: "",
      progressionLevel: 7,
    }, 12)).toBe("1d6+3");

    expect(divineFuryDamageForFeature({
      id: "divine-fury-2024",
      name: "Level 3: Divine Fury (Path of the Zealot)",
      text: "",
      progressionLevel: 10,
    }, 14)).toBe("1d6+5");
  });

  it("does not create an action for unrelated features", () => {
    expect(divineFuryDamageForFeature({ id: "rage", name: "Rage", text: "" }, 5)).toBeNull();
  });
});
