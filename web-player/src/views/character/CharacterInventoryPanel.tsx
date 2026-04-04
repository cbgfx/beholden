import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, jsonInit } from "@/services/api";
import { createPartyInventoryItem, fetchPartyInventory, updatePartyInventoryQuantity } from "@/services/inventoryApi";
import { useWs } from "@/services/ws";
import { C, withAlpha } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import { Select } from "@/ui/Select";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import { useItemSearch } from "@/views/CompendiumView/hooks/useItemSearch";
import {
  DEFAULT_CONTAINER_ID,
  INVENTORY_PICKER_ROW_HEIGHT,
  PARTY_STASH_CONTAINER_ID,
  inputStyle,
  matchInventorySummary,
  normalizeContainers,
  singularizeInventoryLookupName,
  stepperBtn,
  subLabelStyle,
  uid,
} from "@/views/character/CharacterInventoryPanelHelpers";
import { InventoryItemDrawer } from "@/views/character/CharacterInventoryDrawer";
import { InventoryItemPickerModal } from "@/views/character/CharacterInventoryPickerModal";
import { InventoryStat, InventoryTag, ItemRow, PartyStashItemRow, type PartyStashItem } from "@/views/character/CharacterInventoryPanelRows";
import {
  CollapsiblePanel,
  addBtnStyle,
  cancelBtnStyle,
  inventoryCheckboxLabel,
  inventoryEquipBtn,
  inventoryPickerColumnStyle,
  inventoryPickerDetailStyle,
  inventoryPickerListStyle,
  inventoryRarityColor,
  panelHeaderAddBtn,
  toggleFilterPill,
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
  formatItemDamageType,
  formatItemProperties,
  formatWeight,
  getEquipState,
  hasStealthDisadvantage,
  isCurrencyItem,
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
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [itemIndex, setItemIndex] = useState<ItemSummaryRow[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [collapsedContainerIds, setCollapsedContainerIds] = useState<string[]>([]);
  const [expandedDetail, setExpandedDetail] = useState<CompendiumItemDetail | null>(null);
  const [expandedBusy, setExpandedBusy] = useState(false);
  const [itemEditMode, setItemEditMode] = useState(false);
  const [currencyPopupCode, setCurrencyPopupCode] = useState<"PP" | "GP" | "SP" | "CP" | null>(null);
  const [currencyInput, setCurrencyInput] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const currencyPopupRef = useRef<HTMLDivElement | null>(null);
  const [partyStashItems, setPartyStashItems] = useState<PartyStashItem[]>([]);

  const fetchPartyStash = useCallback(() => {
    if (!campaignId) return;
    fetchPartyInventory(campaignId)
      .then((items) => setPartyStashItems(items as PartyStashItem[]))
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => { fetchPartyStash(); }, [fetchPartyStash]);

  useWs(useCallback((msg) => {
    if (msg.type === "partyInventory:changed") {
      const cId = (msg.payload as { campaignId?: string })?.campaignId;
      if (cId === campaignId) fetchPartyStash();
    }
  }, [campaignId, fetchPartyStash]));

  useEffect(() => {
    setContainers(normalizeContainers(charData?.inventoryContainers));
  }, [charData?.inventoryContainers]);

  useEffect(() => {
    let alive = true;
    api<ItemSummaryRow[]>("/api/compendium/items")
      .then((rows) => { if (alive) setItemIndex(rows ?? []); })
      .catch(() => { if (alive) setItemIndex([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!currencyPopupCode) return;
    function handlePointerDown(event: MouseEvent) {
      if (!currencyPopupRef.current) return;
      const target = event.target;
      if (target instanceof Node && !currencyPopupRef.current.contains(target)) {
        setCurrencyPopupCode(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [currencyPopupCode]);

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
        const details = await Promise.all(
          missingDescriptionItems.map(async (item) => {
            const detail = await api<CompendiumItemDetail>(`/api/compendium/items/${item.itemId}`);
            const description = Array.isArray(detail.text) ? detail.text.join("\n\n") : String(detail.text ?? "");
            return [item.id, description.trim()] as const;
          })
        );
        if (!alive) return;
        const descriptionByItemId = new Map(details);
        const updatedItems = items.map((item) => {
          const description = descriptionByItemId.get(item.id);
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

    let alive = true;
    setExpandedBusy(true);
    api<CompendiumItemDetail>(`/api/compendium/items/${matchedSummary.id}`)
      .then((detail) => { if (alive) setExpandedDetail(detail); })
      .catch(() => { if (alive) setExpandedDetail(null); })
      .finally(() => { if (alive) setExpandedBusy(false); });
    return () => { alive = false; };
  }, [expandedItemId, itemIndex, items]);

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
    const next = payload;
    if (!next?.name) return;
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
    await persist([...items, item], nextContainers);
    setPickerOpen(false);
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
    const newItem: InventoryItem = {
      id: uid(),
      name: stashItem.name,
      quantity: stashItem.quantity,
      equipped: false,
      equipState: "backpack",
      source: "custom",
      rarity: stashItem.rarity ?? null,
      type: stashItem.type ?? null,
      weight: stashItem.weight ?? null,
      containerId: DEFAULT_CONTAINER_ID,
    };
    await persist([...items, newItem]);
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
      if (state === "worn" && currentState === "worn") {
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
  const actionItems = equipped.filter((it) => isWeaponItem(it));
  const prof = charData?.proficiencies;
  const carriedWeight = totalInventoryWeight(items, containers);
  const strScore = Math.max(0, char.strScore ?? 0);
  const carryCapacity = strScore * 15;
  const overCapacity = carryCapacity > 0 && carriedWeight > carryCapacity;
  const selectedItem = expandedItemId ? items.find((it) => it.id === expandedItemId) ?? null : null;
  const otherAttunedCount = selectedItem
    ? items.filter((it) => it.id !== selectedItem.id && it.attuned).length
    : items.filter((it) => it.attuned).length;

  const emptyContainerStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px dashed rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: C.muted,
    fontSize: "var(--fs-small)",
    background: "rgba(255,255,255,0.02)",
  };

  return (
    <CollapsiblePanel
      title={<>Inventory{saving && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginLeft: 6, fontWeight: 400, textTransform: "none" }}>saving…</span>}</>}
      color={accentColor}
      storageKey="inventory"
      actions={<button type="button" onClick={() => setPickerOpen(true)} title="Add item" style={panelHeaderAddBtn(accentColor)}>+</button>}
    >

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
        padding: "0 2px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Currency
          </div>
          {(["PP", "GP", "SP", "CP"] as const).map((code) => (
            <div
              key={code}
              ref={currencyPopupCode === code ? currencyPopupRef : undefined}
              style={{ position: "relative" }}
            >
              <button
                type="button"
                onClick={() => {
                  setCurrencyInput(String(currencyTotals[code]));
                  setCurrencyPopupCode((current) => current === code ? null : code);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "var(--fs-small)",
                  color: C.text,
                  padding: "2px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: C.muted, fontWeight: 700 }}>{code}</span>
                <span style={{ fontWeight: 800, minWidth: 20, textAlign: "right" }}>{currencyTotals[code].toLocaleString()}</span>
              </button>
              {currencyPopupCode === code && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    zIndex: 20,
                    background: "#1e2030",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    minWidth: 210,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, marginBottom: 2 }}>Edit {code}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      value={currencyInput}
                      onChange={(e) => setCurrencyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void saveCurrencyAmount(code, Number(currencyInput));
                          setCurrencyPopupCode(null);
                        }
                        if (e.key === "Escape") setCurrencyPopupCode(null);
                      }}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: 6,
                        fontSize: "var(--fs-subtitle)",
                        fontWeight: 700,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.07)",
                        color: C.text,
                        outline: "none",
                        textAlign: "center",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void saveCurrencyAmount(code, Number(currencyInput));
                        setCurrencyPopupCode(null);
                      }}
                      style={addBtnStyle(accentColor)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: overCapacity ? C.red : C.muted }}>
          {formatWeight(carriedWeight)} / {formatWeight(carryCapacity)} lb
        </div>
      </div>

      {equipped.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={subLabelStyle}>Equipped</div>
          {equipped.map((it) => (
            <ItemRow key={it.id} item={it} accentColor={accentColor}
              charData={charData}
              parsedFeatureEffects={parsedFeatureEffects}
              expanded={expandedItemId === it.id}
              onToggleExpanded={toggleExpandedItem}
              onCycleMain={cycleMainHand}
              onToggleOffhand={toggleOffhand}
              onToggleWorn={toggleWorn}
              onRemove={removeItem} onQty={changeQty} />
          ))}
        </div>
      )}

      {containers.map((container) => {
        const containerItems = itemsByContainer.get(container.id) ?? [];
        const isDefault = container.id === DEFAULT_CONTAINER_ID;
        const isCollapsed = collapsedContainerIds.includes(container.id);
        return (
          <div key={container.id} style={{ marginBottom: 12 }}>
            <div
              onClick={(event) => {
                const target = event.target;
                if (target instanceof HTMLElement && target.closest("button, input, select, textarea, label")) return;
                toggleContainerCollapsed(container.id);
              }}
              style={{ ...subLabelStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    color: C.muted,
                    fontSize: "var(--fs-tiny)",
                    lineHeight: 1,
                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    transition: "transform 120ms ease",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 10,
                    flexShrink: 0,
                  }}
                >
                  ▼
                </span>
                <input
                  value={container.name}
                  onChange={(e) => {
                    setContainers((prev) => prev.map((entry) => entry.id === container.id ? { ...entry, name: e.target.value } : entry));
                  }}
                  onBlur={(e) => { void renameContainer(container.id, e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") {
                      setContainers(normalizeContainers(charData?.inventoryContainers ?? containers));
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px dashed rgba(255,255,255,0.12)",
                    color: C.muted,
                    fontSize: "var(--fs-tiny)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    minWidth: 110,
                    outline: "none",
                    padding: "0 0 2px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => { void toggleContainerIgnoreWeight(container.id); }}
                  style={toggleFilterPill(Boolean(container.ignoreWeight), accentColor)}
                >
                  Ignore Weight
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => { void addContainer(container.id); }}
                  title="Add container"
                  style={{ ...stepperBtn, width: 24, height: 24, fontSize: "var(--fs-body)" }}
                >
                  +
                </button>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => { void removeContainer(container.id); }}
                    title="Remove container"
                    style={{ ...stepperBtn, width: 24, height: 24, fontSize: "var(--fs-body)" }}
                  >
                    −
                  </button>
                )}
              </div>
            </div>
            {!isCollapsed && (containerItems.length > 0 ? containerItems.map((it) => (
              <ItemRow key={it.id} item={it} accentColor={accentColor}
                charData={charData}
                parsedFeatureEffects={parsedFeatureEffects}
                expanded={expandedItemId === it.id}
                onToggleExpanded={toggleExpandedItem}
                onCycleMain={cycleMainHand}
                onToggleOffhand={toggleOffhand}
                onToggleWorn={toggleWorn}
                onRemove={removeItem} onQty={changeQty} />
            )) : (
              <div style={emptyContainerStyle}>Empty.</div>
            ))}
          </div>
        );
      })}

      {/* Party Stash */}
      {campaignId && (() => {
        const stashCollapsed = collapsedContainerIds.includes(PARTY_STASH_CONTAINER_ID);
        return (
          <div style={{ marginBottom: 12 }}>
            <div
              onClick={() => toggleContainerCollapsed(PARTY_STASH_CONTAINER_ID)}
              style={{ ...subLabelStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              <span
                aria-hidden="true"
                style={{
                  color: C.muted,
                  fontSize: "var(--fs-tiny)",
                  lineHeight: 1,
                  transform: stashCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  transition: "transform 120ms ease",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 10,
                  flexShrink: 0,
                }}
              >▼</span>
              Party Stash
              <span style={{ fontWeight: 400, color: C.muted, textTransform: "none", letterSpacing: 0, fontSize: "var(--fs-tiny)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>— shared</span>
            </div>
            {!stashCollapsed && (partyStashItems.length === 0 ? (
              <div style={emptyContainerStyle}>
                Empty. Move an item here to share it with the party.
              </div>
            ) : (
              partyStashItems.map((it) => (
                <PartyStashItemRow
                  key={it.id}
                  item={it}
                  onTake={() => void takeFromPartyStash(it)}
                  onDelete={() => void deleteFromPartyStash(it.id).then(fetchPartyStash)}
                  onQuantity={(q) => void changePartyStashQty(it.id, q).then(fetchPartyStash)}
                />
              ))
            ))}
          </div>
        );
      })()}

      {/* Inventory add controls */}
      {false ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: items.length > 0 ? 10 : 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={nameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              placeholder="Item name…"
              autoFocus
              style={inputStyle}
            />
            <input
              type="number"
              value={newQty}
              min={1}
              onChange={(e) => setNewQty(Number(e.target.value))}
              style={{ ...inputStyle, width: 56, textAlign: "center" }}
            />
          </div>
          <input
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)…"
            style={{ ...inputStyle, fontSize: "var(--fs-small)", color: C.muted }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { void addItem(); }} disabled={!newName.trim()} style={addBtnStyle(accentColor)}>
              Add
            </button>
            <button onClick={() => { setAdding(false); setNewName(""); setNewQty(1); setNewNotes(""); }} style={cancelBtnStyle}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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
