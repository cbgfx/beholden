import { describe, expect, it } from "vitest";
import { buildLevelUpPayload } from "./buildLevelUpPayload";

describe("buildLevelUpPayload", () => {
  it("preserves accumulated Wizard spellbook entries while leveling", () => {
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 40,
        hpCurrent: 40,
        className: "Wizard",
        characterData: {
          classes: [{ className: "Wizard", classId: "c_wizard", level: 6 }],
          proficiencies: {
            spells: [
              { id: "s_fireball", name: "Fireball", source: "Wizard" },
              { id: "s_unseen_servant", name: "Unseen Servant", source: "Wizard" },
            ],
          },
        },
      },
      nextLevel: 7,
      hpGain: 5,
      featHpBonus: 0,
      subclass: "Illusionist",
      chosenCantrips: [],
      chosenSpells: ["s_fireball"],
      chosenInvocations: [],
      chosenExpertise: {},
      chosenFeatOptions: {},
      chosenFeatureChoices: {},
      expertiseChoices: [],
      featChoiceEntries: [],
      chosenFeatDetail: null,
      featSourceLabel: "",
      newFeatures: [],
      classDetailName: "Wizard",
      selectedCantripEntries: [],
      selectedSpellEntries: [{ id: "s_fireball", name: "Fireball", source: "Wizard" }],
      selectedInvocationEntries: [],
      baseScores: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
      asiMode: null,
      asiStats: {},
      featAbilityBonuses: {},
    } as never) as { characterData: { proficiencies: { spells: Array<{ name: string; source: string }> } } };

    expect(payload.characterData.proficiencies.spells).toEqual([
      expect.objectContaining({ name: "Fireball", source: "Wizard" }),
      expect.objectContaining({ name: "Unseen Servant", source: "Wizard" }),
    ]);
  });
});
