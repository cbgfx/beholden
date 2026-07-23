import { describe, expect, it } from "vitest";
import { buildCharacterViewDerivedState, buildHitDicePools, mergeAllClassProficiencies, mergeFixedClassProficiencies } from "@/views/character/CharacterViewDerivedState";
import type { CharacterViewDerivedStateArgs } from "@/views/character/CharacterViewDerivedTypes";

function buildArgs(): CharacterViewDerivedStateArgs {
  return {
    char: {
      id: "character",
      ruleset: "5.5e",
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
  it("uses full proficiencies for the first class and reduced grants for later classes", () => {
    const proficiencies = mergeAllClassProficiencies(undefined, [
      {
        entry: { id: "fighter-entry", classId: "c_fighter", className: "Fighter", level: 2 },
        detail: { id: "c_fighter", name: "Fighter", hd: 10, proficiencies: { savingThrows: ["str", "con"], armor: ["All Armor"], weapons: ["Martial Weapons"] }, autolevels: [] },
      },
      {
        entry: { id: "wizard-entry", classId: "c_wizard", className: "Wizard", level: 3 },
        detail: { id: "c_wizard", name: "Wizard", hd: 6, proficiencies: { savingThrows: ["int", "wis"] }, multiclass: { weapons: ["Daggers"], tools: { fixed: ["Herbalism Kit"] } }, autolevels: [] },
      },
    ]);

    expect(proficiencies?.saves.map((entry) => entry.name)).toEqual(["str", "con"]);
    expect(proficiencies?.weapons.map((entry) => entry.name)).toEqual(["Martial Weapons", "Daggers"]);
    expect(proficiencies?.tools.map((entry) => entry.name)).toEqual(["Herbalism Kit"]);
  });

  it("groups multiclass hit dice by die size", () => {
    expect(buildHitDicePools([
      { entry: { id: "fighter", classId: "fighter", level: 3 }, detail: { id: "fighter", name: "Fighter", hd: 10, autolevels: [] } },
      { entry: { id: "wizard", classId: "wizard", level: 2 }, detail: { id: "wizard", name: "Wizard", hd: 6, autolevels: [] } },
      { entry: { id: "warlock", classId: "warlock", level: 1 }, detail: { id: "warlock", name: "Warlock", hd: 8, autolevels: [] } },
    ])).toEqual([
      { dieSize: 10, max: 3, current: 3 },
      { dieSize: 6, max: 2, current: 2 },
      { dieSize: 8, max: 1, current: 1 },
    ]);
  });

  it("restores persisted multiclass hit-die pools without merging their die sizes", () => {
    expect(buildHitDicePools([
      { entry: { id: "fighter", classId: "fighter", level: 3 }, detail: { id: "fighter", name: "Fighter", hd: 10, autolevels: [] } },
      { entry: { id: "wizard", classId: "wizard", level: 2 }, detail: { id: "wizard", name: "Wizard", hd: 6, autolevels: [] } },
    ], 4, { "10": 2, "6": 1 })).toEqual([
      { dieSize: 10, max: 3, current: 2 },
      { dieSize: 6, max: 2, current: 1 },
    ]);
  });

  it("reconciles fixed class armor proficiencies missing from a legacy character", () => {
    const proficiencies = mergeFixedClassProficiencies(undefined, {
      id: "c_barbarian",
      name: "Barbarian",
      hd: 12,
      proficiencies: {
        savingThrows: ["str", "con"],
        armor: ["Light Armor", "Medium Armor", "Shields"],
        weapons: ["Simple Weapons", "Martial Weapons"],
      },
      autolevels: [],
    });

    expect(proficiencies?.armor.map((entry) => entry.name)).toEqual(["Light Armor", "Medium Armor", "Shields"]);
    expect(proficiencies?.weapons.map((entry) => entry.name)).toEqual(["Simple Weapons", "Martial Weapons"]);
    expect(proficiencies?.saves.map((entry) => entry.name)).toEqual(["str", "con"]);
  });

  it("does not penalize a Barbarian wearing medium armor when stored proficiencies are missing", () => {
    const args = buildArgs();
    args.char.characterData!.inventory = [{
      id: "half-plate",
      name: "Adamantine Half Plate Armor",
      quantity: 1,
      equipped: true,
      equipState: "worn",
      type: "Medium Armor",
      ac: 15,
    }];
    args.classDetail = {
      id: "c_barbarian",
      name: "Barbarian",
      hd: 12,
      proficiencies: {
        savingThrows: ["str", "con"],
        armor: ["Light Armor", "Medium Armor", "Shields"],
        weapons: ["Simple Weapons", "Martial Weapons"],
      },
      autolevels: [],
    };

    const state = buildCharacterViewDerivedState(args);
    expect(state.nonProficientArmorPenalty).toBe(false);
    expect(state.prof?.armor.map((entry) => entry.name)).toContain("Medium Armor");
  });

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

  it("adds an attuned held item's typed AC bonus, including Staff of Defense", () => {
    const args = buildArgs();
    args.char.characterData!.inventory!.push({
      id: "i_staff_of_defense",
      name: "Staff of Defense",
      quantity: 1,
      equipped: true,
      equipState: "mainhand-1h",
      attunement: true,
      attuned: true,
      modifiers: [{ target: "ac", amount: 1 }],
    });

    expect(buildCharacterViewDerivedState(args).effectiveAc).toBe(18);
  });

  it("does not add an unattuned held item's typed AC bonus", () => {
    const args = buildArgs();
    args.char.characterData!.inventory!.push({
      id: "i_staff_of_defense",
      name: "Staff of Defense",
      quantity: 1,
      equipped: true,
      equipState: "mainhand-1h",
      attunement: true,
      attuned: false,
      modifiers: [{ target: "ac", amount: 1 }],
    });

    expect(buildCharacterViewDerivedState(args).effectiveAc).toBe(17);
  });

  it("links Magic Initiate's chosen level 1 spell to its 1/1 free cast", () => {
    const args = buildArgs();
    args.char.characterData!.proficiencies = {
      skills: [], expertise: [], saves: [], armor: [], weapons: [], tools: [], languages: [],
      spells: [{ id: "s_shield", name: "Shield", source: "Origin: Magic Initiate" }],
      invocations: [], maneuvers: [], metamagic: [], plans: [],
    };
    args.char.characterData!.chosenFeatOptions = {
      "bg:Origin: Magic Initiate:spell_from_same_list_3": ["s_shield"],
    };
    args.bgOriginFeatDetail = {
      id: "f_origin_magic_initiate",
      name: "Origin: Magic Initiate",
      text: "Choose a level 1 spell and cast it once without a spell slot.",
      parsed: {
        uses: [{ count: 1, note: "can cast it once without a spell slot", grantsChoiceId: "spell_from_same_list_3" }],
      },
    };

    const state = buildCharacterViewDerivedState(args);
    expect(state.grantedSpellData.spells).toContainEqual(expect.objectContaining({
      spellId: "s_shield",
      spellName: "Shield",
      sourceName: "Origin: Magic Initiate",
      mode: "limited",
      resourceKey: expect.stringContaining(":use:1"),
    }));
    expect(state.grantedSpellData.resources).toContainEqual(expect.objectContaining({
      name: "Origin: Magic Initiate",
      current: 1,
      max: 1,
    }));
    expect(state.spellLinkedResourceKeys).toContain(state.grantedSpellData.spells[0]?.resourceKey);
  });

  it("marks unresolved choice-based free casts as spell-linked instead of generic Resources", () => {
    const args = buildArgs();
    args.levelUpFeatDetails = [{
      level: 4,
      featId: "f_fey_touched_intelligence",
      feat: {
        id: "f_fey_touched_intelligence",
        name: "Fey-Touched (Intelligence)",
        text: "Choose a spell and cast each spell once without a slot.",
        parsed: {
          grants: { spells: ["Misty Step"] },
          uses: [
            { count: 1, note: "Misty Step", grantsSpell: "Misty Step" },
            { count: 1, note: "chosen spell", grantsChoiceId: "spell_school_1" },
          ],
        },
      },
    }];

    const state = buildCharacterViewDerivedState(args);
    expect(state.spellLinkedResourceKeys.size).toBe(2);
    expect(state.classResourcesWithSpellCasts.filter((resource) => state.spellLinkedResourceKeys.has(resource.key))).toHaveLength(2);
  });

  it("derives Barbarian's Unarmored Defense from its canonical effect, never its prose", () => {
    // The real compendium text for Barbarian's Level 1 Unarmored Defense feature, verbatim.
    // Proves the generic armor-class text parser (parseArmorClassEffects) already produces the
    // correct base_formula effect — including which two abilities to use and that a shield doesn't
    // disable it — so a hardcoded `/barbarian/i.test(className)` fallback elsewhere is redundant.
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
    // parsed to recover mechanics, even when it reads as an unambiguous rule.
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
