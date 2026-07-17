import { describe, expect, it } from "vitest";
import {
  inferStackKey,
  isStackableItem,
  mergeStackedInventoryItem,
} from "@/views/character/CharacterInventoryPanelHelpers";
import type { InventoryItem } from "@/views/character/CharacterInventory";

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

describe("inventory add-item helpers", () => {
  it("stacks ordinary supplies but not weapons or armor", () => {
    expect(isStackableItem(item({ name: "Potion of Healing", type: "Potion" }))).toBe(true);
    expect(isStackableItem(item({ name: "Dagger", type: "Melee Weapon", dmg1: "1d4" }))).toBe(false);
    expect(isStackableItem(item({ name: "Leather Armor", type: "Light Armor", ac: 11 }))).toBe(false);
  });

  it("uses compendium identity when stacking and preserves existing metadata", () => {
    const existing = item({
      id: "existing",
      name: "Potion of Healing",
      itemId: "potion-healing",
      quantity: 2,
      description: "Existing description",
    });
    const incoming = item({
      id: "incoming",
      name: "Potion of Healing [2024]",
      itemId: "potion-healing",
      quantity: 3,
      rarity: "common",
    });

    expect(inferStackKey(existing)).toBe(inferStackKey(incoming));
    expect(mergeStackedInventoryItem(existing, incoming)).toMatchObject({
      id: "existing",
      quantity: 5,
      rarity: "common",
      description: "Existing description",
    });
  });
});
