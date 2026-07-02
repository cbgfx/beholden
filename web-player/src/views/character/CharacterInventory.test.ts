import { describe, expect, it } from "vitest";
import {
  getEquipState,
  totalInventoryWeight,
  weaponAbilityMod,
  weaponDamageDice,
  type InventoryItem,
} from "@/views/character/CharacterInventory";

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
  it("uses the explicit V2 equip state", () => {
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

  it("multiplies weight by quantity and ignores extradimensional containers", () => {
    const items = [
      item({ id: "arrows", quantity: 20, weight: 0.05 }),
      item({ id: "ore", quantity: 3, weight: 10, containerId: "bag" }),
    ];
    expect(totalInventoryWeight(items)).toBe(31);
    expect(totalInventoryWeight(items, [{ id: "bag", name: "Bag of Holding", ignoreWeight: true }])).toBe(1);
  });
});
