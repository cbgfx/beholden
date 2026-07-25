import { describe, expect, it } from "vitest";
import { getClassLanguageChoice } from "@/views/character/CharacterRuleParsers";

describe("getClassLanguageChoice", () => {
  const ALL_LANGUAGES = ["Common", "Dwarvish", "Elvish", "Thieves' Cant"];

  const classDetail = {
    name: "Rogue",
    autolevels: [
      {
        level: 9,
        features: [
          {
            name: "Master of Intrigue",
            subclass: "sc_rogue_mastermind",
            choices: [{ kind: "proficiency", category: "language", count: 2 }],
          },
          {
            name: "Fancy Footwork",
            subclass: "sc_rogue_swashbuckler",
          },
        ],
      },
    ],
  };

  it("only offers a subclass's language grant when that subclass is actually selected", () => {
    const mastermind = getClassLanguageChoice(classDetail, 9, ALL_LANGUAGES, "sc_rogue_mastermind");
    expect(mastermind).toEqual({ fixed: [], choose: 2, from: ALL_LANGUAGES, source: "Master of Intrigue" });
  });

  it("does not offer another subclass's language grant (e.g. Mastermind's while playing Swashbuckler)", () => {
    const swashbuckler = getClassLanguageChoice(classDetail, 9, ALL_LANGUAGES, "sc_rogue_swashbuckler");
    expect(swashbuckler).toBeNull();
  });

  it("does not offer any subclass language grant before a subclass is chosen", () => {
    const none = getClassLanguageChoice(classDetail, 9, ALL_LANGUAGES, null);
    expect(none).toBeNull();
  });
});
