import { describe, expect, it } from "vitest";
import { parseFeatureEffects } from "./parseFeatureEffects";
import {
  canAddAbilityModifierToExtraAttackDamageFromEffects,
  collectSensesFromEffects,
  deriveArmorClassBonusFromEffects,
  deriveAttackDamageDiceOverrideFromEffects,
  deriveAttackRollBonusFromEffects,
} from "./parseFeatureEffectsDerived";

const rangedWeapon = {
  name: "Longbow",
  type: "Martial Ranged Weapon",
  properties: ["A", "H", "2H"],
  dmg1: "1d8",
};
const lightWeapon = {
  name: "Shortsword",
  type: "Martial Melee Weapon",
  properties: ["F", "L"],
  dmg1: "1d6",
};

function parseStyle(name: string, effect: Record<string, unknown>) {
  return parseFeatureEffects({
    source: { id: `style:${name}`, kind: "feat", name },
    text: "",
    featMechanics: {
      grants: {
        effects: [effect],
      },
    },
  });
}

describe("Fighting Style runtime contracts", () => {
  it("applies Archery only to ranged weapon attacks", () => {
    const parsed = parseStyle("Archery", {
      type: "modifier",
      target: "attack_roll",
      mode: "bonus",
      resolution: "automatic",
      amount: { kind: "fixed", value: 2 },
      gate: { weaponFilters: ["ranged_weapon"] },
    });

    expect(deriveAttackRollBonusFromEffects([parsed], { item: rangedWeapon })).toBe(2);
    expect(deriveAttackRollBonusFromEffects([parsed], { item: lightWeapon })).toBe(0);
  });

  it("adds Blind Fighting blindsight", () => {
    const parsed = parseStyle("Blind Fighting", {
      type: "senses",
      mode: "grant",
      resolution: "automatic",
      senses: [{ kind: "blindsight", range: 10 }],
    });

    expect(collectSensesFromEffects([parsed])).toEqual([
      { kind: "blindsight", range: 10 },
    ]);
  });

  it("applies Defense only while armor is equipped", () => {
    const parsed = parseStyle("Defense", {
      type: "armor_class",
      mode: "bonus",
      resolution: "automatic",
      bonus: { kind: "fixed", value: 1 },
      gate: { armorState: "not_unarmored" },
    });

    expect(deriveArmorClassBonusFromEffects([parsed], { armorEquipped: true })).toBe(1);
    expect(deriveArmorClassBonusFromEffects([parsed], { armorEquipped: false })).toBe(0);
  });

  it("adds the ability modifier to Two-Weapon Fighting's Light-weapon extra attack", () => {
    const parsed = parseStyle("Two-Weapon Fighting", {
      type: "attack",
      mode: "add_ability_to_damage",
      resolution: "automatic",
      gate: { weaponFilters: ["light_weapon"], notes: "extra_attack_damage" },
    });

    expect(canAddAbilityModifierToExtraAttackDamageFromEffects([parsed], lightWeapon)).toBe(true);
    expect(canAddAbilityModifierToExtraAttackDamageFromEffects([parsed], rangedWeapon)).toBe(false);
  });

  it("uses Unarmed Fighting's d6 or empty-hands d8 while keeping its grapple rider manual", () => {
    const automatic = {
      type: "attack",
      mode: "damage_die_override",
      resolution: "automatic",
      amount: { kind: "fixed", dice: "1d6" },
      alternateAmount: { kind: "fixed", dice: "1d8" },
      alternateWhen: "no_weapon_or_shield",
      damageType: "bludgeoning",
      gate: { notes: "unarmed_only" },
    };
    const manual = {
      type: "narrative",
      category: "manual_resolution",
      resolution: "manual",
      description: "At the start of your turn, optionally deal 1d4 damage to a creature Grappled by you.",
    };
    const parsed = parseFeatureEffects({
      source: { id: "style:unarmed", kind: "feat", name: "Unarmed Fighting" },
      text: "",
      featMechanics: {
        grants: {
          effects: [automatic, manual],
        },
      },
    });

    expect(deriveAttackDamageDiceOverrideFromEffects([parsed], {
      isUnarmed: true,
      noWeaponOrShield: false,
    })).toBe("1d6");
    expect(deriveAttackDamageDiceOverrideFromEffects([parsed], {
      isUnarmed: true,
      noWeaponOrShield: true,
    })).toBe("1d8");
    expect(parsed.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "narrative",
        category: "manual_resolution",
        resolution: "manual",
      }),
    ]));
  });

  it.each([
    ["Great Weapon Fighting", {
      type: "narrative",
      category: "manual_resolution",
      resolution: "manual",
      description: "Treat a damage-die result of 1 or 2 as 3.",
    }],
    ["Interception", {
      type: "action",
      activation: "reaction",
      resolution: "manual",
      description: "Reduce damage to a nearby creature.",
    }],
    ["Protection", {
      type: "action",
      activation: "reaction",
      resolution: "manual",
      description: "Impose Disadvantage on attacks against a nearby ally.",
    }],
  ])("keeps %s explicitly manual", (name, effect) => {
    const parsed = parseStyle(name, effect);
    expect(parsed.effects).toEqual([
      expect.objectContaining({ resolution: "manual" }),
    ]);
  });
});
