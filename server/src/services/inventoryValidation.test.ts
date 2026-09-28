import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inventoryValidationProblem } from "./inventoryValidation.js";

const item = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, quantity: 1, ...extra });

describe("inventoryValidationProblem", () => {
  it("accepts a valid inventory with containers, equipment, charges, ammo and three attunements", () => {
    assert.equal(inventoryValidationProblem({
      inventoryContainers: [{ id: "pack", name: "Backpack" }],
      inventory: [
        item("bow", { equipState: "mainhand-2h", weaponAmmo: "arrow", linkedAmmoId: "arrows", charges: 2, chargesMax: 3 }),
        item("arrows", { ammo: "arrow", containerId: "pack" }),
        item("ring-1", { equipState: "worn", attuned: true }),
        item("ring-2", { equipState: "worn", attuned: true }),
        item("ring-3", { equipState: "worn", attuned: true }),
      ],
    }), null);
  });

  it("rejects duplicate ids and dangling container or ammunition references", () => {
    for (const data of [
      { inventory: [item("same"), item("same")] },
      { inventoryContainers: [{ id: "same", name: "One" }, { id: "same", name: "Two" }] },
      { inventory: [item("rope", { containerId: "missing" })], inventoryContainers: [] },
      { inventory: [item("bow", { linkedAmmoId: "missing" })] },
      { inventory: [item("bow", { weaponAmmo: "arrow", linkedAmmoId: "bolts" }), item("bolts", { ammo: "bolt" })] },
    ]) assert.equal(inventoryValidationProblem(data)?.code, "invalid-inventory");
  });

  it("rejects invalid quantities, charges, hand use and excess attunement", () => {
    for (const data of [
      { inventory: [item("rope", { quantity: 0 })] },
      { inventory: [item("wand", { charges: 4, chargesMax: 3 })] },
      { inventory: [item("greatsword", { equipState: "mainhand-2h" }), item("shield", { equipState: "offhand" })] },
      { inventory: [1, 2, 3, 4].map((n) => item(`ring-${n}`, { attuned: true })) },
    ]) assert.equal(inventoryValidationProblem(data)?.code, "invalid-inventory");
  });
});
