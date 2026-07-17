import { describe, expect, it } from "vitest";
import {
  getCantripCount,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSlotLevelTriggeredSpellChoices,
  getSpellcastingClassName,
  getSpellSlotsAtLevel,
} from "./CharacterCreatorSpellcastingUtils";

const eldritchKnight = {
  autolevels: [{ level: 3, slots: null, features: [{ name: "Spellcasting", subclass: "Eldritch Knight", text: "deliberately non-parseable" }] }],
  subclasses: { level: 3, options: { sc_fighter_eldritch_knight: "Eldritch Knight" } },
  subclassDetails: {
    sc_fighter_eldritch_knight: {
      name: "Eldritch Knight",
      spellcasting: {
        ability: "int",
        list: "sl_wizard",
        progression: [
          { level: 3, cantrips: 2, prepared: 3, slots: [2] },
          { level: 4, prepared: 4, slots: [3] },
          { level: 7, prepared: 5, slots: [4, 2] },
          { level: 10, cantrips: 3, prepared: 7, slots: [4, 3] },
        ],
      },
    },
  },
  spellLists: { sl_wizard: "Wizard" },
};

describe("structured subclass spellcasting progression", () => {
  it("reads every value from canonical facts without feature prose", () => {
    expect(getSpellcastingClassName(eldritchKnight as never, 7, "Eldritch Knight")).toBe("Wizard");
    expect(getCantripCount(eldritchKnight as never, 7, "Eldritch Knight")).toBe(2);
    expect(getPreparedSpellCount(eldritchKnight as never, 7, "Eldritch Knight")).toBe(5);
    expect(getSpellSlotsAtLevel(eldritchKnight as never, 7, "Eldritch Knight")).toEqual([2, 4, 2]);
    expect(getMaxSlotLevel(eldritchKnight as never, 7, "Eldritch Knight")).toBe(2);
    expect(getCantripCount(eldritchKnight as never, 10, "Eldritch Knight")).toBe(3);
  });
});

describe("getSlotLevelTriggeredSpellChoices", () => {
  it("reads the Illusion Savant slot-growth choice from canonical facts", () => {
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
            subclass: "Illusionist",
            text: "Player-facing rules text only.",
            choices: [{
              id: "fc_illusion_savant",
              kind: "spell",
              lists: ["sl_wizard"],
              count: 1,
              school: "Illusion",
              mode: "spellbook",
              perNewSlotLevel: true,
            }],
          }],
        },
        { level: 6, slots: [4, 4, 3, 3], features: [] },
        { level: 7, slots: [4, 4, 3, 3, 1], features: [] },
      ],
    };

    expect(getSlotLevelTriggeredSpellChoices(cls as never, 6, 7, "Illusionist")).toEqual([
      expect.objectContaining({ level: 4, listNames: ["sl_wizard"], schools: ["Illusion"] }),
    ]);
  });
});
