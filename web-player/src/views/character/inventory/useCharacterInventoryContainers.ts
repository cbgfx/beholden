import {
  transferPartyInventoryItem,
  type PartyStashTransferOp,
} from "@/services/inventoryApi";
import { api } from "@/services/api";
import {
  inferStackKey,
  isStackableItem,
  mergeStackedInventoryItem,
  normalizeContainers,
  uid,
  DEFAULT_CONTAINER_ID,
  PARTY_STASH_CONTAINER_ID,
} from "@/views/character/inventory/CharacterInventoryPanelHelpers";
import {
  initializeItemUsesMaximum,
  resolveItemUses,
  type InventoryContainer,
  type InventoryItem,
  type InventoryPickerPayload,
} from "@/views/character/inventory/CharacterInventory";
import { hasCustomTransferState, toInventoryTransferPayload } from "@/views/character/inventory/inventoryTransferPayload";
import type { InventoryPersistencePayload, CharacterInventorySyncState } from "@/views/character/inventory/useCharacterInventorySync";
import { normalizePackLookupName, parsePackDescription } from "@/views/character/inventory/CharacterInventoryBundles";

const INVENTORY_CONFLICT_MESSAGE =
  "Your inventory changed on another device and has been reloaded. Please redo that last change.";

// A rejected save whose stored *inventory* had moved on since we read it
// (another device, a DM treasure award). Reloading the sheet is the fix.
function isInventoryConflict(error: unknown): boolean {
  const e = error as { status?: number; code?: string } | null;
  return e?.code === "stale-inventory" || (e?.status === 409 && e?.code !== "stale-stash");
}

// A transfer rejected because the party-stash row changed (its quantity moved,
// or another member already took it). The character sheet was untouched — the
// stash reconciles through its own live sync, so no character reload.
function isStaleStash(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "stale-stash";
}

export function useCharacterInventoryContainers({
  sync,
  campaignId,
  characterId,
  inventoryRev,
  onSave,
  onReload,
}: {
  sync: CharacterInventorySyncState;
  campaignId?: string | null;
  characterId?: string | null;
  inventoryRev?: string;
  onReload: () => Promise<void>;
  onSave: (data: InventoryPersistencePayload, opts?: { expectedInventoryRev?: string }) => Promise<unknown>;
}) {
  const { items, containers, partyStashItems } = sync;
  const recoverConflict = async () => {
    sync.setConflict("Inventory changed. Reloading the latest sheet…");
    try {
      await onReload();
      sync.setConflict(INVENTORY_CONFLICT_MESSAGE);
    } catch {
      sync.setConflict("Inventory changed, but reloading failed. Reload the page before retrying.");
    }
  };
  const persist = async (
    updatedItems: InventoryItem[],
    updatedContainers: InventoryContainer[] = containers,
  ) => {
    sync.setSaving(true);
    try {
      const normalized = normalizeContainers(updatedContainers);
      await onSave({ inventory: updatedItems, inventoryContainers: normalized }, { expectedInventoryRev: inventoryRev });
      sync.setItems(updatedItems);
      sync.setContainers(normalized);
      sync.setConflict(null);
    } catch (error) {
      if (isInventoryConflict(error)) {
        await recoverConflict();
      }
      throw error;
    } finally {
      sync.setSaving(false);
    }
  };

  // Transfer once, then reload authoritative state without another write.
  const transferItem = async (nextItems: InventoryItem[], stash: PartyStashTransferOp) => {
    if (!campaignId || !characterId) return;
    if (!inventoryRev) throw new Error("Reload the character before transferring items.");
    sync.setSaving(true);
    try {
      await transferPartyInventoryItem(campaignId, {
        characterId,
        expectedInventoryRev: inventoryRev,
        inventory: nextItems,
        inventoryContainers: normalizeContainers(containers),
        stash,
      });
      const normalized = normalizeContainers(containers);
      sync.setItems(nextItems);
      sync.setContainers(normalized);
      sync.setConflict(null);
      try {
        await onReload();
      } catch {
        sync.setConflict("Transfer completed, but reloading failed. Reload the page before making another change; do not repeat the transfer.");
      }
    } catch (error) {
      if (isStaleStash(error)) {
        sync.setConflict("The party stash changed on another device. Refresh the stash and try again.");
      } else if (isInventoryConflict(error)) {
        await recoverConflict();
      }
      throw error;
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
      if (payload.bundle) {
        const bundleIds = [payload.bundle.container, ...Object.keys(payload.bundle.items)];
        const result = await api<{ rows: Array<{ id: string; name: string }> }>("/api/compendium/items/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: bundleIds }),
        });
        const byId = new Map(result.rows.map((entry) => [entry.id, entry]));
        const containerItem = byId.get(payload.bundle.container);
        if (!containerItem) throw new Error(`Bundle container ${payload.bundle.container} was not found`);
        let nextContainers = containers;
        const nextItems = [...items];
        for (let index = 0; index < Math.max(1, Number(payload.quantity) || 1); index += 1) {
          const packContainer = createContainer(containerItem.name);
          nextContainers = [...nextContainers, packContainer];
          for (const [itemId, quantity] of Object.entries(payload.bundle.items)) {
            const entry = byId.get(itemId);
            if (!entry) throw new Error(`Bundle item ${itemId} was not found`);
            nextItems.push({
              id: uid(),
              name: entry.name,
              quantity,
              equipped: false,
              equipState: "backpack",
              source: "compendium",
              itemId,
              containerId: packContainer.id,
              properties: [],
            });
          }
        }
        await persist(nextItems, nextContainers);
        sync.setPickerOpen(false);
        return;
      }
      const inferredPack = parsePackDescription(payload.name, payload.description);
      if (inferredPack) {
        const result = await api<{ rows: Array<{ id: string; name: string }> }>("/api/compendium/items/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: [inferredPack.containerName, ...inferredPack.items.map((entry) => entry.name)] }),
        });
        const rowsByName = new Map(result.rows.map((entry) => [normalizePackLookupName(entry.name), entry]));
        let nextContainers = containers;
        const nextItems = [...items];
        for (let index = 0; index < Math.max(1, Number(payload.quantity) || 1); index += 1) {
          const packContainer = createContainer(inferredPack.containerName);
          nextContainers = [...nextContainers, packContainer];
          for (const requested of inferredPack.items) {
            const resolved = rowsByName.get(normalizePackLookupName(requested.name));
            nextItems.push({
              id: uid(),
              name: resolved?.name ?? requested.name,
              quantity: requested.quantity,
              equipped: false,
              equipState: "backpack",
              source: resolved ? "compendium" : "custom",
              itemId: resolved?.id,
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
      const resolvedUses = resolveItemUses(payload.itemId, payload.uses);
      const chargesMax = initializeItemUsesMaximum(resolvedUses);
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
        modifiers: payload.modifiers ?? [],
        description: description || undefined,
        uses: resolvedUses,
        spells: payload.spells ?? null,
        spellcasting: payload.spellcasting ?? null,
        spellTemplate: payload.spellTemplate ?? null,
        ammo: payload.ammo ?? null,
        weaponAmmo: payload.weaponAmmo ?? null,
        usage: payload.usage ?? null,
        chargesMax,
        charges: chargesMax,
        effects: payload.effects ?? null,
      };
      let nextContainers = containers;
      if (payload.container) {
        nextContainers = [...containers, createContainer(payload.name, payload.ignoreWeight === true)];
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
    if (containerId === PARTY_STASH_CONTAINER_ID && campaignId && characterId) {
      const item = items.find((entry) => entry.id === id);
      if (!item) return;
      // Only fold into an existing stash stack when NEITHER side carries
      // character-authored detail (notes, edited stats, part-used charges,
      // stored spells) — otherwise a merge would silently drop it, so keep the
      // deposit as its own row.
      const mergeTarget = hasCustomTransferState(item)
        ? undefined
        : partyStashItems.find((stash) => {
            if (stash.payload || (stash.notes ?? "").trim()) return false;
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
      // Removing the item from the sheet and adding it to the stash are one
      // atomic server transaction — a failed request leaves the item on the
      // character rather than destroying it.
      const nextItems = items.filter((entry) => entry.id !== id);
      const stash: PartyStashTransferOp = mergeTarget
        ? { action: "setQuantity", itemId: mergeTarget.id, quantity: mergeTarget.quantity + Math.max(1, item.quantity), expectedStashRev: mergeTarget.revision, expectedQuantity: mergeTarget.quantity }
        : {
            action: "create",
            item: {
              name: item.name, quantity: item.quantity, weight: item.weight ?? null,
              notes: item.notes ?? "", rarity: item.rarity ?? null, type: item.type ?? null,
              description: item.description ?? "", source: item.source, itemId: item.itemId,
              // Full portable state so player customizations survive the round trip.
              payload: toInventoryTransferPayload(item),
            },
          };
      await transferItem(nextItems, stash);
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
    transferItem,
    addItem,
    addContainer,
    renameContainer,
    toggleContainerIgnoreWeight,
    removeContainer,
    moveItemToContainer,
  };
}

export type CharacterInventoryContainerActions = ReturnType<typeof useCharacterInventoryContainers>;
