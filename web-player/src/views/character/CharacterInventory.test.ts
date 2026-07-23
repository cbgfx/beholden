import { describe, expect, it } from "vitest";
import {
  canEquipOffhand,
  getEquipState,
  getItemSpells,
  fixedItemUsesMaximum,
  initializeItemUsesMaximum,
  mergeCatalogItem,
  recoverItemCharges,
  getWeaponMasteryName,
  hasWeaponProficiency,
  isArmorItem,
  isAmmunitionItem,
  isCompatibleAmmunition,
  isShieldItem,
  isWeaponItem,
  isWearableItem,
  totalInventoryWeight,
  weaponAbilityMod,
  weaponAttackModifierBonus,
  weaponDamageDice,
  weaponDamageModifierBonus,
  type InventoryItem,
  type ItemSummaryRow,
} from "@/views/character/CharacterInventory";

function summary(overrides: Partial<ItemSummaryRow>): ItemSummaryRow {
  return {
    id: "i_item", name: "Item", rarity: "common", type: "Wondrous", typeKey: "wondrous",
    attunement: false, magic: false,
    ...overrides,
  };
}

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: "item",
    name: "Item",
    quantity: 1,
    equipped: false,
    equipState: "backpack",
    ...overrides,
  };
}

describe("character inventory calculations", () => {
  it("uses the explicit Grand equip state", () => {
    expect(getEquipState(item({ equipState: "worn", equipped: true, type: "Heavy Armor" }))).toBe("worn");
    expect(getEquipState(item({
      equipState: "mainhand-2h",
      equipped: true,
      type: "Martial Melee Weapon",
      dmg1: "2d6",
      properties: ["2H"],
    }))).toBe("mainhand-2h");
    expect(getEquipState(item({ equipState: undefined, equipped: true }))).toBe("backpack");
  });

  it("uses the correct ability modifier for finesse and ranged weapons", () => {
    const character = { strScore: 12, dexScore: 18 };
    expect(weaponAbilityMod(item({ dmg1: "1d8", properties: ["F"] }), character)).toBe(4);
    expect(weaponAbilityMod(item({ dmg1: "1d8", type: "Martial Ranged Weapon" }), character)).toBe(4);
    expect(weaponAbilityMod(item({ dmg1: "1d8", type: "Martial Melee Weapon" }), character)).toBe(1);
  });

  it("uses versatile damage in two hands", () => {
    const weapon = item({ dmg1: "1d8", dmg2: "1d10", type: "Martial Melee Weapon" });
    expect(weaponDamageDice(weapon, "mainhand-1h")).toBe("1d8");
    expect(weaponDamageDice(weapon, "mainhand-2h")).toBe("1d10");
  });

  it("reads weapon mastery only from the canonical item fact", () => {
    expect(getWeaponMasteryName(item({ name: "Club", description: "Nick (Mastery): prose", mastery: "Slow" }))).toBe("Slow");
    expect(getWeaponMasteryName(item({ name: "Longsword", description: "Sap (Mastery): prose" }))).toBeNull();
  });

  it("classifies equipment only from canonical mechanical facts", () => {
    expect(isWeaponItem(item({ name: "Definitely a Sword", type: "Wondrous" }))).toBe(false);
    expect(isWeaponItem(item({ name: "Unlabeled", dmg1: "1d8" }))).toBe(true);
    expect(isArmorItem(item({ name: "Armor-shaped Trinket", type: "Wondrous", ac: 18 }))).toBe(false);
    expect(isArmorItem(item({ type: "Medium Armor", ac: 14 }))).toBe(true);
    expect(isShieldItem(item({ name: "Shield of Words", type: "Wondrous" }))).toBe(false);
    expect(isShieldItem(item({ type: "Shield", ac: 2 }))).toBe(true);
    expect(isWearableItem(item({ name: "Fancy Hat", type: "Wondrous" }))).toBe(false);
    expect(isWearableItem(item({ name: "Nameless Relic", type: "Wondrous", equippable: true }))).toBe(true);
  });

  it("matches a magic weapon through its canonical base proficiency", () => {
    const magicLongsword = item({ name: "Sword of Kas", dmg1: "1d8", properties: ["M", "V"], proficiency: "martial, longsword" });
    expect(hasWeaponProficiency(magicLongsword, { weapons: [{ name: "Longsword", source: "Class" }], armor: [] })).toBe(true);
    expect(hasWeaponProficiency(magicLongsword, { weapons: [{ name: "Rapier", source: "Class" }], armor: [] })).toBe(false);
  });

  it("applies typed filtered weapon proficiency without reading its label", () => {
    const training = { weapons: [{
      name: "Display text only",
      source: "Training in War and Song",
      weaponFilter: { melee: true as const, martial: true as const, excludeProperties: ["heavy", "two_handed"] as Array<"heavy" | "two_handed"> },
    }], armor: [] };
    expect(hasWeaponProficiency(item({ type: "Martial Melee Weapon", dmg1: "1d8", properties: ["M", "F"] }), training)).toBe(true);
    expect(hasWeaponProficiency(item({ type: "Martial Melee Weapon", dmg1: "2d6", properties: ["M", "H", "2H"] }), training)).toBe(false);
    expect(hasWeaponProficiency(item({ type: "Martial Ranged Weapon", dmg1: "1d8", properties: ["M", "A"] }), training)).toBe(false);
  });

  it("matches ammunition only through the canonical family", () => {
    const bow = item({ dmg1: "1d8", weaponAmmo: "arrow" });
    const arrow = item({ name: "Nameless ammunition", ammo: "arrow" });
    const bolt = item({ name: "Arrow-shaped bolt", ammo: "bolt" });
    expect(isAmmunitionItem(item({ name: "Arrow", type: "Adventuring Gear" }))).toBe(false);
    expect(isAmmunitionItem(arrow)).toBe(true);
    expect(isCompatibleAmmunition(bow, arrow)).toBe(true);
    expect(isCompatibleAmmunition(bow, bolt)).toBe(false);
  });

  it("initializes charge tracking only from a fixed canonical use maximum", () => {
    expect(fixedItemUsesMaximum(7)).toBe(7);
    expect(fixedItemUsesMaximum({ max: 10, recover: "1d6+4" })).toBe(10);
    expect(fixedItemUsesMaximum({ max: "1d8+1", recover: false })).toBeNull();
    expect(fixedItemUsesMaximum(undefined)).toBeNull();
  });

  it("rolls initial variable pools and applies canonical long-rest recovery", () => {
    expect(initializeItemUsesMaximum({ max: "1d8+1", recover: false }, () => 6)).toBe(6);

    const partial = item({ uses: { max: 7, recover: "1d6+1" }, chargesMax: 7, charges: 2 });
    expect(recoverItemCharges(partial, () => 4).charges).toBe(6);
    expect(recoverItemCharges({ ...partial, charges: 6 }, () => 4).charges).toBe(7);

    const permanent = item({ uses: { max: 3, recover: false }, chargesMax: 3, charges: 1 });
    expect(recoverItemCharges(permanent, () => 99).charges).toBe(1);

    const defaultFull = item({ uses: 4, chargesMax: 4, charges: 1 });
    expect(recoverItemCharges(defaultFull, () => 0).charges).toBe(4);
  });

  it("reads item-granted spells only from canonical spell IDs", () => {
    expect(getItemSpells({
      s_magic_missile: 1,
      s_fireball: { cost: 5, level: 5 },
      s_cure_wounds: { cost: "level", maxLevel: 4 },
    })).toEqual([
      { id: "s_magic_missile", cost: 1 },
      { id: "s_fireball", cost: 5, level: 5 },
      { id: "s_cure_wounds", cost: "level", maxLevel: 4 },
    ]);
    expect(getItemSpells(undefined)).toEqual([]);
  });

  it("multiplies weight by quantity and ignores extradimensional containers", () => {
    const items = [
      item({ id: "arrows", quantity: 20, weight: 0.05 }),
      item({ id: "ore", quantity: 3, weight: 10, containerId: "bag" }),
    ];
    expect(totalInventoryWeight(items)).toBe(31);
    expect(totalInventoryWeight(items, [{ id: "bag", name: "Bag of Holding", ignoreWeight: true }])).toBe(1);
  });

  it("reads a magic weapon's attack/damage bonus from compendium modifiers, not its name", () => {
    // Returning Dagger: generic "weapon attacks"/"weapon damage" modifiers (applies whether the
    // weapon is used melee or thrown).
    const returningDagger = item({
      modifiers: [{ target: "weapon_attacks", amount: 1 }, { target: "weapon_damage", amount: 1 }],
    });
    expect(weaponAttackModifierBonus(returningDagger, false)).toBe(1);
    expect(weaponDamageModifierBonus(returningDagger, false)).toBe(1);

    // Longbow +1: ranged-specific modifiers only — must not apply to a melee weapon.
    const longbowPlus1 = item({
      modifiers: [{ target: "ranged_attacks", amount: 1 }, { target: "ranged_damage", amount: 1 }],
    });
    expect(weaponAttackModifierBonus(longbowPlus1, true)).toBe(1);
    expect(weaponDamageModifierBonus(longbowPlus1, true)).toBe(1);
    expect(weaponAttackModifierBonus(longbowPlus1, false)).toBe(0);

    // A mundane weapon with no modifiers at all contributes nothing.
    const mundane = item({});
    expect(weaponAttackModifierBonus(mundane, false)).toBe(0);
    expect(weaponDamageModifierBonus(mundane, false)).toBe(0);
  });
});

describe("mergeCatalogItem", () => {
  it("overwrites a stale stored value with the current catalog fact for a catalog-linked item", () => {
    // Reproduces the real bug: a Longbow +1 saved before the item's typed-modifiers migration
    // landed had `modifiers: undefined` frozen on the character forever — the old healing effect
    // only filled in *missing* fields, so a catalog fix never reached an already-saved item.
    const longbowPlus1 = item({ itemId: "i_longbow_plus_1", source: "compendium", modifiers: undefined, ac: null });
    const catalog = summary({
      id: "i_longbow_plus_1", name: "Longbow +1", type: "Ranged Weapon", rarity: "uncommon", magic: true,
      modifiers: [{ target: "ranged_attacks", amount: 1 }, { target: "ranged_damage", amount: 1 }],
    });
    const merged = mergeCatalogItem(longbowPlus1, catalog, null);
    expect(merged.modifiers).toEqual([{ target: "ranged_attacks", amount: 1 }, { target: "ranged_damage", amount: 1 }]);
    expect(merged.rarity).toBe("uncommon");
  });

  it("preserves player-owned state (quantity, equip state, id) across a catalog refresh", () => {
    const dagger = item({
      id: "instance-1", itemId: "i_dagger", source: "compendium", quantity: 3,
      equipped: true, equipState: "mainhand-1h", containerId: "pack-1",
    });
    const catalog = summary({ id: "i_dagger", name: "Dagger", type: "Simple Melee Weapon", dmg1: "1d4" });
    const merged = mergeCatalogItem(dagger, catalog, null);
    expect(merged.id).toBe("instance-1");
    expect(merged.quantity).toBe(3);
    expect(merged.equipped).toBe(true);
    expect(merged.equipState).toBe("mainhand-1h");
    expect(merged.containerId).toBe("pack-1");
    expect(merged.dmg1).toBe("1d4");
  });

  it("only permits Light melee weapons offhand unless a feature grants the exception", () => {
    const lightMelee = item({ dmg1: "1d6", type: "Martial Melee Weapon", properties: ["L"] });
    const longsword = item({ dmg1: "1d8", type: "Martial Melee Weapon", properties: ["V"] });
    const dualWielder = {
      source: { id: "dual-wielder", kind: "feat" as const, name: "Dual Wielder" },
      effects: [{
        id: "dual-wielder:0",
        source: { id: "dual-wielder", kind: "feat" as const, name: "Dual Wielder" },
        type: "attack" as const,
        mode: "triggered_attack" as const,
        gate: { weaponFilters: ["melee_weapon" as const, "no_two_handed" as const] },
      }],
      choices: [],
      uses: [],
      resources: [],
      sourceModifiers: [],
    };

    expect(canEquipOffhand(lightMelee, [])).toBe(true);
    expect(canEquipOffhand(longsword, [])).toBe(false);
    expect(canEquipOffhand(longsword, [dualWielder])).toBe(true);
  });

  it("hydrates Staff of Defense spells and its live 10-charge maximum onto a stale copy", () => {
    const staff = item({
      itemId: "i_staff_of_defense",
      source: "compendium",
      description: "The existing player-owned description is already populated.",
      uses: null,
      spells: null,
      chargesMax: null,
      charges: null,
    });
    const catalog = summary({
      id: "i_staff_of_defense",
      name: "Staff of Defense",
      uses: { max: 10, recover: "1d6+4" },
      spells: { s_mage_armor: 1, s_shield: 2 },
    });

    const merged = mergeCatalogItem(staff, catalog, initializeItemUsesMaximum(catalog.uses));
    expect(merged.uses).toEqual(catalog.uses);
    expect(merged.spells).toEqual({ s_mage_armor: 1, s_shield: 2 });
    expect(merged.chargesMax).toBe(10);
    expect(merged.charges).toBe(10);
  });

  it("never overwrites a true custom item's data even if its name happens to match a catalog row", () => {
    const custom = item({ source: "custom", ac: 15, description: "A DM-crafted relic." });
    const catalog = summary({ id: "i_relic", name: "Item", ac: 12 });
    const merged = mergeCatalogItem(custom, catalog, null);
    expect(merged.source).toBe("custom");
    expect(merged.ac).toBe(15);
    expect(merged.description).toBe("A DM-crafted relic.");
  });
});
