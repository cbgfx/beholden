import { useCallback, useEffect, useState } from "react";
import { useDebouncedSingleflight } from "@beholden/shared/ui";
import { api } from "@/services/api";
import {
  fetchPartyInventory,
  fetchPartyInventoryItem,
  fetchPartyCurrency,
  type PartyCurrencyMap,
} from "@/services/inventoryApi";
import { useWs } from "@/services/ws";
import {
  getEquipState,
  initializeItemUsesMaximum,
  isCurrencyItem,
  normalizeInventoryItemLookupName,
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
  const [partyCapacityLbs, setPartyCapacityLbs] = useState<number | null>(null);
  const [partyCurrency, setPartyCurrency] = useState<PartyCurrencyMap>({ PP: 0, GP: 0, SP: 0, CP: 0 });

  const fetchPartyStash = useCallback(() => {
    if (!campaignId) return;
    fetchPartyInventory(campaignId)
      .then(({ items, partyCapacityLbs }) => {
        setPartyStashItems(items as PartyStashItem[]);
        setPartyCapacityLbs(partyCapacityLbs);
      })
      .catch(() => {});
  }, [campaignId]);

  const fetchCurrency = useCallback(() => {
    if (!campaignId) return;
    fetchPartyCurrency(campaignId).then(setPartyCurrency).catch(() => {});
  }, [campaignId]);
  const enqueuePartyStashRefresh = useDebouncedSingleflight(fetchPartyStash);

  useEffect(() => { fetchPartyStash(); }, [fetchPartyStash]);
  useEffect(() => { fetchCurrency(); }, [fetchCurrency]);

  useWs(useCallback((message) => {
    if (message.type === "partyCurrency:delta") {
      const payload = (message.payload ?? {}) as { campaignId?: string };
      if (payload.campaignId === campaignId) fetchCurrency();
      return;
    }
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
  }, [campaignId, enqueuePartyStashRefresh, fetchCurrency]));

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
        const chargesMax = item.chargesMax ?? initializeItemUsesMaximum(summary.uses);
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
          mastery: item.mastery ?? summary.mastery ?? null,
          modifiers: item.modifiers?.length ? item.modifiers : (summary.modifiers ?? []),
          uses: item.uses ?? summary.uses ?? null,
          spells: item.spells ?? summary.spells ?? null,
          spellcasting: item.spellcasting ?? summary.spellcasting ?? null,
          spellTemplate: item.spellTemplate ?? summary.spellTemplate ?? null,
          ammo: item.ammo ?? summary.ammo ?? null,
          weaponAmmo: item.weaponAmmo ?? summary.weaponAmmo ?? null,
          usage: item.usage ?? summary.usage ?? null,
          effects: item.effects ?? summary.effects ?? null,
          chargesMax,
          charges: item.charges ?? chargesMax,
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
        const result = await api<{ rows: Array<{ id: string; text?: string[] | null; uses?: import("@/views/character/CharacterInventory").ItemUses | null; spells?: import("@/views/character/CharacterInventory").ItemSpells | null; spellcasting?: import("@/views/character/CharacterInventory").ItemSpellcasting | null; spellTemplate?: import("@/views/character/CharacterInventory").ItemSpellTemplates | null; ammo?: import("@/views/character/CharacterInventory").AmmoFamily | null; weaponAmmo?: import("@/views/character/CharacterInventory").AmmoFamily | null; usage?: "held" | null }> }>("/api/compendium/items/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, includeText: true }),
        });
        if (!active) return;
        const details = new Map(
          (result.rows ?? []).map((row) => [row.id, { description: Array.isArray(row.text) ? row.text.join("\n\n").trim() : "", uses: row.uses ?? null, spells: row.spells ?? null, spellcasting: row.spellcasting ?? null, spellTemplate: row.spellTemplate ?? null, ammo: row.ammo ?? null, weaponAmmo: row.weaponAmmo ?? null, usage: row.usage ?? null }]),
        );
        const updated = items.map((item) => {
          const detail = details.get(String(item.itemId ?? ""));
          if (!detail?.description) return item;
          const uses = item.uses ?? detail.uses;
          const chargesMax = item.chargesMax ?? initializeItemUsesMaximum(uses);
          return { ...item, description: detail.description, uses, spells: item.spells ?? detail.spells, spellcasting: item.spellcasting ?? detail.spellcasting, spellTemplate: item.spellTemplate ?? detail.spellTemplate, ammo: item.ammo ?? detail.ammo, weaponAmmo: item.weaponAmmo ?? detail.weaponAmmo, usage: item.usage ?? detail.usage, chargesMax, charges: item.charges ?? chargesMax };
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
    partyCapacityLbs, partyCurrency, setPartyCurrency,
  };
}

export type CharacterInventorySyncState = ReturnType<typeof useCharacterInventorySync>;
