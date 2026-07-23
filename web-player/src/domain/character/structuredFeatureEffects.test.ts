import { describe, expect, it } from "vitest";
import { parseFeatureEffects } from "./parseFeatureEffects";
import { deriveAttackDamageBonusFromEffects } from "./parseFeatureEffectsDerived";
import { structuredEffectsFromCanonical } from "./structuredFeatureEffects";
import { weaponMatchesFilters } from "./parseFeatureEffectsDerivedHelpers";

const source = {
  id: "class:test",
  kind: "class" as const,
  name: "Test Feature",
  text: "",
};

describe("structured canonical feature effects", () => {
  it("recognizes a magic-weapon gate without reading the item name", () => {
    const weapon = { name: "Moon Blade", dmg1: "1d8", magic: true };
    expect(weaponMatchesFilters(weapon, ["magic_weapon"])).toBe(true);
    expect(weaponMatchesFilters({ ...weapon, magic: false }, ["magic_weapon"])).toBe(false);
  });
  it("maps stable class spell choices without reading feature prose", () => {
    const parsed = parseFeatureEffects({
      source,
      text: "This deliberately contains no parseable spell-choice sentence.",
      classChoices: [{
        id: "fc_warlock_mystic_arcanum_6",
        kind: "spell",
        lists: ["sl_warlock"],
        mode: "known",
        level: 6,
        replace: true,
        freeCast: true,
      }],
    });

    expect(parsed.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "spell_choice",
        choiceId: "fc_warlock_mystic_arcanum_6",
        spellLists: ["sl_warlock"],
        mode: "learn",
        level: 6,
        freeCast: true,
        canReplace: true,
      }),
      expect.objectContaining({
        type: "resource_grant",
        resourceKey: "fc_warlock_mystic_arcanum_6",
        max: { kind: "fixed", value: 1 },
      }),
    ]));
  });

  it("preserves a conditional fallback for an already-known fixed spell", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, name: "Improved Illusions" },
      classChoices: [{
        id: "fc_improved_illusions_replacement",
        kind: "spell",
        lists: ["sl_wizard"],
        mode: "known",
        level: 0,
        ifKnown: "Minor Illusion",
      }],
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "spell_choice",
        choiceId: "fc_improved_illusions_replacement",
        ifKnown: "Minor Illusion",
      }),
    ]));
  });

  it("maps a typed maneuver replacement without reading feature prose", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, name: "Martial Versatility" },
      classChoices: [{ id: "fc_fighter_maneuver_replacement_4", kind: "replacement", target: "maneuver", count: 1 }],
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "selection_replacement",
        target: "maneuver",
        count: { kind: "fixed", value: 1 },
      }),
    ]));
  });

  it("maps a typed metamagic replacement without reading feature prose", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, name: "Sorcerous Versatility" },
      classChoices: [{ id: "fc_sorcerer_metamagic_replacement_4", kind: "replacement", target: "metamagic", count: 1 }],
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "selection_replacement",
        target: "metamagic",
        count: { kind: "fixed", value: 1 },
      }),
    ]));
  });

  it("maps constrained class proficiency choices without prose", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, name: "Blessings of Knowledge" },
      classChoices: [{ kind: "proficiency", category: "skill", count: 2, from: ["Arcana", "History", "Nature", "Religion"] }],
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "proficiency_grant",
        category: "skill",
        choice: {
          count: { kind: "fixed", value: 2 },
          optionCategory: "skill",
          options: ["Arcana", "History", "Nature", "Religion"],
        },
      }),
    ]));
  });

  it("maps table-facing selections without turning them into proficiencies", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, name: "Natural Explorer" },
      classChoices: [{
        id: "fc_ranger_favored_terrain_1",
        kind: "selection",
        label: "Favored Terrain",
        count: 1,
        options: ["Forest", "Underdark"],
      }],
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "proficiency_grant",
        category: "selection",
        choice: expect.objectContaining({
          optionCategory: "selection",
          options: ["Forest", "Underdark"],
        }),
      }),
    ]));
  });

  it("preserves a conditional replacement proficiency choice", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, name: "Unfettered Mind" },
      classChoices: [{
        kind: "proficiency",
        category: "saving_throw",
        count: 1,
        from: ["str", "dex", "con", "wis", "cha"],
        ifProficient: "int",
      }],
    });
    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "proficiency_grant",
        category: "saving_throw",
        choice: expect.objectContaining({ ifProficient: "int" }),
      }),
    ]));
  });

  it("maps typed class effects without feature prose", () => {
    const effects = structuredEffectsFromCanonical({
      source,
      classEffects: [
        { type: "speed", mode: "bonus", amount: { kind: "fixed", value: 10 } },
        { type: "ability_score", mode: "fixed", ability: "str", choiceCount: 1, amount: 4, maximum: 30 },
        { type: "proficiency_grant", category: "saving_throw", grants: ["wis"] },
        { type: "proficiency_grant", category: "skill", grants: ["Perception"] },
      ],
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "speed", mode: "bonus", amount: { kind: "fixed", value: 10 } }),
      expect.objectContaining({ type: "ability_score", mode: "fixed", ability: "str", amount: 4 }),
      expect.objectContaining({ type: "proficiency_grant", category: "saving_throw", grants: ["wis"] }),
      expect.objectContaining({ type: "proficiency_grant", category: "skill", grants: ["Perception"] }),
    ]));
  });

  it("maps feat grants and proficiency-scaled uses", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, id: "feat:lucky", kind: "feat", name: "Lucky" },
      featMechanics: {
        grants: {
          skills: ["Perception"],
          tools: [],
          languages: [],
          armor: [],
          weapons: [],
          savingThrows: [],
          spells: ["Misty Step"],
          cantrips: [],
          abilityIncreases: { charisma: 1 },
        },
        uses: [{
          count: 1,
          countFrom: "proficiency_bonus",
          note: "Luck Points",
        }],
      },
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "proficiency_grant", category: "skill", grants: ["Perception"] }),
      expect.objectContaining({ type: "spell_grant", spellName: "Misty Step", mode: "known" }),
      expect.objectContaining({ type: "ability_score", ability: "cha", amount: 1 }),
      expect.objectContaining({
        // Real canonical `uses[].note` is explanatory prose ("a number of Luck Points equal to
        // your Proficiency Bonus" on the actual f_lucky record), not a title — the resource's
        // label is the feature's own name, matching every other resource in the app.
        type: "resource_grant",
        label: "Lucky",
        max: { kind: "proficiency_bonus", min: undefined },
        reset: "long_rest",
      }),
    ]));
  });

  it("links a fixed feat free-cast pool to its granted spell", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, id: "feat:boon", kind: "feat", name: "Boon of Revelry" },
      featMechanics: {
        grants: { spells: ["Otto's Irresistible Dance"] },
        uses: [{ count: 1, note: "can cast it once without a spell slot", grantsSpell: "Otto's Irresistible Dance" }],
      },
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "resource_grant",
        resourceKey: "feat:boon:use:1",
        label: "Boon of Revelry",
      }),
      expect.objectContaining({
        type: "spell_grant",
        spellName: "Otto's Irresistible Dance",
        mode: "free_cast",
        resourceKey: "feat:boon:use:1",
      }),
    ]));
  });

  it("does not derive an additional effect from prose", () => {
    const parsed = parseFeatureEffects({
      source: { ...source, text: "Your speed increases by 10 feet." },
      text: "Your speed increases by 10 feet.",
      classEffects: [{ type: "speed", mode: "bonus", amount: { kind: "fixed", value: 10 } }],
    });
    expect(parsed.effects.filter((effect) => effect.type === "speed")).toHaveLength(1);
  });

  it("applies Dueling only with one one-handed melee weapon", () => {
    const parsed = parseFeatureEffects({
      source: { ...source, id: "feat:dueling", kind: "feat", name: "Fighting Style: Dueling" },
      text: "",
      featMechanics: {
        grants: {
          effects: [{
            type: "modifier",
            target: "damage_roll",
            mode: "bonus",
            amount: { kind: "fixed", value: 2 },
            gate: { weaponFilters: ["melee_weapon", "no_offhand", "no_two_handed"] },
          }],
        },
      },
    });
    const longsword = {
      name: "Longsword",
      type: "Martial Melee Weapon",
      properties: ["V"],
      dmg1: "1d8",
    };

    expect(deriveAttackDamageBonusFromEffects([parsed], {
      item: longsword,
      isWeapon: true,
      hasOtherWeapon: false,
    })).toBe(2);
    expect(deriveAttackDamageBonusFromEffects([parsed], {
      item: longsword,
      isWeapon: true,
      hasOtherWeapon: true,
    })).toBe(0);

    const legacyParsed = parseFeatureEffects({
      source: { ...source, id: "feat:dueling-old", kind: "feat", name: "Fighting Style: Dueling" },
      text: "When you're holding a Melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
    });
    expect(deriveAttackDamageBonusFromEffects([legacyParsed], {
      item: longsword,
      isWeapon: true,
      hasOtherWeapon: false,
    })).toBe(0);
  });

  it("applies Thrown Weapon Fighting to weapons with the Thrown property", () => {
    const parsed = parseFeatureEffects({
      source: { ...source, id: "feat:thrown", kind: "feat", name: "Fighting Style: Thrown Weapon Fighting" },
      text: "",
      featMechanics: {
        grants: {
          effects: [{
            type: "modifier",
            target: "damage_roll",
            mode: "bonus",
            amount: { kind: "fixed", value: 2 },
            gate: { weaponFilters: ["thrown_weapon"] },
          }],
        },
      },
    });

    expect(deriveAttackDamageBonusFromEffects([parsed], {
      item: {
        name: "Dagger",
        type: "Simple Melee Weapon",
        properties: ["F", "L", "T"],
        dmg1: "1d4",
      },
      isWeapon: true,
    })).toBe(2);
    expect(deriveAttackDamageBonusFromEffects([parsed], {
      item: {
        name: "Longsword",
        type: "Martial Melee Weapon",
        properties: ["V"],
        dmg1: "1d8",
      },
      isWeapon: true,
    })).toBe(0);

    const legacyParsed = parseFeatureEffects({
      source: { ...source, id: "feat:thrown-old", kind: "feat", name: "Fighting Style: Thrown Weapon Fighting" },
      text: "When you hit with a ranged attack roll using a weapon that has the Thrown property, you gain a +2 bonus to the damage roll.",
    });
    expect(deriveAttackDamageBonusFromEffects([legacyParsed], {
      item: {
        name: "Dagger",
        type: "Simple Melee Weapon",
        properties: ["F", "L", "T"],
        dmg1: "1d4",
      },
      isWeapon: true,
    })).toBe(0);
  });

  it("passes a trait's own structured effects through verbatim, with no parsing — no name/prose inference involved", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, id: "race:warforged:integrated_protection", kind: "species", name: "Integrated Protection" },
      traitEffects: [
        { type: "armor_class", mode: "bonus", bonus: { kind: "fixed", value: 1 } },
      ],
    });
    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "armor_class", mode: "bonus", bonus: { kind: "fixed", value: 1 } }),
    ]));
  });

  it("passes a trait's defense effect through with a causeFilter, for immunities scoped to specific causes (e.g. Warforged's Tireless)", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, id: "race:warforged:tireless", kind: "species", name: "Tireless" },
      traitEffects: [
        { type: "defense", mode: "condition_immunity", targets: ["Exhaustion"], causeFilter: ["dehydration", "malnutrition", "suffocation"] },
      ],
    });
    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "defense", mode: "condition_immunity", targets: ["Exhaustion"], causeFilter: ["dehydration", "malnutrition", "suffocation"] }),
    ]));
  });

  it("passes a feat_choice effect through verbatim, for a species trait that grants a feat of the player's choice (e.g. Human's Versatile)", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, id: "race:human:versatile", kind: "species", name: "Versatile" },
      traitEffects: [
        { type: "feat_choice", mode: "learn", count: { kind: "fixed", value: 1 }, category: "origin" },
      ],
    });
    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "feat_choice", mode: "learn", count: { kind: "fixed", value: 1 }, category: "origin" }),
    ]));
  });

  it("passes a rest_rule effect through verbatim, for a species trait that changes rest mechanics (e.g. Warforged's Sentry's Rest)", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, id: "race:warforged:sentrys_rest", kind: "species", name: "Sentry's Rest" },
      traitEffects: [
        { type: "rest_rule", mode: "long_rest_duration", hours: 6 },
        { type: "rest_rule", mode: "no_sleep_required" },
      ],
    });
    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "rest_rule", mode: "long_rest_duration", hours: 6 }),
      expect.objectContaining({ type: "rest_rule", mode: "no_sleep_required" }),
    ]));
  });

  it("passes an any_d20_test modifier through verbatim, for a broad reroll effect (e.g. Halfling Luck)", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, id: "race:halfling:luck", kind: "species", name: "Luck" },
      traitEffects: [
        { type: "modifier", target: "any_d20_test", mode: "reroll" },
      ],
    });
    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "modifier", target: "any_d20_test", mode: "reroll" }),
    ]));
  });

  it("passes requiredLevel through verbatim, for a species trait effect that only activates from a given character level (e.g. Draconic Flight at level 5)", () => {
    const effects = structuredEffectsFromCanonical({
      source: { ...source, id: "race:aasimar:draconic_flight", kind: "species", name: "Draconic Flight" },
      traitEffects: [
        { type: "action", activation: "bonus_action", description: "Grow spectral wings for 10 minutes.", requiredLevel: 5 },
      ],
    });
    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "action", requiredLevel: 5 }),
    ]));
  });
});
