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
} from "@/views/character/CharacterInventory";
import {
  DEFAULT_CONTAINER_ID,
  inferStackKey,
  isStackableItem,
  mergeStackedInventoryItem,
  uid,
} from "@/views/character/CharacterInventoryPanelHelpers";
import type { PartyStashItem } from "@/views/character/CharacterInventoryPanelRows";
import type { CharacterInventorySyncState } from "@/views/character/useCharacterInventorySync";
import type { CharacterInventoryContainerActions } from "@/views/character/useCharacterInventoryContainers";

export function useCharacterInventoryItems({
  sync,
  containers,
  campaignId,
  parsedFeatureEffects,
}: {
  sync: CharacterInventorySyncState;
  containers: CharacterInventoryContainerActions;
  campaignId?: string | null;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
}) {
  const { items } = sync;
  const takeFromPartyStash = async (stashItem: PartyStashItem) => {
    if (!campaignId) return;
    const incoming: InventoryItem = {
      id: uid(), name: stashItem.name, quantity: stashItem.quantity,
      equipped: false, equipState: "backpack",
      source: (stashItem.source ?? "custom") as "compendium" | "custom",
      itemId: stashItem.itemId ?? undefined, rarity: stashItem.rarity ?? null,
      type: stashItem.type ?? null, weight: stashItem.weight ?? null,
      description: stashItem.description ?? undefined, containerId: DEFAULT_CONTAINER_ID,
    };
    const stackIndex = isStackableItem(incoming)
      ? items.findIndex((item) => isStackableItem(item) && inferStackKey(item) === inferStackKey(incoming))
      : -1;
    const updatedItems = stackIndex >= 0
      ? items.map((item, i) => i === stackIndex ? mergeStackedInventoryItem(item, incoming) : item)
      : [...items, incoming];
    await containers.persist(updatedItems);
    await api(`/api/campaigns/${campaignId}/party-inventory/${stashItem.id}`, { method: "DELETE" });
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
  const removeItem = (id: string) => containers.persist(items.filter((item) => item.id !== id));
  const changeQty = (id: string, delta: number) => containers.persist(items.map((item) =>
    item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
  ));
  const toggleExpandedItem = (id: string) => {
    sync.setExpandedItemId((current) => current === id ? null : id);
    sync.setItemEditMode(false);
  };
  const saveItemEdits = (id: string, patch: Partial<InventoryItem>) =>
    containers.persist(items.map((item) => item.id === id ? { ...item, ...patch } : item));
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
    if (subset.length < 2 || ids.length !== subset.length || ids.some((id) => !validIds.has(id))) return;
    const byId = new Map(subset.map((item) => [item.id, item]));
    let index = 0;
    await containers.persist(items.map((item) => predicate(item) ? byId.get(ids[index++]) ?? item : item));
  };

  return {
    takeFromPartyStash, changePartyStashQty, deleteFromPartyStash, toggleContainerCollapsed,
    cycleMainHand, toggleOffhand, toggleWorn, removeItem, changeQty, toggleExpandedItem,
    saveItemEdits, saveCurrencyAmount, reorderItemsByIds,
  };
}
