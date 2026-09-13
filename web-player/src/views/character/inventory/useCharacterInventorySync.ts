import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { usePartyInventorySync } from "./usePartyInventorySync";
import {
  getEquipState,
  initializeItemUsesMaximum,
  isCurrencyItem,
  mergeCatalogItem,
  resolveItemUses,
  normalizeInventoryItemLookupName,
  type CompendiumItemDetail,
  type InventoryContainer,
  type InventoryItem,
  type ItemSummaryRow,
} from "@/views/character/inventory/CharacterInventory";
import {
  matchInventorySummary,
  normalizeContainers,
  singularizeInventoryLookupName,
} from "@/views/character/inventory/CharacterInventoryPanelHelpers";


export interface InventoryPersistencePayload {
  inventory: InventoryItem[];
  inventoryContainers: InventoryContainer[];
}

export function useCharacterInventorySync({
  inventoryRev,
  inventory,
  inventoryContainers,
  campaignId,
  onSave,
}: {
  inventoryRev?: string;
  inventory: InventoryItem[] | undefined;
  inventoryContainers: InventoryContainer[] | undefined;
  campaignId?: string | null;
  onSave: (data: InventoryPersistencePayload, opts?: { expectedInventoryRev?: string }) => Promise<unknown>;
}) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    (inventory ?? []).map((item) => ({ ...item, equipState: getEquipState(item), properties: item.properties ?? [] }))
  );
  const [containers, setContainers] = useState(() => normalizeContainers(inventoryContainers, inventory));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemIndex, setItemIndex] = useState<ItemSummaryRow[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [collapsedContainerIds, setCollapsedContainerIds] = useState<string[]>([]);
  const [expandedDetail, setExpandedDetail] = useState<CompendiumItemDetail | null>(null);
  const [expandedBusy, setExpandedBusy] = useState(false);
  const [expandedDetailCache, setExpandedDetailCache] = useState<Record<string, CompendiumItemDetail>>({});
  const [itemEditMode, setItemEditMode] = useState(false);
  // Set when a save is rejected because the stored inventory changed under us
  // (another device, or a DM treasure award). Cleared by the next clean save.
  const [conflict, setConflict] = useState<string | null>(null);
  const { partyStashItems, setPartyStashItems, partyCapacityLbs, partyCurrency, savePartyCurrency } = usePartyInventorySync(campaignId);

  useEffect(() => {
    setItems((inventory ?? []).map((item) => ({
      ...item,
      equipState: getEquipState(item),
      properties: item.properties ?? [],
    })));
  }, [inventory]);
  useEffect(() => {
    const normalized = normalizeContainers(inventoryContainers, inventory);
    setContainers(normalized);
    if (inventoryRev && JSON.stringify(normalized) !== JSON.stringify(inventoryContainers ?? [])) {
      void onSave({ inventory: inventory ?? [], inventoryContainers: normalized }, { expectedInventoryRev: inventoryRev })
        .catch(() => { /* A rejected normalization must not overwrite the saved inventory. */ });
    }
  }, [inventory, inventoryContainers, inventoryRev, onSave]);

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
        const resolvedUses = resolveItemUses(summary.id, summary.uses);
        const chargesMax = initializeItemUsesMaximum(resolvedUses) ?? item.chargesMax ?? null;
        const patched = mergeCatalogItem(item, { ...summary, uses: resolvedUses }, chargesMax);
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
        const result = await api<{ rows: Array<{ id: string; text?: string[] | null; uses?: import("@/views/character/inventory/CharacterInventory").ItemUses | null; spells?: import("@/views/character/inventory/CharacterInventory").ItemSpells | null; spellcasting?: import("@/views/character/inventory/CharacterInventory").ItemSpellcasting | null; spellTemplate?: import("@/views/character/inventory/CharacterInventory").ItemSpellTemplates | null; ammo?: import("@/views/character/inventory/CharacterInventory").AmmoFamily | null; weaponAmmo?: import("@/views/character/inventory/CharacterInventory").AmmoFamily | null; usage?: "held" | null }> }>("/api/compendium/items/lookup", {
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
        const normalized = normalizeContainers(containers, undefined);
        if (!inventoryRev) return;
        await onSave({ inventory: updated, inventoryContainers: normalized }, { expectedInventoryRev: inventoryRev });
        if (active) setItems(updated);
      } catch {
        // Inventory remains usable without enriched descriptions.
      }
    })();
    return () => { active = false; };
  }, [items, containers, inventoryRev, onSave]);

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
    partyCapacityLbs, partyCurrency, savePartyCurrency, conflict, setConflict,
  };
}

export type CharacterInventorySyncState = ReturnType<typeof useCharacterInventorySync>;
