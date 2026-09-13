import { describe, expect, it } from "vitest";

import { concentrationSpellNamesFromLookup } from "./CharacterConcentrationSpells";

describe("concentrationSpellNamesFromLookup", () => {
  it("keeps only spells explicitly marked as concentration", () => {
    expect(concentrationSpellNamesFromLookup([
      { query: "Cure Wounds", match: { concentration: false } },
      { query: "Hunter's Mark", match: { concentration: true } },
      { query: "Pass without Trace", match: { concentration: true } },
      { query: "Misty Step", match: { concentration: false } },
      { query: "Unknown Spell", match: null },
    ])).toEqual(["Hunter's Mark", "Pass without Trace"]);
  });

  it("deduplicates names case-insensitively and ignores blank queries", () => {
    expect(concentrationSpellNamesFromLookup([
      { query: "  Ensnaring Strike  ", match: { concentration: true } },
      { query: "ensnaring strike", match: { concentration: true } },
      { query: " ", match: { concentration: true } },
    ])).toEqual(["Ensnaring Strike"]);
  });
});
