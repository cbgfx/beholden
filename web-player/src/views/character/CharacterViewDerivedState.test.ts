import { describe, expect, it } from "vitest";
import { buildCharacterViewDerivedState } from "@/views/character/CharacterViewDerivedState";
import type { CharacterViewDerivedStateArgs } from "@/views/character/CharacterViewDerivedTypes";

function buildArgs(): CharacterViewDerivedStateArgs {
  return {
    char: {
      id: "character",
      name: "Calculation Test",
      playerName: "Player",
      className: "Fighter",
      species: "Human",
      level: 5,
      hpMax: 40,
      hpCurrent: 40,
      ac: 10,
      speed: 30,
      strScore: 12,
      dexScore: 14,
      conScore: 15,
      intScore: 10,
      wisScore: 12,
      chaScore: 8,
      color: null,
      imageUrl: null,
      campaigns: [],
      overrides: { tempHp: 4, acBonus: 1, hpMaxBonus: 3 },
      characterData: {
        extraFeatAbilityChoices: {},
        inventory: [
          {
            id: "gauntlets",
            name: "Gauntlets of Ogre Power",
            quantity: 1,
            equipped: true,
            equipState: "worn",
            attunement: true,
            attuned: true,
            description: "Your Strength score is 19 while you wear these gauntlets.",
          },
          {
            id: "armor",
            name: "Studded Leather",
            quantity: 1,
            equipped: true,
            equipState: "worn",
            type: "Light Armor",
            ac: 12,
          },
          {
            id: "shield",
            name: "Shield",
            quantity: 1,
            equipped: true,
            equipState: "offhand",
            type: "Shield",
          },
        ],
      },
    },
    classDetail: null,
    raceDetail: null,
    backgroundDetail: null,
    bgOriginFeatDetail: null,
    raceFeatDetail: null,
    classFeatDetails: [],
    levelUpFeatDetails: [],
    invocationDetails: [],
    extraFeatDetails: [
      {
        id: "durable",
        name: "Durable",
        text: "Increase your Constitution score by 1, to a maximum of 20.",
      },
      {
        id: "tough",
        name: "Tough",
        text: "Your hit point maximum increases by an amount equal to twice your character level.",
      },
    ],
    subclass: null,
    polymorphCondition: null,
    polymorphMonsterState: { monster: null, busy: false, error: null },
  };
}

describe("buildCharacterViewDerivedState", () => {
  it("combines feats, equipped items, armor, shield, and manual overrides", () => {
    const state = buildCharacterViewDerivedState(buildArgs());

    expect(state.scores.str).toBe(19);
    expect(state.scores.con).toBe(16);
    expect(state.effectiveHpMax).toBe(58);
    expect(state.effectiveAc).toBe(17);
    expect(state.tempHp).toBe(4);
  });

  it("does not apply an unattuned item's ability override", () => {
    const args = buildArgs();
    const gauntlets = args.char.characterData?.inventory?.[0];
    if (gauntlets) gauntlets.attuned = false;

    expect(buildCharacterViewDerivedState(args).scores.str).toBe(12);
  });

  it("applies a valid manual override after feat and item calculations", () => {
    const args = buildArgs();
    if (args.char.overrides) args.char.overrides.abilityScores = { str: 20, con: 18 };

    const state = buildCharacterViewDerivedState(args);
    expect(state.scores.str).toBe(20);
    expect(state.scores.con).toBe(18);
    expect(state.effectiveHpMax).toBe(63);
  });
});
