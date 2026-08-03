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

  it("tags a Pact Boon replacement with the new level while an untouched Fighting Style pick keeps its old tag", () => {
    const pactBoonChoice = {
      key: "classchoicereplacement:cc_warlock_pact_boon",
      groupId: "cc_warlock_pact_boon",
      groupName: "Pact Boon",
      currentOptionId: "cco_pact_of_the_chain",
      currentSelectionNames: ["Pact Boon: Pact of the Chain"],
      options: [
        { id: "cco_pact_of_the_chain", name: "Pact of the Chain", selectionNames: ["Pact Boon: Pact of the Chain"] },
        { id: "cco_pact_of_the_blade", name: "Pact of the Blade", selectionNames: ["Pact Boon: Pact of the Blade"] },
      ],
    };
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 40,
        hpCurrent: 40,
        className: "Warlock",
        characterData: {
          classes: [{ className: "Warlock", classId: "c_warlock", level: 8 }],
          chosenOptionals: ["Pact Boon: Pact of the Chain", "Fighting Style: Archery"],
          acquisitionLevels: {
            "optional:Pact Boon: Pact of the Chain": 3,
            "optional:Fighting Style: Archery": 1,
          },
        },
      },
      nextLevel: 9,
      nextClassLevel: 9,
      hpGain: 5,
      featHpBonus: 0,
      subclass: "",
      chosenCantrips: [], chosenSpells: [], chosenInvocations: [],
      chosenExpertise: {}, chosenFeatOptions: {},
      chosenFeatureChoices: { "classchoicereplacement:cc_warlock_pact_boon": ["cco_pact_of_the_blade"] },
      expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "",
      newFeatures: [], classDetailName: "Warlock", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
      pactBoonReplacementChoice: pactBoonChoice,
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { chosenOptionals: string[]; acquisitionLevels: Record<string, number | null> } };

    expect(payload.characterData.chosenOptionals).toEqual(
      expect.arrayContaining(["Pact Boon: Pact of the Blade", "Fighting Style: Archery"]),
    );
    expect(payload.characterData.acquisitionLevels).toEqual({
      "optional:Pact Boon: Pact of the Blade": 9,
      "optional:Fighting Style: Archery": 1,
    });
  });

  it("carries acquisition level through for both carried-forward and newly-tagged spell entries", () => {
    // Mirrors what useLevelUpSubmit.ts's tagAcquisitionLevel produces: a carried-forward spell
    // keeps its original level, a brand-new one is tagged with this level-up's level.
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 40,
        hpCurrent: 40,
        className: "Wizard",
        characterData: {
          classes: [{ className: "Wizard", classId: "c_wizard", level: 6 }],
          proficiencies: {
            spells: [{ id: "s_fireball", name: "Fireball", source: "Wizard", level: 5 }],
          },
        },
      },
      nextLevel: 7,
      nextClassLevel: 7,
      hpGain: 5,
      featHpBonus: 0,
      subclass: "",
      chosenCantrips: [], chosenSpells: ["s_fireball", "s_lightning_bolt"], chosenInvocations: [],
      chosenExpertise: {}, chosenFeatOptions: {}, chosenFeatureChoices: {},
      expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "",
      newFeatures: [], classDetailName: "Wizard", selectedCantripEntries: [],
      selectedSpellEntries: [
        { id: "s_fireball", name: "Fireball", source: "Wizard", level: 5 },
        { id: "s_lightning_bolt", name: "Lightning Bolt", source: "Wizard", level: 7 },
      ],
      selectedInvocationEntries: [],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { proficiencies: { spells: Array<{ name: string; level?: number | null }> } } };

    expect(payload.characterData.proficiencies.spells).toEqual([
      expect.objectContaining({ name: "Fireball", level: 5 }),
      expect.objectContaining({ name: "Lightning Bolt", level: 7 }),
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

  it("drops a replaced feat's skill/tool/language/armor/weapon/save grants and keeps everything else", () => {
    const priorFeatEntry = (category: string) => ({ name: `${category} from old feat`, source: "Old Feat" });
    const classEntry = (category: string) => ({ name: `${category} from class`, source: "Fighter" });
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 40, hpCurrent: 40, className: "Fighter",
        characterData: {
          classes: [{ className: "Fighter", classId: "c_fighter", level: 5 }],
          proficiencies: {
            skills: [priorFeatEntry("skill"), classEntry("skill")],
            tools: [priorFeatEntry("tool"), classEntry("tool")],
            languages: [priorFeatEntry("language"), classEntry("language")],
            armor: [priorFeatEntry("armor"), classEntry("armor")],
            weapons: [priorFeatEntry("weapon"), classEntry("weapon")],
            saves: [priorFeatEntry("save"), classEntry("save")],
          },
        },
      },
      nextLevel: 6, hpGain: 5, featHpBonus: 0, subclass: "",
      chosenCantrips: [], chosenSpells: [], chosenInvocations: [], chosenExpertise: {}, chosenFeatOptions: {},
      chosenFeatureChoices: {}, expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null,
      featSourceLabel: "Old Feat",
      selectedFeatureProficiencyEntries: {
        skills: [{ name: "New Feat skill", source: "New Feat" }],
        tools: [{ name: "New Feat tool", source: "New Feat" }],
        languages: [{ name: "New Feat language", source: "New Feat" }],
        armor: [{ name: "New Feat armor", source: "New Feat" }],
        weapons: [{ name: "New Feat weapon", source: "New Feat" }],
        saves: [{ name: "New Feat save", source: "New Feat" }],
      },
      newFeatures: [], classDetailName: "Fighter", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as {
      characterData: { proficiencies: Record<"skills" | "tools" | "languages" | "armor" | "weapons" | "saves", Array<{ name: string; source: string }>> };
    };

    const singular: Record<"skills" | "tools" | "languages" | "armor" | "weapons" | "saves", string> = {
      skills: "skill", tools: "tool", languages: "language", armor: "armor", weapons: "weapon", saves: "save",
    };
    for (const category of ["skills", "tools", "languages", "armor", "weapons", "saves"] as const) {
      const names = payload.characterData.proficiencies[category].map((entry) => entry.name);
      const label = singular[category];
      expect(names).toContain(`${label} from class`);
      expect(names).toContain(`New Feat ${label}`);
      expect(names).not.toContain(`${label} from old feat`);
    }
  });

  it("fully rebuilds invocations from the class source but leaves other-sourced invocations alone", () => {
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 50, hpCurrent: 50, className: "Warlock",
        characterData: {
          classes: [{ className: "Warlock", classId: "c_warlock", level: 8 }],
          proficiencies: {
            invocations: [
              { id: "ct_old_a", name: "Old Invocation A", source: "Warlock" },
              { id: "ct_feat_granted", name: "Feat-Granted Invocation", source: "Some Feat" },
            ],
          },
        },
      },
      nextLevel: 9, nextClassLevel: 9, hpGain: 5, featHpBonus: 0, subclass: "",
      chosenCantrips: [], chosenSpells: [], chosenInvocations: ["ct_new_b"], chosenExpertise: {}, chosenFeatOptions: {},
      chosenFeatureChoices: {}, expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "",
      newFeatures: [], classDetailName: "Warlock", selectedCantripEntries: [], selectedSpellEntries: [],
      selectedInvocationEntries: [{ id: "ct_new_b", name: "New Invocation B", source: "Warlock" }],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { proficiencies: { invocations: Array<{ name: string; source: string }> } } };

    const names = payload.characterData.proficiencies.invocations.map((entry) => entry.name);
    expect(names).toContain("Feat-Granted Invocation");
    expect(names).toContain("New Invocation B");
    expect(names).not.toContain("Old Invocation A");
  });

  it("expertise: drops a freshly-repicked source's old grant and a replaced entry by name, keeps the rest", () => {
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 40, hpCurrent: 40, className: "Rogue",
        characterData: {
          classes: [{ className: "Rogue", classId: "c_rogue", level: 5 }],
          proficiencies: {
            expertise: [
              { name: "Stealth", source: "Rogue" },
              { name: "Old Expertise Feat Pick", source: "Some Feat" },
              { name: "Thieves' Tools", source: "Background" },
            ],
          },
        },
      },
      nextLevel: 6, hpGain: 5, featHpBonus: 0, subclass: "",
      chosenCantrips: [], chosenSpells: [], chosenInvocations: [],
      chosenExpertise: { "expertise:cc_rogue_expertise": ["Athletics"], "expertise:cc_rogue_expertise:target": ["Thieves' Tools"] },
      chosenFeatOptions: {}, chosenFeatureChoices: {},
      expertiseChoices: [{ key: "expertise:cc_rogue_expertise", source: "Rogue" }],
      expertiseReplacementChoices: [{ key: "expertise:cc_rogue_expertise", source: "Rogue" }],
      featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "",
      newFeatures: [], classDetailName: "Rogue", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { proficiencies: { expertise: Array<{ name: string; source: string }> } } };

    const names = payload.characterData.proficiencies.expertise.map((entry) => entry.name);
    // "Stealth" (source Rogue) is dropped because Rogue is an active expertiseChoices source this
    // level-up -- that slot is being freshly re-picked, not accumulated.
    expect(names).not.toContain("Stealth");
    // "Thieves' Tools" is dropped because it's the explicit replacement target, even though its
    // source ("Background") doesn't match any active choice.
    expect(names).not.toContain("Thieves' Tools");
    // Feat-sourced entries are untouched here since featSourceLabel is "" this level-up.
    expect(names).toContain("Old Expertise Feat Pick");
  });

  it("maneuvers/metamagic/infusions/plans: pass through untouched when nothing new is selected", () => {
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 40, hpCurrent: 40, className: "Battle Master",
        characterData: {
          proficiencies: {
            maneuvers: [{ name: "Trip Attack", source: "Battle Master", sourceKey: "growth:maneuver:1" }],
            metamagic: [{ name: "Quickened Spell", source: "Sorcerer", sourceKey: "growth:metamagic:1" }],
            infusions: [{ name: "Enhanced Weapon", source: "Artificer", sourceKey: "growth:infusion:1" }],
            plans: [{ name: "Bag of Holding", source: "Artificer", sourceKey: "growth:plan:1" }],
          },
        },
      },
      nextLevel: 6, hpGain: 5, featHpBonus: 0, subclass: "",
      chosenCantrips: [], chosenSpells: [], chosenInvocations: [], chosenExpertise: {}, chosenFeatOptions: {},
      chosenFeatureChoices: {}, expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "",
      newFeatures: [], classDetailName: "Fighter", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as {
      characterData: { proficiencies: Record<"maneuvers" | "metamagic" | "infusions" | "plans", Array<{ name: string }>> };
    };

    expect(payload.characterData.proficiencies.maneuvers).toEqual([expect.objectContaining({ name: "Trip Attack" })]);
    expect(payload.characterData.proficiencies.metamagic).toEqual([expect.objectContaining({ name: "Quickened Spell" })]);
    expect(payload.characterData.proficiencies.infusions).toEqual([expect.objectContaining({ name: "Enhanced Weapon" })]);
    expect(payload.characterData.proficiencies.plans).toEqual([expect.objectContaining({ name: "Bag of Holding" })]);
  });

  it("maneuvers: a newly selected entry replaces only the existing entry sharing its sourceKey", () => {
    const payload = buildLevelUpPayload({
      char: {
        hpMax: 40, hpCurrent: 40, className: "Battle Master",
        characterData: {
          proficiencies: {
            maneuvers: [
              { name: "Trip Attack", source: "Battle Master", sourceKey: "growth:maneuver:1" },
              { name: "Feinting Attack", source: "Battle Master", sourceKey: "growth:maneuver:2" },
            ],
          },
        },
      },
      nextLevel: 7, hpGain: 5, featHpBonus: 0, subclass: "",
      chosenCantrips: [], chosenSpells: [], chosenInvocations: [], chosenExpertise: {}, chosenFeatOptions: {},
      chosenFeatureChoices: {}, expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "",
      selectedManeuverEntries: [{ name: "Disarming Attack", source: "Battle Master", sourceKey: "growth:maneuver:1" }],
      newFeatures: [], classDetailName: "Fighter", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
      baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
    } as never) as { characterData: { proficiencies: { maneuvers: Array<{ name: string }> } } };

    const names = payload.characterData.proficiencies.maneuvers.map((entry) => entry.name);
    expect(names).toContain("Disarming Attack");
    expect(names).toContain("Feinting Attack");
    expect(names).not.toContain("Trip Attack");
  });
});
