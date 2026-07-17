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

  it("adds a feature note template once without replacing player text", () => {
    const note = { id: "nt_artificer_plans_known", title: "Plans Known", text: "Plan 1: Bag of Holding" };
    const base = {
      char: { hpMax: 20, hpCurrent: 20, className: "Artificer", characterData: { playerNotesList: [note] } },
      nextLevel: 2, hpGain: 5, featHpBonus: 0, subclass: "", chosenCantrips: [], chosenSpells: [], chosenInvocations: [],
      chosenExpertise: {}, chosenFeatOptions: {}, chosenFeatureChoices: {}, expertiseChoices: [], featChoiceEntries: [],
      chosenFeatDetail: null, featSourceLabel: "", classDetailName: "Artificer", selectedCantripEntries: [], selectedSpellEntries: [],
      selectedInvocationEntries: [], baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
      newFeatures: [{ name: "Replicate Magic Item", noteTemplate: { id: note.id, title: note.title, text: "Plan 1:" } }],
    };
    const payload = buildLevelUpPayload(base as never) as { characterData: { playerNotesList: typeof note[] } };
    expect(payload.characterData.playerNotesList).toEqual([note]);
  });

  it("persists a Lessons Origin Feat through the normal extra Feat pipeline", () => {
    const choice = {
      key: "invocation:lessons_origin_feat",
      title: "Invocation Feat",
      sourceLabel: "Lessons of the First Ones",
      count: 1,
      options: [{ id: "f_alert", name: "Alert" }],
    };
    const payload = buildLevelUpPayload({
      char: { hpMax: 20, hpCurrent: 20, className: "Warlock", characterData: { extraFeatIds: ["f_tough"] } },
      nextLevel: 2, hpGain: 5, featHpBonus: 0, subclass: "", chosenCantrips: [], chosenSpells: [],
      chosenInvocations: ["ct_lessons_of_the_first_ones"], chosenExpertise: {},
      chosenFeatOptions: { "invocation:lessons_origin_feat": ["f_alert"] }, invocationFeatChoices: [choice], allInvocationFeatChoices: [choice],
      chosenFeatureChoices: {}, expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "",
      newFeatures: [], classDetailName: "Warlock", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { extraFeatIds: string[]; chosenFeatOptions: Record<string, string[]> } };
    expect(payload.characterData.extraFeatIds).toEqual(["f_tough", "f_alert"]);
    expect(payload.characterData.chosenFeatOptions[choice.key]).toEqual(["f_alert"]);
  });

  it("removes the granted Feat and stale choice when Lessons is no longer selected", () => {
    const choice = { key: "invocation:lessons_origin_feat", title: "Invocation Feat", sourceLabel: "Lessons", count: 1, options: [{ id: "f_alert", name: "Alert" }] };
    const payload = buildLevelUpPayload({
      char: { hpMax: 20, hpCurrent: 20, className: "Warlock", characterData: {
        extraFeatIds: ["f_tough", "f_alert"], chosenFeatOptions: { [choice.key]: ["f_alert"] },
      } },
      nextLevel: 3, hpGain: 5, featHpBonus: 0, subclass: "", chosenCantrips: [], chosenSpells: [], chosenInvocations: [],
      chosenExpertise: {}, chosenFeatOptions: {}, invocationFeatChoices: [], allInvocationFeatChoices: [choice],
      chosenFeatureChoices: {}, expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "", newFeatures: [],
      classDetailName: "Warlock", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { extraFeatIds: string[]; chosenFeatOptions: Record<string, string[]> } };
    expect(payload.characterData.extraFeatIds).toEqual(["f_tough"]);
    expect(payload.characterData.chosenFeatOptions[choice.key]).toBeUndefined();
  });
});
