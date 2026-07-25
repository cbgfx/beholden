import { describe, expect, it } from "vitest";
import { buildLevelUpPayload } from "./buildLevelUpPayload";

describe("buildLevelUpPayload", () => {
  it("increments the selected class level independently from total character level", () => {
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 38,
        hpCurrent: 38,
        className: "Fighter",
        characterData: {
          classes: [
            { id: "class_fighter", classId: "c_fighter", className: "Fighter", level: 3 },
            { id: "class_wizard", classId: "c_wizard", className: "Wizard", level: 2 },
          ],
        },
      },
      nextLevel: 6,
      nextClassLevel: 4,
      hpGain: 8,
      featHpBonus: 0,
      subclass: "sc_fighter_champion",
      chosenCantrips: [], chosenSpells: [], chosenInvocations: [], chosenExpertise: {}, chosenFeatOptions: {},
      chosenFeatureChoices: {}, expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "",
      newFeatures: [], classDetailName: "Fighter", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { level: number; characterData: { classes: Array<{ classId: string; level: number }> } };

    expect(payload.level).toBe(6);
    expect(payload.characterData.classes).toEqual([
      expect.objectContaining({ classId: "c_fighter", level: 4 }),
      expect.objectContaining({ classId: "c_wizard", level: 2 }),
    ]);
  });

  it("can advance a non-primary class", () => {
    const payload = buildLevelUpPayload({
      char: { hpMax: 38, hpCurrent: 38, className: "Fighter", characterData: { classes: [
        { id: "class_fighter", classId: "c_fighter", className: "Fighter", level: 3 },
        { id: "class_wizard", classId: "c_wizard", className: "Wizard", level: 2 },
      ] } },
      nextLevel: 6, nextClassLevel: 3, targetClassEntryId: "class_wizard", targetClassId: "c_wizard", hpGain: 5, featHpBonus: 0,
      subclass: "", chosenCantrips: [], chosenSpells: [], chosenInvocations: [], chosenExpertise: {}, chosenFeatOptions: {}, chosenFeatureChoices: {},
      expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "", newFeatures: [], classDetailName: "Wizard",
      selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [], baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { classes: Array<{ id: string; level: number }> } };
    expect(payload.characterData.classes).toEqual([
      expect.objectContaining({ id: "class_fighter", level: 3 }),
      expect.objectContaining({ id: "class_wizard", level: 3 }),
    ]);
  });

  it("adds a level-one class with only its reduced multiclass proficiencies", () => {
    const payload = buildLevelUpPayload({
      char: { hpMax: 30, hpCurrent: 30, className: "Fighter", characterData: { classes: [{ id: "class_fighter", classId: "c_fighter", className: "Fighter", level: 3 }] } },
      nextLevel: 4, nextClassLevel: 1, targetClassEntryId: "class_bard", targetClassId: "c_bard", isAddingClass: true,
      multiclassProficiencies: { skills: ["Persuasion"], tools: ["Lute"], armor: ["Light Armor"], weapons: [] },
      hpGain: 5, featHpBonus: 0, subclass: "", chosenCantrips: [], chosenSpells: [], chosenInvocations: [], chosenExpertise: {}, chosenFeatOptions: {}, chosenFeatureChoices: {},
      expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "", newFeatures: [], classDetailName: "Bard",
      selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [], baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { classes: Array<{ id: string; classId: string; level: number }>; proficiencies: { skills: Array<{ name: string }>; tools: Array<{ name: string }>; armor: Array<{ name: string }> } } };
    expect(payload.characterData.classes).toContainEqual(expect.objectContaining({ id: "class_bard", classId: "c_bard", level: 1 }));
    expect(payload.characterData.proficiencies.skills).toContainEqual(expect.objectContaining({ name: "Persuasion" }));
    expect(payload.characterData.proficiencies.tools).toContainEqual(expect.objectContaining({ name: "Lute" }));
    expect(payload.characterData.proficiencies.armor).toContainEqual(expect.objectContaining({ name: "Light Armor" }));
  });

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
