import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/views/character/CharacterInventory";
import { deriveInventoryDisplayState } from "@/views/character/CharacterInventoryDerived";
import { DEFAULT_CONTAINER_ID } from "@/views/character/CharacterInventoryPanelHelpers";

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

describe("deriveInventoryDisplayState", () => {
  it("groups backpack items and normalizes unknown containers", () => {
    const result = deriveInventoryDisplayState({
      items: [
        item({ id: "default", containerId: "missing" }),
        item({ id: "pouch", containerId: "pouch" }),
        item({ id: "worn", equipState: "worn" }),
        item({ id: "coins", name: "GP", quantity: 12 }),
      ],
      containers: [{ id: DEFAULT_CONTAINER_ID, name: "Backpack" }, { id: "pouch", name: "Pouch" }],
      strengthScore: 10,
      selectedItemId: null,
    });

    expect(result.itemsByContainer.get(DEFAULT_CONTAINER_ID)?.map(({ id }) => id)).toEqual(["default"]);
    expect(result.itemsByContainer.get("pouch")?.map(({ id }) => id)).toEqual(["pouch"]);
    expect(result.equipped.map(({ id }) => id)).toEqual(["worn"]);
    expect(result.currencyTotals.GP).toBe(12);
    expect(result.carryCapacity).toBe(150);
  });

  it("excludes the selected item from the other attuned count", () => {
    const result = deriveInventoryDisplayState({
      items: [
        item({ id: "selected", attuned: true }),
        item({ id: "other", attuned: true }),
      ],
      containers: [],
      strengthScore: null,
      selectedItemId: "selected",
    });

    expect(result.selectedItem?.id).toBe("selected");
    expect(result.otherAttunedCount).toBe(1);
    expect(result.overCapacity).toBe(false);
  });
});
