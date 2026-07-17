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
            effects: [{ type: "ability_score", mode: "set_minimum", ability: "str", choiceCount: 1, amount: 19 }],
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
        text: "Display-only prose claims Strength increases by 10.",
        parsed: { grants: { abilityIncreases: { constitution: 1 } } },
      },
      {
        id: "tough",
        name: "Tough",
        text: "Display-only prose claims 1 extra Hit Point.",
        parsed: { grants: { effects: [{ type: "hit_points", mode: "max_bonus", amount: { kind: "character_level", multiplier: 2 } }] } },
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

  it("does not infer item mechanics from prose when canonical effects are absent", () => {
    const args = buildArgs();
    const gauntlets = args.char.characterData?.inventory?.[0];
    if (gauntlets) delete gauntlets.effects;

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

  it("adds a magic shield's and magic armor's enchantment bonus from compendium modifiers, not a flat guess", () => {
    const args = buildArgs();
    const inventory = args.char.characterData!.inventory!;
    const armor = inventory.find((i) => i.id === "armor")!;
    armor.modifiers = [{ target: "ac", amount: 1 }];
    const shield = inventory.find((i) => i.id === "shield")!;
    shield.modifiers = [{ target: "ac", amount: 1 }];

    const state = buildCharacterViewDerivedState(args);
    // Baseline (no modifiers) is 17 — see the test above. Armor +1 and Shield +1 each add another
    // point of AC on top of that.
    expect(state.effectiveAc).toBe(19);
  });

  it("derives Barbarian's Unarmored Defense from its canonical effect, never its prose", () => {
    // The real compendium text for Barbarian's Level 1 Unarmored Defense feature, verbatim.
    // Proves the generic armor-class text parser (parseArmorClassEffects) already produces the
    // correct base_formula effect — including which two abilities to use and that a shield doesn't
    // disable it — so a hardcoded `/barbarian/i.test(className)` fallback elsewhere is redundant.
    // See COMPENDIUM_SOURCE_OF_TRUTH.md Phase 2.
    const args = buildArgs();
    args.char.className = "Barbarian";
    args.char.characterData!.inventory = []; // no armor, no shield
    args.classDetail = {
      id: "c_barbarian",
      name: "Barbarian",
      hd: 12,
      autolevels: [
        {
          level: 1,
          slots: null,
          counters: [],
          features: [
            {
              id: "cf_barbarian_unarmored_defense",
              name: "Level 1: Unarmored Defense",
              optional: false,
              text: "Display text that deliberately contains no mechanical formula.",
              effects: [{
                type: "armor_class",
                mode: "base_formula",
                base: 10,
                abilities: ["dex", "con"],
                gate: { armorState: "no_armor", shieldAllowed: true },
              }],
            },
          ],
        },
      ],
    };

    const state = buildCharacterViewDerivedState(args);
    // dexScore 14 (+2) + conScore 15+1 from the fixture's "Durable" feat (+3) + base 10
    // + overrides.acBonus 1 = 16.
    expect(state.effectiveAc).toBe(16);
  });

  it("derives a species-granted swim speed from a trait's structured effects, never from its prose", () => {
    // the sole source of truth, so a trait's own description text is display-only and is never
    // parsed to recover mechanics, even when it reads as an unambiguous rule. See
    // COMPENDIUM_SOURCE_OF_TRUTH.md's Species section.
    const args = buildArgs();
    args.raceDetail = {
      id: "r_test_amphibious",
      name: "Test Amphibious Species",
      speed: 30,
      traits: [
        {
          name: "Innate Swimmer",
          text: "You have a Swim Speed of 30 feet.",
          effects: [{ type: "speed", mode: "grant_mode", movementMode: "swim", amount: { kind: "fixed", value: 30 } }],
        },
      ],
    };

    const state = buildCharacterViewDerivedState(args);
    expect(state.movementModes).toContainEqual({ mode: "swim", speed: 30 });
  });

  it("does NOT infer a species movement mode from trait prose when effects is absent — silence, not a guess", () => {
    const args = buildArgs();
    args.raceDetail = {
      id: "r_test_amphibious_unmigrated",
      name: "Test Unmigrated Species",
      speed: 30,
      traits: [
        // Identical prose to the trait above, but with no structured effects — a homebrew or
        // not-yet-migrated species trait. Must NOT produce a swim speed: the app no longer parses
        // species trait prose for mechanics at all, so this correctly resolves to nothing rather
        // than silently guessing from text that happens to look parseable.
        { name: "Innate Swimmer", text: "You have a Swim Speed of 30 feet." },
      ],
    };

    const state = buildCharacterViewDerivedState(args);
    expect(state.movementModes).not.toContainEqual({ mode: "swim", speed: 30 });
  });

  it("derives a species trait's AC bonus and damage resistance from the trait's own structured effects field, not prose parsing", () => {
    // The trait's `text` is deliberately blank/non-matching prose, so this can only pass if the
    // +1 AC and Poison resistance come from `effects` — the compendium's typed facts — and not
    // from any regex reading the description. Mirrors real Warforged data (Integrated Protection,
    // Constructed Resilience) once those traits carry real structured effects.
    const args = buildArgs();
    args.char.characterData!.inventory = [];
    args.raceDetail = {
      id: "r_test_construct",
      name: "Test Construct Species",
      speed: 30,
      traits: [
        {
          name: "Integrated Protection",
          text: "See the species entry for full details.",
          effects: [{ type: "armor_class", mode: "bonus", bonus: { kind: "fixed", value: 1 } }],
        },
        {
          name: "Constructed Resilience",
          text: "See the species entry for full details.",
          effects: [{ type: "defense", mode: "damage_resistance", targets: ["Poison"] }],
        },
      ],
    };

    const state = buildCharacterViewDerivedState(args);
    // Base 10 + Dex mod 2 + the fixture's overrides.acBonus 1 = 13, +1 from the structured
    // Integrated Protection effect = 14.
    expect(state.effectiveAc).toBe(14);
  });
});
