import { describe, expect, it } from "vitest";

import { buildPreparedSpellProgressionGrants } from "./characterFeaturesProgression";

describe("buildPreparedSpellProgressionGrants", () => {
  it("carries the canonical source spellcasting ability into granted spells", () => {
    const grants = buildPreparedSpellProgressionGrants([{
      id: "race:aasimar:light-bearer",
      name: "Light Bearer",
      text: "You know the Light cantrip.",
      spellcastingAbility: "cha",
      preparedSpellProgression: [{
        label: null,
        levelLabel: "Level",
        spellLabel: "Spells",
        rows: [{ level: 1, spells: ["Light"] }],
      }],
    }], 1);

    expect(grants).toEqual([expect.objectContaining({
      spellName: "Light",
      ability: "cha",
    })]);
  });
});
