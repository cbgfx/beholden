import { expect, it } from "vitest";
import {
  fromInventoryTransferPayload,
  hasCustomTransferState,
  toInventoryTransferPayload,
} from "./inventoryTransferPayload";
import type { InventoryItem } from "./CharacterInventoryTypes";

const weapon = (): InventoryItem => ({
  id: "sword-1",
  name: "Longsword",
  quantity: 1,
  equipped: true,
  equipState: "mainhand-1h",
  containerId: "belt",
  attuned: true,
  pactWeapon: true,
  linkedAmmoId: "arrows-9",
  source: "compendium",
  itemId: "longsword",
  notes: "Nicked the guard fighting the owlbear.",
  dmg1: "1d10+2",
  dmgType: "slashing",
  ac: null,
  properties: ["Versatile"],
  chargesMax: 3,
  charges: 1,
  storedSpells: [{ instanceId: "x1", id: "fire-bolt", name: "Fire Bolt", level: 0, slotLevel: 0 }] as InventoryItem["storedSpells"],
});

it("carries every portable field through a stash round trip", () => {
  const payload = toInventoryTransferPayload(weapon());
  const rebuilt = fromInventoryTransferPayload(payload, { name: "Longsword", quantity: 1 }, { id: "new-id", containerId: "backpack" });

  expect(rebuilt.notes).toBe("Nicked the guard fighting the owlbear.");
  expect(rebuilt.dmg1).toBe("1d10+2");
  expect(rebuilt.charges).toBe(1);
  expect(rebuilt.chargesMax).toBe(3);
  expect(rebuilt.storedSpells).toHaveLength(1);
  expect(rebuilt.properties).toEqual(["Versatile"]);
});

it("resets the previous holder's relationship to the item", () => {
  const payload = toInventoryTransferPayload(weapon());
  expect(payload).not.toHaveProperty("equipped");
  expect(payload).not.toHaveProperty("equipState");
  expect(payload).not.toHaveProperty("attuned");
  expect(payload).not.toHaveProperty("pactWeapon");
  expect(payload).not.toHaveProperty("linkedAmmoId");
  expect(payload).not.toHaveProperty("containerId");

  const rebuilt = fromInventoryTransferPayload(payload, { name: "Longsword", quantity: 1 }, { id: "new-id", containerId: "backpack" });
  expect(rebuilt.id).toBe("new-id");
  expect(rebuilt.equipped).toBe(false);
  expect(rebuilt.equipState).toBe("backpack");
  expect(rebuilt.containerId).toBe("backpack");
  expect(rebuilt.attuned).toBeUndefined();
  expect(rebuilt.pactWeapon).toBeUndefined();
  expect(rebuilt.linkedAmmoId).toBeUndefined();
});

it("falls back to the flat summary for a legacy stash row with no payload", () => {
  const rebuilt = fromInventoryTransferPayload(
    null,
    { name: "Torch", quantity: 5, weight: 1, notes: "bundled", type: "gear", source: "compendium", itemId: "torch" },
    { id: "x", containerId: "backpack" },
  );
  expect(rebuilt).toMatchObject({ name: "Torch", quantity: 5, weight: 1, notes: "bundled", type: "gear", itemId: "torch", containerId: "backpack" });
});

it("takes the stash row's live quantity and name over the payload's stale values", () => {
  const rebuilt = fromInventoryTransferPayload(
    { name: "Old Name", quantity: 1, dmg1: "1d6", chargesMax: 3, charges: 1 },
    { name: "DM Renamed", quantity: 7 }, // row topped up + renamed after the deposit
    { id: "x", containerId: "backpack" },
  );
  expect(rebuilt.quantity).toBe(7);
  expect(rebuilt.name).toBe("DM Renamed");
  // Fields with no stash column still come from the payload.
  expect(rebuilt.dmg1).toBe("1d6");
  expect(rebuilt.charges).toBe(1);
});

it("also strips character-specific keys from a hand-crafted/hostile payload", () => {
  const rebuilt = fromInventoryTransferPayload(
    { name: "Amulet", quantity: 1, attuned: true, pactWeapon: true, equipped: true, id: "smuggled" } as Record<string, unknown>,
    { name: "Amulet", quantity: 1 },
    { id: "clean", containerId: "backpack" },
  );
  expect(rebuilt.id).toBe("clean");
  expect(rebuilt.attuned).toBeUndefined();
  expect(rebuilt.pactWeapon).toBeUndefined();
  expect(rebuilt.equipped).toBe(false);
});

it("flags items whose detail must not be merged away", () => {
  expect(hasCustomTransferState({ notes: "  " })).toBe(false);
  expect(hasCustomTransferState({ notes: "keep me" })).toBe(true);
  expect(hasCustomTransferState({ dmg1: "2d6" })).toBe(true);
  expect(hasCustomTransferState({ chargesMax: 3, charges: 3 })).toBe(false);
  expect(hasCustomTransferState({ chargesMax: 3, charges: 1 })).toBe(true);
  expect(hasCustomTransferState({ storedSpells: [{ instanceId: "x2", id: "s", name: "S", level: 1, slotLevel: 1 }] as InventoryItem["storedSpells"] })).toBe(true);
  expect(hasCustomTransferState({})).toBe(false);
});

it("honors explicit clears while preserving absent legacy fields", () => {
  const original = { notes: "old", description: "old", weight: 5, rarity: "rare", type: "gear", itemId: "old" };
  const row = fromInventoryTransferPayload(original, { name: "New", quantity: 1, notes: "", description: "", weight: null, rarity: null, type: null, itemId: null }, { id: "x", containerId: "backpack" });
  expect(row).toMatchObject({ notes: "", description: "", weight: null, rarity: null, type: null, itemId: null });
  expect(fromInventoryTransferPayload(original, { name: "New", quantity: 1 }, { id: "x", containerId: "backpack" }).notes).toBe("old");
});
