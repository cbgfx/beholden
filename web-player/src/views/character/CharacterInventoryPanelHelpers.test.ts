import { describe, expect, it } from "vitest";
import {
  inferStackKey,
  isStackableItem,
  mergeStackedInventoryItem,
  normalizeContainers,
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
  it("removes only an empty legacy Waterskin container", () => {
    const containers = [
      { id: "waterskin-empty", name: "Waterskin" },
      { id: "waterskin-used", name: "Waterskin" },
    ];
    expect(normalizeContainers(containers, [
      item({ id: "legacy-waterskin", name: "Waterskin", itemId: "i_waterskin", source: "compendium" }),
      item({ id: "stored-item", containerId: "waterskin-used" }),
    ]).map((container) => container.id)).toEqual([
      "backpack-default",
      "waterskin-used",
    ]);
  });

  it("preserves an empty user-created container that merely shares the Waterskin name", () => {
    expect(normalizeContainers([{ id: "manual", name: "Waterskin" }], [item({ name: "Torch" })])).toContainEqual({
      id: "manual",
      name: "Waterskin",
      ignoreWeight: false,
    });
  });

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
