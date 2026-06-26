import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import { createPartyInventoryItem, fetchPartyInventory, fetchPartyInventoryItem, updatePartyInventoryQuantity } from "@/services/inventoryApi";
import { useWs } from "@/services/ws";
import { C } from "@/lib/theme";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import { DraggableList } from "@/ui/DraggableList";
import { useDebouncedSingleflight } from "@beholden/shared/ui";
import {
  DEFAULT_CONTAINER_ID,
  PARTY_STASH_CONTAINER_ID,
  inferStackKey,
  isStackableItem,
  matchInventorySummary,
  mergeStackedInventoryItem,
  normalizeContainers,
  parsePackContentsFromDescription,
  singularizeInventoryLookupName,
  subLabelStyle,
  uid,
} from "@/views/character/CharacterInventoryPanelHelpers";
import { InventoryItemDrawer } from "@/views/character/CharacterInventoryDrawer";
import { InventoryItemPickerModal } from "@/views/character/CharacterInventoryPickerModal";
import { ItemRow, type PartyStashItem } from "@/views/character/CharacterInventoryPanelRows";
import { InventoryCurrencyBar } from "@/views/character/CharacterInventoryCurrencyBar";
import { InventoryPartyStashSection } from "@/views/character/CharacterInventoryPartyStashSection";
import { InventoryContainerSection } from "@/views/character/CharacterInventoryContainerSection";
import {
  CollapsiblePanel,
  panelHeaderAddBtn,
} from "@/views/character/CharacterViewParts";
import {
  canEquipOffhand,
  type CharacterDataLike,
  type CompendiumItemDetail,
  type EquipState,
  type InventoryContainer,
  type InventoryItem,
  type InventoryPickerPayload,
  type ItemSummaryRow,
  canUseTwoHands,
  formatWeight,
  getEquipState,
  isArmorItem,
  isCurrencyItem,
  isWearableItem,
  isWeaponItem,
  normalizeInventoryItemLookupName,
  parseChargesMax,
  requiresTwoHands,
  totalInventoryWeight,
} from "@/views/character/CharacterInventory";

interface InventoryPanelCharacter {
  strScore: number | null;
}

type InventoryPanelCharacterData = CharacterDataLike & {
  inventory?: InventoryItem[];
  inventoryContainers?: InventoryContainer[];
};

type PersistPayload = {
  inventory: InventoryItem[];
  inventoryContainers: InventoryContainer[];
};

export function InventoryPanel({ char, charData, parsedFeatureEffects, accentColor, campaignId, onSave }: {
  char: InventoryPanelCharacter;
  charData: InventoryPanelCharacterData | null;
  parsedFeatureEffects?: ParsedFeatureEffects[] | null;
  accentColor: string;
  campaignId?: string | null;
  onSave: (data: PersistPayload) => Promise<unknown>;
}) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    ((charData?.inventory ?? []) as InventoryItem[]).map((item) => ({
      ...item,
      equipState: getEquipState(item),
      properties: item.properties ?? [],
    }))
  );
  const [containers, setContainers] = useState<InventoryContainer[]>(() => normalizeContainers(charData?.inventoryContainers));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemIndex, setItemIndex] = useState<ItemSummaryRow[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [collapsedContainerIds, setCollapsedContainerIds] = useState<string[]>([]);
  const [expandedDetail, setExpandedDetail] = useState<CompendiumItemDetail | null>(null);
  const [expandedBusy, setExpandedBusy] = useState(false);
  const [expandedDetailCache, setExpandedDetailCache] = useState<Record<string, CompendiumItemDetail>>({});
  const [itemEditMode, setItemEditMode] = useState(false);
  const [partyStashItems, setPartyStashItems] = useState<PartyStashItem[]>([]);

  const fetchPartyStash = useCallback(() => {
    if (!campaignId) return;
    fetchPartyInventory(campaignId)
      .then((items) => setPartyStashItems(items as PartyStashItem[]))
      .catch(() => {});
  }, [campaignId]);

  const enqueuePartyStashRefresh = useDebouncedSingleflight(fetchPartyStash);

  useEffect(() => { fetchPartyStash(); }, [fetchPartyStash]);

  useWs(useCallback((msg) => {
    if (msg.type === "partyInventory:delta") {
      const payload = (msg.payload ?? {}) as {
        campaignId?: string;
        action?: "upsert" | "delete" | "refresh";
        itemId?: string;
      };
      if (payload.campaignId !== campaignId) return;
      if (payload.action === "delete" && payload.itemId) {
        setPartyStashItems((prev) => prev.filter((item) => item.id !== payload.itemId));
        return;
      }
      if (payload.action === "upsert" && payload.itemId) {
        if (!campaignId) return;
        void fetchPartyInventoryItem(campaignId, payload.itemId)
          .then((item) => {
            setPartyStashItems((prev) => {
              const idx = prev.findIndex((entry) => entry.id === item.id);
              if (idx === -1) return [...prev, item as PartyStashItem];
              const next = prev.slice();
              next[idx] = item as PartyStashItem;
              return next;
            });
          })
          .catch(() => {
            enqueuePartyStashRefresh();
          });
        return;
      }
      enqueuePartyStashRefresh();
    }
  }, [campaignId, enqueuePartyStashRefresh]));

  useEffect(() => {
    setItems(
      ((charData?.inventory ?? []) as InventoryItem[]).map((item) => ({
        ...item,
        equipState: getEquipState(item),
        properties: item.properties ?? [],
      }))
    );
  }, [charData?.inventory]);

  useEffect(() => {
    setContainers(normalizeContainers(charData?.inventoryContainers));
  }, [charData?.inventoryContainers]);

  useEffect(() => {
    const ids = Array.from(
      new Set(
        items
          .map((item) => String(item.itemId ?? "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    const names = Array.from(
      new Set(
        items
          .filter((item) => !item.itemId && item.source !== "custom" && !isCurrencyItem(item))
          .map((item) => String(item.name ?? "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    if (ids.length === 0 && names.length === 0) {
      setItemIndex([]);
      return;
    }
    let alive = true;
    api<{ rows: ItemSummaryRow[] }>("/api/compendium/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, names }),
    })
      .then((result) => { if (alive) setItemIndex(Array.isArray(result?.rows) ? result.rows : []); })
      .catch(() => { if (alive) setItemIndex([]); });
    return () => { alive = false; };
  }, [items]);

  useEffect(() => {
    if (itemIndex.length === 0) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const summary = matchInventorySummary(item, itemIndex);
        if (!summary) return item;
        const canonicalName = summary.name.replace(/\s+\[(?:2024|5\.5e)\]\s*$/i, "").trim();
        const patched: InventoryItem = {
          ...item,
          name: item.source === "custom" && !item.itemId ? item.name : canonicalName,
          source: item.source === "custom" && !item.itemId ? item.source : "compendium",
          itemId: item.itemId ?? summary.id,
          type: item.type ?? summary.type,
          rarity: item.rarity ?? summary.rarity,
          magic: item.magic ?? summary.magic,
          attunement: item.attunement ?? summary.attunement,
          weight: item.weight ?? summary.weight ?? null,
          value: item.value ?? summary.value ?? null,
          ac: item.ac ?? summary.ac ?? null,
          stealthDisadvantage: item.stealthDisadvantage ?? summary.stealthDisadvantage ?? false,
          dmg1: item.dmg1 ?? summary.dmg1 ?? null,
          dmg2: item.dmg2 ?? summary.dmg2 ?? null,
          dmgType: item.dmgType ?? summary.dmgType ?? null,
          properties: item.properties?.length ? item.properties : (summary.properties ?? []),
        };
        if (
          patched.name !== item.name
          || patched.source !== item.source
          || patched.itemId !== item.itemId
          || patched.type !== item.type
          || patched.rarity !== item.rarity
          || patched.magic !== item.magic
          || patched.attunement !== item.attunement
          || patched.weight !== item.weight
          || patched.value !== item.value
          || patched.ac !== item.ac
          || patched.stealthDisadvantage !== item.stealthDisadvantage
          || patched.dmg1 !== item.dmg1
          || patched.dmg2 !== item.dmg2
          || patched.dmgType !== item.dmgType
          || JSON.stringify(patched.properties ?? []) !== JSON.stringify(item.properties ?? [])
        ) {
          changed = true;
          return patched;
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [itemIndex]);

  useEffect(() => {
    const missingDescriptionItems = items.filter((item) => item.itemId && item.source !== "custom" && !String(item.description ?? "").trim());
    if (missingDescriptionItems.length === 0) return;
    let alive = true;
    (async () => {
      try {
        const ids = Array.from(
          new Set(
            missingDescriptionItems
              .map((item) => String(item.itemId ?? "").trim())
              .filter(Boolean),
          ),
        );
        const lookup = await api<{ rows: Array<{ id: string; text?: string[] | null }> }>("/api/compendium/items/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, includeText: true }),
        });
        const textByItemId = new Map(
          (lookup.rows ?? []).map((row) => [row.id, Array.isArray(row.text) ? row.text.join("\n\n").trim() : ""]),
        );
        if (!alive) return;
        const updatedItems = items.map((item) => {
          const itemId = String(item.itemId ?? "");
          const description = itemId ? textByItemId.get(itemId) : undefined;
          if (!description) return item;
          return {
            ...item,
            description,
            chargesMax: item.chargesMax ?? parseChargesMax(description) ?? null,
            charges: item.charges ?? (item.chargesMax ?? parseChargesMax(description) ?? null),
          };
        });
        const changed = updatedItems.some((item, index) => item !== items[index]);
        if (!changed) return;
        const normalizedContainers = normalizeContainers(containers);
        setItems(updatedItems);
        await onSave({ inventory: updatedItems, inventoryContainers: normalizedContainers });
      } catch {
        // Ignore hydration failures; inventory still works without enriched descriptions.
      }
    })();
    return () => { alive = false; };
  }, [items, containers, onSave]);

  useEffect(() => {
    if (!expandedItemId) {
      setExpandedDetail(null);
      setExpandedBusy(false);
      setItemEditMode(false);
      return;
    }
    const inventoryItem = items.find((it) => it.id === expandedItemId);
    if (!inventoryItem) {
      setExpandedDetail(null);
      setExpandedBusy(false);
      return;
    }
    const normalizedName = normalizeInventoryItemLookupName(inventoryItem.name);
    const singularNormalizedName = normalizeInventoryItemLookupName(singularizeInventoryLookupName(inventoryItem.name));
    const matchedSummary = inventoryItem.itemId
      ? itemIndex.find((row) => row.id === inventoryItem.itemId) ?? null
      : itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === normalizedName)
        ?? itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === singularNormalizedName)
        ?? null;

    if (!matchedSummary) {
      setExpandedDetail(null);
      setExpandedBusy(false);
      return;
    }

    const cached = expandedDetailCache[matchedSummary.id];
    if (cached) {
      setExpandedDetail(cached);
      setExpandedBusy(false);
      return;
    }

    let alive = true;
    setExpandedBusy(true);
    api<CompendiumItemDetail>(`/api/compendium/items/${matchedSummary.id}`)
      .then((detail) => {
        if (!alive) return;
        setExpandedDetail(detail);
        setExpandedDetailCache((prev) => ({ ...prev, [matchedSummary.id]: detail }));
      })
      .catch(() => { if (alive) setExpandedDetail(null); })
      .finally(() => { if (alive) setExpandedBusy(false); });
    return () => { alive = false; };
  }, [expandedItemId, expandedDetailCache, itemIndex, items]);

  async function persist(updatedItems: InventoryItem[], updatedContainers: InventoryContainer[] = containers) {
    setSaving(true);
    try {
      const normalized = normalizeContainers(updatedContainers);
      await onSave({ inventory: updatedItems, inventoryContainers: normalized });
      setItems(updatedItems);
      setContainers(normalized);
    } finally {
      setSaving(false);
    }
  }

  function createContainer(baseName = "Backpack", ignoreWeight = false): InventoryContainer {
    return {
      id: uid(),
      name: baseName,
      ignoreWeight,
    };
  }

  async function addItem(payload?: InventoryPickerPayload) {
    try {
      const next = payload;
      if (!next?.name) return;
      const packEntries = parsePackContentsFromDescription(next.description ?? "");
      if (packEntries.length > 0) {
        let nextContainers = containers;
        const nextItems = [...items];
        const packCount = Math.max(1, Number(next.quantity) || 1);
        for (let packIndex = 0; packIndex < packCount; packIndex += 1) {
          const packContainer = createContainer(next.name, false);
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
        setPickerOpen(false);
        return;
      }
      const item: InventoryItem = {
        id: uid(),
        name: next.name,
        quantity: Math.max(1, next.quantity),
        equipped: false,
        equipState: "backpack",
        source: next.source,
        itemId: next.itemId,
        rarity: next.rarity ?? null,
        type: next.type ?? null,
        attunement: next.attunement ?? false,
        attuned: next.attuned ?? false,
        magic: next.magic ?? false,
        silvered: next.silvered ?? false,
        equippable: next.equippable ?? false,
        weight: next.weight ?? null,
        value: next.value ?? null,
        proficiency: next.proficiency ?? null,
        ac: next.ac ?? null,
        stealthDisadvantage: next.stealthDisadvantage ?? false,
        dmg1: next.dmg1 ?? null,
        dmg2: next.dmg2 ?? null,
        dmgType: next.dmgType ?? null,
        properties: next.properties ?? [],
        description: next.description?.trim() || undefined,
        ...(() => {
          const desc = next.description?.trim() ?? "";
          const charges = desc ? (parseChargesMax(desc) ?? null) : null;
          return { chargesMax: charges, charges };
        })(),
      };
      let nextContainers = containers;
      if (/^bag of holding\b/i.test(next.name)) {
        const bagContainer = createContainer("Bag of Holding", true);
        nextContainers = [...containers, bagContainer];
      }
      let merged = false;
      try {
        if (isStackableItem(item)) {
          const incomingKey = inferStackKey(item);
          const existingIndex = items.findIndex((entry) => isStackableItem(entry) && inferStackKey(entry) === incomingKey);
          if (existingIndex >= 0) {
            const updated = items.map((entry, index) =>
              index === existingIndex ? mergeStackedInventoryItem(entry, item) : entry
            );
            await persist(updated, nextContainers);
            merged = true;
          }
        }
      } catch (mergeError) {
        console.error("Inventory stack merge failed; falling back to direct add.", mergeError);
      }
      if (!merged) {
        await persist([...items, item], nextContainers);
      }
      setPickerOpen(false);
    } catch (error) {
      console.error("Failed to add inventory item.", error);
    }
  }

  async function addContainer(afterId?: string | null, baseName = "Backpack", ignoreWeight = false) {
    const container = createContainer(baseName, ignoreWeight);
    const insertAt = afterId ? containers.findIndex((entry) => entry.id === afterId) : containers.length - 1;
    const nextContainers = [...containers];
    nextContainers.splice(insertAt + 1, 0, container);
    await persist(items, nextContainers);
  }

  async function renameContainer(id: string, name: string) {
    const nextContainers = containers.map((container) =>
      container.id === id
        ? { ...container, name: name.trim() || (id === DEFAULT_CONTAINER_ID ? "Backpack" : "Container") }
        : container
    );
    await persist(items, nextContainers);
  }

  async function toggleContainerIgnoreWeight(id: string) {
    const nextContainers = containers.map((container) =>
      container.id === id ? { ...container, ignoreWeight: !container.ignoreWeight } : container
    );
    await persist(items, nextContainers);
  }

  async function removeContainer(id: string) {
    if (id === DEFAULT_CONTAINER_ID) return;
    const nextItems = items.map((item) =>
      item.containerId === id ? { ...item, containerId: DEFAULT_CONTAINER_ID } : item
    );
    const nextContainers = containers.filter((container) => container.id !== id);
    await persist(nextItems, nextContainers);
  }

  async function moveItemToContainer(id: string, containerId: string | null) {
    if (containerId === PARTY_STASH_CONTAINER_ID && campaignId) {
      const item = items.find((it) => it.id === id);
      if (!item) return;
      const incomingKey = inferStackKey(item);
      const existing = partyStashItems.find((stash) => {
        const stashAsInventory: InventoryItem = {
          id: stash.id,
          name: stash.name,
          quantity: Math.max(1, stash.quantity),
          equipped: false,
          equipState: "backpack",
          source: (stash.source ?? "custom") as "compendium" | "custom",
          itemId: stash.itemId ?? undefined,
          type: stash.type ?? null,
          rarity: stash.rarity ?? null,
          weight: stash.weight ?? null,
          description: stash.description ?? undefined,
        };
        return isStackableItem(item) && isStackableItem(stashAsInventory) && inferStackKey(stashAsInventory) === incomingKey;
      });
      if (existing) {
        await updatePartyInventoryQuantity(campaignId, existing.id, Math.max(1, existing.quantity) + Math.max(1, item.quantity));
      } else {
        await createPartyInventoryItem(campaignId, {
          name: item.name,
          quantity: item.quantity,
          weight: item.weight ?? null,
          notes: item.notes ?? "",
          rarity: item.rarity ?? null,
          type: item.type ?? null,
          description: item.description ?? "",
          source: item.source,
          itemId: item.itemId,
        });
      }
      await persist(items.filter((it) => it.id !== id));
      setExpandedItemId(null);
      return;
    }
    const nextContainerId = containerId && containers.some((container) => container.id === containerId)
      ? containerId
      : DEFAULT_CONTAINER_ID;
    const nextItems = items.map((item) => item.id === id ? { ...item, containerId: nextContainerId } : item);
    await persist(nextItems);
  }

  async function takeFromPartyStash(stashItem: PartyStashItem) {
    if (!campaignId) return;
    await api(`/api/campaigns/${campaignId}/party-inventory/${stashItem.id}`, { method: "DELETE" });
    const incomingItem: InventoryItem = {
      id: uid(),
      name: stashItem.name,
      quantity: stashItem.quantity,
      equipped: false,
      equipState: "backpack",
      source: (stashItem.source ?? "custom") as "compendium" | "custom",
      itemId: stashItem.itemId ?? undefined,
      rarity: stashItem.rarity ?? null,
      type: stashItem.type ?? null,
      weight: stashItem.weight ?? null,
      description: stashItem.description ?? undefined,
      containerId: DEFAULT_CONTAINER_ID,
    };
    if (isStackableItem(incomingItem)) {
      const incomingKey = inferStackKey(incomingItem);
      const existingIndex = items.findIndex((entry) => isStackableItem(entry) && inferStackKey(entry) === incomingKey);
      if (existingIndex >= 0) {
        const updated = items.map((entry, index) =>
          index === existingIndex ? mergeStackedInventoryItem(entry, incomingItem) : entry
        );
        await persist(updated);
        return;
      }
    }
    await persist([...items, incomingItem]);
  }

  async function changePartyStashQty(id: string, quantity: number) {
    if (!campaignId) return;
    await updatePartyInventoryQuantity(campaignId, id, quantity);
  }

  async function deleteFromPartyStash(id: string) {
    if (!campaignId) return;
    await api(`/api/campaigns/${campaignId}/party-inventory/${id}`, { method: "DELETE" });
  }

  function toggleContainerCollapsed(containerId: string) {
    setCollapsedContainerIds((prev) =>
      prev.includes(containerId)
        ? prev.filter((id) => id !== containerId)
        : [...prev, containerId]
    );
  }

  async function setEquipStateFor(id: string, state: EquipState) {
    const target = items.find((it) => it.id === id);
    const targetIsArmor = Boolean(target && isArmorItem(target));
    const updated = items.map((it) => {
      if (it.id === id) return { ...it, equipped: state !== "backpack", equipState: state };
      const currentState = getEquipState(it);
      if (state === "offhand" && currentState === "mainhand-2h") {
        return canUseTwoHands(it) && !requiresTwoHands(it)
          ? { ...it, equipped: true, equipState: "mainhand-1h" as const }
          : { ...it, equipped: false, equipState: "backpack" as const };
      }
      if (state === "mainhand-2h" && currentState === "offhand") {
        return { ...it, equipped: false, equipState: "backpack" as const };
      }
      if (state.startsWith("mainhand") && currentState.startsWith("mainhand")) {
        return { ...it, equipped: false, equipState: "backpack" as const };
      }
      if (state === "offhand" && currentState === "offhand") {
        return { ...it, equipped: false, equipState: "backpack" as const };
      }
      // Allow multiple worn items (cloak + amulet + etc.), but only one worn armor piece.
      if (state === "worn" && targetIsArmor && currentState === "worn" && isArmorItem(it)) {
        return { ...it, equipped: false, equipState: "backpack" as const };
      }
      return { ...it, equipped: currentState !== "backpack", equipState: currentState };
    });
    await persist(updated);
  }

  async function cycleMainHand(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item || !isWeaponItem(item)) return;
    const state = getEquipState(item);
    if (state === "backpack" || state === "offhand") {
      await setEquipStateFor(id, requiresTwoHands(item) || (!item.dmg1 && item.dmg2) ? "mainhand-2h" : "mainhand-1h");
      return;
    }
    if (state === "mainhand-1h" && canUseTwoHands(item) && !requiresTwoHands(item)) {
      await setEquipStateFor(id, "mainhand-2h");
      return;
    }
    await setEquipStateFor(id, "backpack");
  }

  async function toggleOffhand(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item || !canEquipOffhand(item, parsedFeatureEffects)) return;
    const state = getEquipState(item);
    await setEquipStateFor(id, state === "offhand" ? "backpack" : "offhand");
  }

  async function toggleWorn(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    const state = getEquipState(item);
    await setEquipStateFor(id, state === "worn" ? "backpack" : "worn");
  }

  async function removeItem(id: string) {
    await persist(items.filter((it) => it.id !== id));
  }

  async function changeQty(id: string, delta: number) {
    const updated = items.map((it) => {
      if (it.id !== id) return it;
      const q = Math.max(1, it.quantity + delta);
      return { ...it, quantity: q };
    });
    await persist(updated);
  }

  function toggleExpandedItem(id: string) {
    setExpandedItemId((current) => current === id ? null : id);
    setItemEditMode(false);
  }

  async function saveItemEdits(id: string, patch: Partial<InventoryItem>) {
    const updated = items.map((it) => it.id === id ? { ...it, ...patch } : it);
    await persist(updated);
  }

  async function saveCurrencyAmount(code: "PP" | "GP" | "SP" | "CP", nextValue: number) {
    const value = Math.max(0, Math.floor(Number(nextValue) || 0));
    const existing = items.find((it) => String(it.name ?? "").trim().toUpperCase() === code);
    let updated: InventoryItem[];
    if (existing) {
      updated = value > 0
        ? items.map((it) => it.id === existing.id ? { ...it, quantity: value } : it)
        : items.filter((it) => it.id !== existing.id);
    } else if (value > 0) {
      updated = [
        ...items,
        {
          id: uid(),
          name: code,
          quantity: value,
          equipped: false,
          equipState: "backpack",
          source: "custom",
        },
      ];
    } else {
      updated = items;
    }
    await persist(updated);
  }

  async function reorderItemsByIds(ids: string[], predicate: (item: InventoryItem) => boolean) {
    const subset = items.filter(predicate);
    if (subset.length < 2) return;

    const subsetIds = subset.map((item) => item.id);
    if (ids.length !== subsetIds.length) return;
    const idSet = new Set(subsetIds);
    if (ids.some((id) => !idSet.has(id))) return;

    const byId = new Map(subset.map((item) => [item.id, item] as const));
    const reorderedSubset = ids.map((id) => byId.get(id)).filter((item): item is InventoryItem => Boolean(item));
    if (reorderedSubset.length !== subset.length) return;

    let subsetIndex = 0;
    const updated = items.map((item) => {
      if (!predicate(item)) return item;
      const next = reorderedSubset[subsetIndex];
      subsetIndex += 1;
      return next;
    });

    await persist(updated);
  }

  const equipped = items.filter((it) => getEquipState(it) !== "backpack");
  const currencyTotals = items.reduce<Record<"PP" | "GP" | "EP" | "SP" | "CP", number>>((acc, item) => {
    const name = String(item.name ?? "").trim().toUpperCase();
    if (name === "PP" || name === "GP" || name === "EP" || name === "SP" || name === "CP") {
      acc[name] += Math.max(0, item.quantity || 0);
    }
    return acc;
  }, { PP: 0, GP: 0, EP: 0, SP: 0, CP: 0 });
  const containerBackpackItems = items.filter((it) => {
    if (getEquipState(it) !== "backpack") return false;
    if (isCurrencyItem(it)) return false;
    return true;
  });
  const itemsByContainer = new Map<string, InventoryItem[]>();
  for (const item of containerBackpackItems) {
    const containerId = item.containerId && containers.some((container) => container.id === item.containerId)
      ? item.containerId
      : DEFAULT_CONTAINER_ID;
    const list = itemsByContainer.get(containerId) ?? [];
    list.push(item.containerId === containerId ? item : { ...item, containerId });
    itemsByContainer.set(containerId, list);
  }
  const carriedWeight = totalInventoryWeight(items, containers);
  const strScore = Math.max(0, char.strScore ?? 0);
  const carryCapacity = strScore * 15;
  const overCapacity = carryCapacity > 0 && carriedWeight > carryCapacity;
  const selectedItem = expandedItemId ? items.find((it) => it.id === expandedItemId) ?? null : null;
  const otherAttunedCount = selectedItem
    ? items.filter((it) => it.id !== selectedItem.id && it.attuned).length
    : items.filter((it) => it.attuned).length;

  return (
    <CollapsiblePanel
      title={<>Inventory{saving && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginLeft: 6, fontWeight: 400, textTransform: "none" }}>saving…</span>}</>}
      color={accentColor}
      storageKey="inventory"
      summary={`${items.length} items · ${Math.round(carriedWeight * 10) / 10} / ${carryCapacity} lb`}
      actions={<button type="button" onClick={() => setPickerOpen(true)} title="Add item" style={panelHeaderAddBtn(accentColor)}>+</button>}
    >

      <InventoryCurrencyBar
        currencyTotals={currencyTotals}
        carriedWeight={carriedWeight}
        carryCapacity={carryCapacity}
        overCapacity={overCapacity}
        accentColor={accentColor}
        onSaveCurrency={saveCurrencyAmount}
      />

      {equipped.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={subLabelStyle}>Equipped</div>
          <DraggableList
            items={equipped.map((item) => ({ id: item.id }))}
            onReorder={(ids) => {
              void reorderItemsByIds(ids, (item) => getEquipState(item) !== "backpack");
            }}
            renderItem={(dragItem) => {
              const it = equipped.find((item) => item.id === dragItem.id);
              if (!it) return null;
              return (
                <ItemRow
                  item={it}
                  accentColor={accentColor}
                  charData={charData}
                  parsedFeatureEffects={parsedFeatureEffects}
                  expanded={expandedItemId === it.id}
                  onToggleExpanded={toggleExpandedItem}
                  onCycleMain={cycleMainHand}
                  onToggleOffhand={toggleOffhand}
                  onToggleWorn={toggleWorn}
                  onRemove={removeItem}
                  onQty={changeQty}
                />
              );
            }}
          />
        </div>
      )}

      {containers.map((container) => {
        const containerItems = itemsByContainer.get(container.id) ?? [];
        const isDefault = container.id === DEFAULT_CONTAINER_ID;
        return (
          <InventoryContainerSection
            key={container.id}
            container={container}
            containerItems={containerItems}
            isDefault={isDefault}
            isCollapsed={collapsedContainerIds.includes(container.id)}
            accentColor={accentColor}
            charData={charData}
            parsedFeatureEffects={parsedFeatureEffects}
            expandedItemId={expandedItemId}
            onToggleCollapsed={() => toggleContainerCollapsed(container.id)}
            onNameChange={(name) => setContainers((prev) => prev.map((entry) => entry.id === container.id ? { ...entry, name } : entry))}
            onRename={(name) => renameContainer(container.id, name)}
            onResetName={() => setContainers(normalizeContainers(charData?.inventoryContainers ?? containers))}
            onToggleIgnoreWeight={() => toggleContainerIgnoreWeight(container.id)}
            onRemove={!isDefault ? () => removeContainer(container.id) : undefined}
            onAdd={() => addContainer(container.id)}
            onReorder={(ids) => void reorderItemsByIds(ids, (item) => {
              if (getEquipState(item) !== "backpack") return false;
              if (isCurrencyItem(item)) return false;
              const itemContainerId = item.containerId && containers.some((entry) => entry.id === item.containerId)
                ? item.containerId
                : DEFAULT_CONTAINER_ID;
              return itemContainerId === container.id;
            })}
            onToggleExpandedItem={toggleExpandedItem}
            onCycleMain={cycleMainHand}
            onToggleOffhand={toggleOffhand}
            onToggleWorn={toggleWorn}
            onRemoveItem={removeItem}
            onQty={changeQty}
          />
        );
      })}

      {campaignId && (
        <InventoryPartyStashSection
          stashItems={partyStashItems}
          collapsed={collapsedContainerIds.includes(PARTY_STASH_CONTAINER_ID)}
          onToggleCollapsed={() => toggleContainerCollapsed(PARTY_STASH_CONTAINER_ID)}
          onTake={(item) => void takeFromPartyStash(item)}
          onDelete={(id) => void deleteFromPartyStash(id)}
          onQuantity={(id, q) => void changePartyStashQty(id, q)}
        />
      )}

      <InventoryItemPickerModal
        isOpen={pickerOpen}
        accentColor={accentColor}
        onClose={() => setPickerOpen(false)}
        onAdd={addItem}
      />
      {selectedItem ? (
        <InventoryItemDrawer
          item={selectedItem}
          containers={campaignId ? [...containers, { id: PARTY_STASH_CONTAINER_ID, name: "Party Stash", ignoreWeight: true }] : containers}
          detail={expandedDetail}
          busy={expandedBusy}
          accentColor={accentColor}
          otherAttunedCount={otherAttunedCount}
          editMode={itemEditMode}
          onStartEdit={() => setItemEditMode(true)}
          onCancelEdit={() => setItemEditMode(false)}
          onClose={() => setExpandedItemId(null)}
          onSave={async (patch) => {
            await saveItemEdits(selectedItem.id, patch);
            setItemEditMode(false);
          }}
          onMoveToContainer={async (containerId) => {
            await moveItemToContainer(selectedItem.id, containerId);
          }}
          onChargesChange={async (charges) => {
            await saveItemEdits(selectedItem.id, { charges });
          }}
        />
      ) : null}
    </CollapsiblePanel>
  );
}

