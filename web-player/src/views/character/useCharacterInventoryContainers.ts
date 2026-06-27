import {
  createPartyInventoryItem,
  updatePartyInventoryQuantity,
} from "@/services/inventoryApi";
import {
  inferStackKey,
  isStackableItem,
  mergeStackedInventoryItem,
  normalizeContainers,
  parsePackContentsFromDescription,
  uid,
  DEFAULT_CONTAINER_ID,
  PARTY_STASH_CONTAINER_ID,
} from "@/views/character/CharacterInventoryPanelHelpers";
import {
  parseChargesMax,
  type InventoryContainer,
  type InventoryItem,
  type InventoryPickerPayload,
} from "@/views/character/CharacterInventory";
import type { InventoryPersistencePayload, CharacterInventorySyncState } from "@/views/character/useCharacterInventorySync";

export function useCharacterInventoryContainers({
  sync,
  campaignId,
  onSave,
}: {
  sync: CharacterInventorySyncState;
  campaignId?: string | null;
  onSave: (data: InventoryPersistencePayload) => Promise<unknown>;
}) {
  const { items, containers, partyStashItems } = sync;
  const persist = async (
    updatedItems: InventoryItem[],
    updatedContainers: InventoryContainer[] = containers,
  ) => {
    sync.setSaving(true);
    try {
      const normalized = normalizeContainers(updatedContainers);
      await onSave({ inventory: updatedItems, inventoryContainers: normalized });
      sync.setItems(updatedItems);
      sync.setContainers(normalized);
    } finally {
      sync.setSaving(false);
    }
  };
  const createContainer = (name = "Backpack", ignoreWeight = false): InventoryContainer => ({
    id: uid(),
    name,
    ignoreWeight,
  });

  const addItem = async (payload?: InventoryPickerPayload) => {
    try {
      if (!payload?.name) return;
      const packEntries = parsePackContentsFromDescription(payload.description ?? "");
      if (packEntries.length > 0) {
        let nextContainers = containers;
        const nextItems = [...items];
        for (let index = 0; index < Math.max(1, Number(payload.quantity) || 1); index += 1) {
          const packContainer = createContainer(payload.name);
          nextContainers = [...nextContainers, packContainer];
          for (const entry of packEntries) {
            nextItems.push({
              id: uid(),
              name: entry.name,
              quantity: entry.quantity,
              equipped: false,
              equipState: "backpack",
              source: "compendium",
              containerId: packContainer.id,
              properties: [],
            });
          }
        }
        await persist(nextItems, nextContainers);
        sync.setPickerOpen(false);
        return;
      }
      const description = payload.description?.trim() ?? "";
      const chargesMax = description ? parseChargesMax(description) ?? null : null;
      const item: InventoryItem = {
        id: uid(),
        name: payload.name,
        quantity: Math.max(1, payload.quantity),
        equipped: false,
        equipState: "backpack",
        source: payload.source,
        itemId: payload.itemId,
        rarity: payload.rarity ?? null,
        type: payload.type ?? null,
        attunement: payload.attunement ?? false,
        attuned: payload.attuned ?? false,
        magic: payload.magic ?? false,
        silvered: payload.silvered ?? false,
        equippable: payload.equippable ?? false,
        weight: payload.weight ?? null,
        value: payload.value ?? null,
        proficiency: payload.proficiency ?? null,
        ac: payload.ac ?? null,
        stealthDisadvantage: payload.stealthDisadvantage ?? false,
        dmg1: payload.dmg1 ?? null,
        dmg2: payload.dmg2 ?? null,
        dmgType: payload.dmgType ?? null,
        properties: payload.properties ?? [],
        description: description || undefined,
        chargesMax,
        charges: chargesMax,
      };
      let nextContainers = containers;
      if (/^bag of holding\b/i.test(payload.name)) {
        nextContainers = [...containers, createContainer("Bag of Holding", true)];
      }
      try {
        if (isStackableItem(item)) {
          const key = inferStackKey(item);
          const existingIndex = items.findIndex((entry) => isStackableItem(entry) && inferStackKey(entry) === key);
          if (existingIndex >= 0) {
            await persist(items.map((entry, index) =>
              index === existingIndex ? mergeStackedInventoryItem(entry, item) : entry
            ), nextContainers);
            sync.setPickerOpen(false);
            return;
          }
        }
      } catch (error) {
        console.error("Inventory stack merge failed; falling back to direct add.", error);
      }
      await persist([...items, item], nextContainers);
      sync.setPickerOpen(false);
    } catch (error) {
      console.error("Failed to add inventory item.", error);
    }
  };

  const addContainer = async (afterId?: string | null, name = "Backpack", ignoreWeight = false) => {
    const container = createContainer(name, ignoreWeight);
    const insertionIndex = afterId ? containers.findIndex((entry) => entry.id === afterId) : containers.length - 1;
    const next = [...containers];
    next.splice(insertionIndex + 1, 0, container);
    await persist(items, next);
  };
  const renameContainer = (id: string, name: string) => persist(items, containers.map((container) =>
    container.id === id
      ? { ...container, name: name.trim() || (id === DEFAULT_CONTAINER_ID ? "Backpack" : "Container") }
      : container
  ));
  const toggleContainerIgnoreWeight = (id: string) => persist(items, containers.map((container) =>
    container.id === id ? { ...container, ignoreWeight: !container.ignoreWeight } : container
  ));
  const removeContainer = async (id: string) => {
    if (id === DEFAULT_CONTAINER_ID) return;
    await persist(
      items.map((item) => item.containerId === id ? { ...item, containerId: DEFAULT_CONTAINER_ID } : item),
      containers.filter((container) => container.id !== id),
    );
  };

  const moveItemToContainer = async (id: string, containerId: string | null) => {
    if (containerId === PARTY_STASH_CONTAINER_ID && campaignId) {
      const item = items.find((entry) => entry.id === id);
      if (!item) return;
      const existing = partyStashItems.find((stash) => {
        const stashItem: InventoryItem = {
          id: stash.id, name: stash.name, quantity: Math.max(1, stash.quantity),
          equipped: false, equipState: "backpack",
          source: (stash.source ?? "custom") as "compendium" | "custom",
          itemId: stash.itemId ?? undefined, type: stash.type ?? null,
          rarity: stash.rarity ?? null, weight: stash.weight ?? null,
          description: stash.description ?? undefined,
        };
        return isStackableItem(item) && isStackableItem(stashItem)
          && inferStackKey(stashItem) === inferStackKey(item);
      });
      if (existing) {
        await updatePartyInventoryQuantity(campaignId, existing.id, existing.quantity + Math.max(1, item.quantity));
      } else {
        await createPartyInventoryItem(campaignId, {
          name: item.name, quantity: item.quantity, weight: item.weight ?? null,
          notes: item.notes ?? "", rarity: item.rarity ?? null, type: item.type ?? null,
          description: item.description ?? "", source: item.source, itemId: item.itemId,
        });
      }
      await persist(items.filter((entry) => entry.id !== id));
      sync.setExpandedItemId(null);
      return;
    }
    const destination = containerId && containers.some((container) => container.id === containerId)
      ? containerId
      : DEFAULT_CONTAINER_ID;
    await persist(items.map((item) => item.id === id ? { ...item, containerId: destination } : item));
  };

  return {
    persist,
    addItem,
    addContainer,
    renameContainer,
    toggleContainerIgnoreWeight,
    removeContainer,
    moveItemToContainer,
  };
}

export type CharacterInventoryContainerActions = ReturnType<typeof useCharacterInventoryContainers>;
