import { describe, expect, it } from "vitest";
import { deriveFeatAbilityBonuses, deriveLevelUpValidation } from "@/views/level-up/LevelUpUtils";

describe("deriveFeatAbilityBonuses", () => {
  it("awards Great Weapon Master's fixed Strength increase from its feat text", () => {
    expect(deriveFeatAbilityBonuses({
      chosenFeatDetail: {
        id: "f_great_weapon_master",
        text: "Ability Score Increase. Increase your Strength score by 1, to a maximum of 20.",
        parsed: { grants: { abilityIncreases: {} } },
      },
      chosenFeatOptions: {},
      featChoiceEntries: [],
      nextLevel: 4,
    })).toEqual({ str: 1 });
  });

  it("does not duplicate a fixed increase already supplied by parsed grants", () => {
    expect(deriveFeatAbilityBonuses({
      chosenFeatDetail: {
        id: "f_great_weapon_master",
        text: "Ability Score Increase. Increase your Strength score by 1, to a maximum of 20.",
        parsed: { grants: { abilityIncreases: { strength: 1 } } },
      },
      chosenFeatOptions: {},
      featChoiceEntries: [],
      nextLevel: 4,
    })).toEqual({ str: 1 });
  });
});

describe("deriveLevelUpValidation blockers", () => {
  /** A level-8 Cleric taking a feat, with nothing outstanding -- the shape of Diego's level-up. */
  function validArgs(): Parameters<typeof deriveLevelUpValidation>[0] {
    return {
      ruleset: "5.5e",
      isAsiLevel: true,
      asiMode: "feat",
      asiStats: {},
      needsSubclassChoice: false,
      subclass: "Light Domain",
      cantripCount: 0,
      chosenCantrips: [],
      spellcaster: true,
      prepCount: 12,
      chosenSpells: [],
      invocCount: 0,
      chosenInvocations: [],
      expertiseChoices: [],
      expertiseReplacementChoices: [],
      chosenExpertise: {},
      chosenFeatDetail: { id: "f_durable", name: "Durable", parsed: { prerequisite: 4 } },
      featChoiceEntries: [],
      chosenFeatOptions: {},
      nextLevel: 8,
      className: "Cleric",
      level: 8,
      scores: { str: 8, dex: 10, con: 14, int: 14, wis: 18, cha: 12 },
      featSearch: "",
      featSummaries: [],
      hpGain: 5,
      existingLevelUpFeats: [{ level: 4, featId: "f_war_caster_wisdom", type: "feat" }],
      ownedFeatIds: [],
    };
  }

  it("reports nothing when every requirement is met", () => {
    const result = deriveLevelUpValidation(validArgs());
    expect(result.blockers).toEqual([]);
    expect(result.canConfirm).toBe(true);
  });

  it("reports the hit point choice, which sits far above the confirm button", () => {
    const result = deriveLevelUpValidation({ ...validArgs(), hpGain: null });
    expect(result.blockers).toEqual(["hp"]);
    expect(result.canConfirm).toBe(false);
  });

  it("distinguishes a missing feat from one whose prerequisite fails", () => {
    expect(deriveLevelUpValidation({ ...validArgs(), chosenFeatDetail: null }).blockers).toEqual(["featMissing"]);

    const tooLow = deriveLevelUpValidation({
      ...validArgs(),
      nextLevel: 2,
      level: 2,
      chosenFeatDetail: { id: "f_durable", name: "Durable", parsed: { prerequisite: 4 } },
    });
    expect(tooLow.blockers).toEqual(["featPrereq"]);
  });

  it("reports a feat that is already taken and cannot repeat", () => {
    const result = deriveLevelUpValidation({
      ...validArgs(),
      existingLevelUpFeats: [{ level: 4, featId: "f_durable", type: "feat" }],
    });
    expect(result.blockers).toEqual(["featRepeatable"]);
  });

  it("reports a feat whose own options are still unchosen", () => {
    const result = deriveLevelUpValidation({
      ...validArgs(),
      featChoiceEntries: [{ id: "tool", type: "proficiency", count: 1, options: ["Smiths Tools", "Cooks Utensils"] }],
    });
    expect(result.blockers).toEqual(["featOptions"]);
  });

  it("lists every outstanding requirement at once", () => {
    const result = deriveLevelUpValidation({
      ...validArgs(),
      hpGain: null,
      needsSubclassChoice: true,
      subclass: "",
      cantripCount: 2,
      chosenCantrips: [],
    });
    expect(result.blockers).toEqual(["hp", "subclass", "cantrips"]);
  });

  it("does not blame the feat when the level-up is spending ability points instead", () => {
    const result = deriveLevelUpValidation({
      ...validArgs(),
      asiMode: "asi",
      asiStats: { con: 1 },
      chosenFeatDetail: null,
    });
    expect(result.blockers).toEqual(["asi"]);
  });
});
