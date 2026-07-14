import { describe, expect, it } from "vitest";
import { getSlotLevelTriggeredSpellChoices } from "./CharacterCreatorSpellcastingUtils";

describe("getSlotLevelTriggeredSpellChoices", () => {
  it("repairs the Illusion Savant OCR split when restricting its level-up spell", () => {
    const cls = {
      name: "Wizard",
      autolevels: [
        {
          level: 1,
          slots: [4, 4, 3, 3],
          features: [],
        },
        {
          level: 3,
          features: [{
            name: "Level 3: Illusion Savant (Illusionist)",
            optional: true,
            text: "Whenever you gain access to a new level of spell slots in this class, you can add one Wizard spell from the Illus ion school to your spellbook for free.",
          }],
        },
        { level: 6, slots: [4, 4, 3, 3], features: [] },
        { level: 7, slots: [4, 4, 3, 3, 1], features: [] },
      ],
    };

    expect(getSlotLevelTriggeredSpellChoices(cls as never, 6, 7, "Illusionist")).toEqual([
      expect.objectContaining({ level: 4, listNames: ["Wizard"], schools: ["Illusion"] }),
    ]);
  });
});
