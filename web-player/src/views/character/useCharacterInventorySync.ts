import { useCallback, useEffect, useState } from "react";
import { useDebouncedSingleflight } from "@beholden/shared/ui";
import { api } from "@/services/api";
import { fetchPartyInventory, fetchPartyInventoryItem } from "@/services/inventoryApi";
import { useWs } from "@/services/ws";
import {
  getEquipState,
  isCurrencyItem,
  normalizeInventoryItemLookupName,
  parseChargesMax,
  type CompendiumItemDetail,
  type InventoryContainer,
  type InventoryItem,
  type ItemSummaryRow,
} from "@/views/character/CharacterInventory";
import {
  matchInventorySummary,
  normalizeContainers,
  singularizeInventoryLookupName,
} from "@/views/character/CharacterInventoryPanelHelpers";
import type { PartyStashItem } from "@/views/character/CharacterInventoryPanelRows";

export interface InventoryPersistencePayload {
  inventory: InventoryItem[];
  inventoryContainers: InventoryContainer[];
}

export function useCharacterInventorySync({
  inventory,
  inventoryContainers,
  campaignId,
  onSave,
}: {
  inventory: InventoryItem[] | undefined;
  inventoryContainers: InventoryContainer[] | undefined;
  campaignId?: string | null;
  onSave: (data: InventoryPersistencePayload) => Promise<unknown>;
}) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    (inventory ?? []).map((item) => ({ ...item, equipState: getEquipState(item), properties: item.properties ?? [] }))
  );
  const [containers, setContainers] = useState(() => normalizeContainers(inventoryContainers));
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
      .then((result) => setPartyStashItems(result as PartyStashItem[]))
      .catch(() => {});
  }, [campaignId]);
  const enqueuePartyStashRefresh = useDebouncedSingleflight(fetchPartyStash);

  useEffect(() => { fetchPartyStash(); }, [fetchPartyStash]);
  useWs(useCallback((message) => {
    if (message.type !== "partyInventory:delta") return;
    const payload = (message.payload ?? {}) as {
      campaignId?: string;
      action?: "upsert" | "delete" | "refresh";
      itemId?: string;
    };
    if (payload.campaignId !== campaignId) return;
    if (payload.action === "delete" && payload.itemId) {
      setPartyStashItems((previous) => previous.filter((item) => item.id !== payload.itemId));
      return;
    }
    if (payload.action === "upsert" && payload.itemId && campaignId) {
      void fetchPartyInventoryItem(campaignId, payload.itemId)
        .then((item) => {
          setPartyStashItems((previous) => {
            const index = previous.findIndex((entry) => entry.id === item.id);
            if (index === -1) return [...previous, item as PartyStashItem];
            const next = previous.slice();
            next[index] = item as PartyStashItem;
            return next;
          });
        })
        .catch(enqueuePartyStashRefresh);
      return;
    }
    enqueuePartyStashRefresh();
  }, [campaignId, enqueuePartyStashRefresh]));

  useEffect(() => {
    setItems((inventory ?? []).map((item) => ({
      ...item,
      equipState: getEquipState(item),
      properties: item.properties ?? [],
    })));
  }, [inventory]);
  useEffect(() => setContainers(normalizeContainers(inventoryContainers)), [inventoryContainers]);

  useEffect(() => {
    const ids = Array.from(new Set(items.map((item) => String(item.itemId ?? "").trim()).filter(Boolean))).sort();
    const names = Array.from(new Set(
      items
        .filter((item) => !item.itemId && item.source !== "custom" && !isCurrencyItem(item))
        .map((item) => String(item.name ?? "").trim())
        .filter(Boolean),
    )).sort();
    if (ids.length === 0 && names.length === 0) {
      setItemIndex([]);
      return;
    }
    let active = true;
    api<{ rows: ItemSummaryRow[] }>("/api/compendium/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, names }),
    })
      .then((result) => { if (active) setItemIndex(Array.isArray(result?.rows) ? result.rows : []); })
      .catch(() => { if (active) setItemIndex([]); });
    return () => { active = false; };
  }, [items]);

  useEffect(() => {
    if (itemIndex.length === 0) return;
    setItems((previous) => {
      let changed = false;
      const next = previous.map((item) => {
        const summary = matchInventorySummary(item, itemIndex);
        if (!summary) return item;
        const patched: InventoryItem = {
          ...item,
          name: item.source === "custom" && !item.itemId
            ? item.name
            : summary.name.replace(/\s+\[(?:2024|5\.5e)\]\s*$/i, "").trim(),
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
        if (JSON.stringify(patched) !== JSON.stringify(item)) {
          changed = true;
          return patched;
        }
        return item;
      });
      return changed ? next : previous;
    });
  }, [itemIndex]);

  useEffect(() => {
    const missingDescriptions = items.filter(
      (item) => item.itemId && item.source !== "custom" && !String(item.description ?? "").trim()
    );
    if (missingDescriptions.length === 0) return;
    let active = true;
    void (async () => {
      try {
        const ids = Array.from(new Set(missingDescriptions.map((item) => String(item.itemId ?? "")).filter(Boolean)));
        const result = await api<{ rows: Array<{ id: string; text?: string[] | null }> }>("/api/compendium/items/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, includeText: true }),
        });
        if (!active) return;
        const descriptions = new Map(
          (result.rows ?? []).map((row) => [row.id, Array.isArray(row.text) ? row.text.join("\n\n").trim() : ""]),
        );
        const updated = items.map((item) => {
          const description = descriptions.get(String(item.itemId ?? ""));
          if (!description) return item;
          const chargesMax = item.chargesMax ?? parseChargesMax(description) ?? null;
          return { ...item, description, chargesMax, charges: item.charges ?? chargesMax };
        });
        if (!updated.some((item, index) => item !== items[index])) return;
        const normalized = normalizeContainers(containers);
        setItems(updated);
        await onSave({ inventory: updated, inventoryContainers: normalized });
      } catch {
        // Inventory remains usable without enriched descriptions.
      }
    })();
    return () => { active = false; };
  }, [items, containers, onSave]);

  useEffect(() => {
    if (!expandedItemId) {
      setExpandedDetail(null);
      setExpandedBusy(false);
      setItemEditMode(false);
      return;
    }
    const item = items.find((entry) => entry.id === expandedItemId);
    if (!item) return;
    const normalized = normalizeInventoryItemLookupName(item.name);
    const singular = normalizeInventoryItemLookupName(singularizeInventoryLookupName(item.name));
    const summary = item.itemId
      ? itemIndex.find((entry) => entry.id === item.itemId)
      : itemIndex.find((entry) => normalizeInventoryItemLookupName(entry.name) === normalized)
        ?? itemIndex.find((entry) => normalizeInventoryItemLookupName(entry.name) === singular);
    if (!summary) {
      setExpandedDetail(null);
      setExpandedBusy(false);
      return;
    }
    const cached = expandedDetailCache[summary.id];
    if (cached) {
      setExpandedDetail(cached);
      setExpandedBusy(false);
      return;
    }
    let active = true;
    setExpandedBusy(true);
    api<CompendiumItemDetail>(`/api/compendium/items/${summary.id}`)
      .then((detail) => {
        if (!active) return;
        setExpandedDetail(detail);
        setExpandedDetailCache((previous) => ({ ...previous, [summary.id]: detail }));
      })
      .catch(() => { if (active) setExpandedDetail(null); })
      .finally(() => { if (active) setExpandedBusy(false); });
    return () => { active = false; };
  }, [expandedItemId, expandedDetailCache, itemIndex, items]);

  return {
    items, setItems, containers, setContainers, pickerOpen, setPickerOpen, saving, setSaving,
    itemIndex, expandedItemId, setExpandedItemId, collapsedContainerIds, setCollapsedContainerIds,
    expandedDetail, expandedBusy, itemEditMode, setItemEditMode, partyStashItems, setPartyStashItems,
  };
}

export type CharacterInventorySyncState = ReturnType<typeof useCharacterInventorySync>;
