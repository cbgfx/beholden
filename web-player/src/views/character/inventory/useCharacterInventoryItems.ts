import { api } from "@/services/api";
import { updatePartyInventoryQuantity } from "@/services/inventoryApi";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import {
  canEquipOffhand,
  canUseTwoHands,
  getEquipState,
  isArmorItem,
  isWeaponItem,
  requiresTwoHands,
  type EquipState,
  type InventoryItem,
} from "@/views/character/inventory/CharacterInventory";
import {
  DEFAULT_CONTAINER_ID,
  inferStackKey,
  isStackableItem,
  mergeStackedInventoryItem,
  uid,
} from "@/views/character/inventory/CharacterInventoryPanelHelpers";
import { fromInventoryTransferPayload, hasCustomTransferState } from "@/views/character/inventory/inventoryTransferPayload";
import type { PartyStashItem } from "@/views/character/inventory/CharacterInventoryPanelRows";
import type { CharacterInventorySyncState } from "@/views/character/inventory/useCharacterInventorySync";
import type { CharacterInventoryContainerActions } from "@/views/character/inventory/useCharacterInventoryContainers";

export function useCharacterInventoryItems({
  sync,
  containers,
  campaignId,
  characterId,
  parsedFeatureEffects,
}: {
  sync: CharacterInventorySyncState;
  containers: CharacterInventoryContainerActions;
  campaignId?: string | null;
  characterId?: string | null;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
}) {
  const { items } = sync;
  const takeFromPartyStash = async (stashItem: PartyStashItem) => {
    if (!campaignId || !characterId) return;
    // Reconstruct the full item from the transfer payload (edited stats, part-used
    // charges, stored spells, notes). Legacy/plain rows fall back to the flat
    // summary; character-specific state is always reset.
    const incoming = fromInventoryTransferPayload(
      stashItem.payload,
      {
        name: stashItem.name,
        quantity: stashItem.quantity,
        weight: stashItem.weight,
        notes: stashItem.notes,
        rarity: stashItem.rarity,
        type: stashItem.type,
        description: stashItem.description,
        source: stashItem.source,
        itemId: stashItem.itemId,
      },
      { id: uid(), containerId: DEFAULT_CONTAINER_ID },
    );
    // Never merge a distinctly-annotated/customized withdrawal into an existing
    // stack; keep it as its own row so nothing is lost.
    const stackIndex = isStackableItem(incoming) && !hasCustomTransferState(incoming)
      ? items.findIndex((item) =>
          isStackableItem(item)
          && !hasCustomTransferState(item)
          && inferStackKey(item) === inferStackKey(incoming))
      : -1;
    const updatedItems = stackIndex >= 0
      ? items.map((item, i) => i === stackIndex ? mergeStackedInventoryItem(item, incoming) : item)
      : [...items, incoming];
    // Adding the item to the sheet and clearing the stash row are one atomic
    // server transaction — a failed request leaves the item in the stash
    // rather than duplicating it onto the character.
    await containers.transferItem(updatedItems, { action: "delete", itemId: stashItem.id, expectedStashRev: stashItem.revision, expectedQuantity: stashItem.quantity });
  };
  const changePartyStashQty = async (id: string, quantity: number) => {
    if (campaignId) await updatePartyInventoryQuantity(campaignId, id, quantity);
  };
  const deleteFromPartyStash = async (id: string) => {
    if (campaignId) await api(`/api/campaigns/${campaignId}/party-inventory/${id}`, { method: "DELETE" });
  };
  const toggleContainerCollapsed = (containerId: string) => {
    sync.setCollapsedContainerIds((previous) =>
      previous.includes(containerId)
        ? previous.filter((id) => id !== containerId)
        : [...previous, containerId]
    );
  };

  const setEquipStateFor = async (id: string, state: EquipState) => {
    const target = items.find((item) => item.id === id);
    const targetIsArmor = Boolean(target && isArmorItem(target));
    await containers.persist(items.map((item) => {
      if (item.id === id) return { ...item, equipped: state !== "backpack", equipState: state };
      const current = getEquipState(item);
      if (state === "offhand" && current === "mainhand-2h") {
        return canUseTwoHands(item) && !requiresTwoHands(item)
          ? { ...item, equipped: true, equipState: "mainhand-1h" as const }
          : { ...item, equipped: false, equipState: "backpack" as const };
      }
      if (state === "mainhand-2h" && current === "offhand") {
        return { ...item, equipped: false, equipState: "backpack" as const };
      }
      if (state.startsWith("mainhand") && current.startsWith("mainhand")) {
        return { ...item, equipped: false, equipState: "backpack" as const };
      }
      if (state === "offhand" && current === "offhand") {
        return { ...item, equipped: false, equipState: "backpack" as const };
      }
      if (state === "worn" && targetIsArmor && current === "worn" && isArmorItem(item)) {
        return { ...item, equipped: false, equipState: "backpack" as const };
      }
      return { ...item, equipped: current !== "backpack", equipState: current };
    }));
  };
  const cycleMainHand = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item || !isWeaponItem(item)) return;
    const state = getEquipState(item);
    if (state === "backpack" || state === "offhand") {
      await setEquipStateFor(id, requiresTwoHands(item) || (!item.dmg1 && item.dmg2) ? "mainhand-2h" : "mainhand-1h");
    } else if (state === "mainhand-1h" && canUseTwoHands(item) && !requiresTwoHands(item)) {
      await setEquipStateFor(id, "mainhand-2h");
    } else {
      await setEquipStateFor(id, "backpack");
    }
  };
  const toggleOffhand = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (item && canEquipOffhand(item, parsedFeatureEffects)) {
      await setEquipStateFor(id, getEquipState(item) === "offhand" ? "backpack" : "offhand");
    }
  };
  const toggleWorn = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (item) await setEquipStateFor(id, getEquipState(item) === "worn" ? "backpack" : "worn");
  };
  const linkAmmo = (weaponId: string, ammoId: string | null) =>
    containers.persist(items.map((item) => {
      if (item.id !== weaponId) return item;
      const ammo = ammoId ? items.find((candidate) => candidate.id === ammoId) : null;
      return { ...item, linkedAmmoId: ammo && item.weaponAmmo === ammo.ammo ? ammoId : null };
    }));
  const removeItem = (id: string) => containers.persist(items.filter((item) => item.id !== id));
  const changeQty = (id: string, delta: number) => containers.persist(items.map((item) =>
    item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
  ));
  const toggleExpandedItem = (id: string) => {
    sync.setExpandedItemId((current) => current === id ? null : id);
    sync.setItemEditMode(false);
  };
  const saveItemEdits = (id: string, patch: Partial<InventoryItem>) =>
    containers.persist(items.map((item) => {
      if (item.id === id) return { ...item, ...patch };
      return patch.pactWeapon ? { ...item, pactWeapon: false } : item;
    }));
  const saveCurrencyAmount = async (code: "PP" | "GP" | "SP" | "CP", amount: number) => {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    const existing = items.find((item) => String(item.name ?? "").trim().toUpperCase() === code);
    const updated = existing
      ? value > 0
        ? items.map((item) => item.id === existing.id ? { ...item, quantity: value } : item)
        : items.filter((item) => item.id !== existing.id)
      : value > 0
        ? [...items, { id: uid(), name: code, quantity: value, equipped: false, equipState: "backpack" as const, source: "custom" as const }]
        : items;
    await containers.persist(updated);
  };
  const reorderItemsByIds = async (ids: string[], predicate: (item: InventoryItem) => boolean) => {
    const subset = items.filter(predicate);
    const validIds = new Set(subset.map((item) => item.id));
    if (subset.length < 2 || ids.length !== subset.length || new Set(ids).size !== ids.length || ids.some((id) => !validIds.has(id))) return;
    if (subset.every((item, index) => item.id === ids[index])) return;
    const byId = new Map(subset.map((item) => [item.id, item]));
    let index = 0;
    await containers.persist(items.map((item) => predicate(item) ? byId.get(ids[index++]) ?? item : item));
  };

  return {
    takeFromPartyStash, changePartyStashQty, deleteFromPartyStash, toggleContainerCollapsed,
    cycleMainHand, toggleOffhand, toggleWorn, linkAmmo, removeItem, changeQty, toggleExpandedItem,
    saveItemEdits, saveCurrencyAmount, reorderItemsByIds,
  };
}
