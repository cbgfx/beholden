import { describe, expect, it } from "vitest";
import { parseFeatureEffects } from "./parseFeatureEffects";
import { deriveAttackDamageBonusFromEffects } from "./parseFeatureEffectsDerived";
import { structuredEffectsFromCanonical } from "./structuredFeatureEffects";

const source = {
  id: "class:test",
  kind: "class" as const,
  name: "Test Feature",
  text: "",
};

describe("structured canonical feature effects", () => {
  it("maps class modifiers and proficiency grants without feature prose", () => {
    const effects = structuredEffectsFromCanonical({
      source,
      classEffects: [
        { kind: "source_modifier", category: "bonus", value: "speed +10" },
        { kind: "source_modifier", category: "ability score", value: "strength +4" },
        { kind: "source_proficiency", value: "Wisdom, Perception" },
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
          recharge: "long_rest",
          note: "Luck Points",
        }],
      },
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "proficiency_grant", category: "skill", grants: ["Perception"] }),
      expect.objectContaining({ type: "spell_grant", spellName: "Misty Step", mode: "known" }),
      expect.objectContaining({ type: "ability_score", ability: "cha", amount: 1 }),
      expect.objectContaining({
        type: "resource_grant",
        label: "Luck Points",
        max: { kind: "proficiency_bonus", min: undefined },
        reset: "long_rest",
      }),
    ]));
  });

  it("does not duplicate an effect type already understood from richer prose", () => {
    const parsed = parseFeatureEffects({
      source: { ...source, text: "Your speed increases by 10 feet." },
      text: "Your speed increases by 10 feet.",
      classEffects: [{ kind: "source_modifier", category: "bonus", value: "speed +10" }],
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
    })).toBe(2);
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
    })).toBe(2);
  });
});
