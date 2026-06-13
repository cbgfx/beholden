import type React from "react";
import type { InventoryContainer, InventoryItem, ItemSummaryRow } from "@/views/character/CharacterInventory";
import { isArmorItem, isWearableItem, isWeaponItem, normalizeInventoryItemLookupName } from "@/views/character/CharacterInventory";

export const INVENTORY_PICKER_ROW_HEIGHT = 52;
export const DEFAULT_CONTAINER_ID = "backpack-default";
export const PARTY_STASH_CONTAINER_ID = "party-stash";

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function singularizeInventoryLookupName(name: string): string {
  const trimmed = String(name ?? "").trim();
  const lowered = trimmed.toLowerCase();
  if (lowered === "daggers") return "Dagger";
  if (/ies$/i.test(trimmed)) return `${trimmed.slice(0, -3)}y`;
  if (/es$/i.test(trimmed) && /(ches|shes|sses|xes|zes)$/i.test(trimmed)) return trimmed.slice(0, -2);
  if (/s$/i.test(trimmed) && !/ss$/i.test(trimmed)) return trimmed.slice(0, -1);
  return trimmed;
}

export function matchInventorySummary(item: InventoryItem, itemIndex: ItemSummaryRow[]): ItemSummaryRow | null {
  if (item.itemId) return itemIndex.find((row) => row.id === item.itemId) ?? null;
  const normalized = normalizeInventoryItemLookupName(item.name);
  const singularNormalized = normalizeInventoryItemLookupName(singularizeInventoryLookupName(item.name));
  return itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === normalized)
    ?? itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === singularNormalized)
    ?? null;
}

function defaultContainer(): InventoryContainer {
  return { id: DEFAULT_CONTAINER_ID, name: "Backpack", ignoreWeight: false };
}

export function normalizeContainers(containers: InventoryContainer[] | null | undefined): InventoryContainer[] {
  const list = Array.isArray(containers) ? containers.filter(Boolean) : [];
  const hasDefault = list.some((container) => container.id === DEFAULT_CONTAINER_ID);
  const next = hasDefault ? list : [defaultContainer(), ...list];
  return next.map((container) => ({
    id: container.id,
    name: String(container.name ?? "").trim() || (container.id === DEFAULT_CONTAINER_ID ? "Backpack" : "Container"),
    ignoreWeight: Boolean(container.ignoreWeight),
  }));
}

export const subLabelStyle: React.CSSProperties = {
  fontSize: "var(--fs-tiny)",
  fontWeight: 700,
  color: "var(--c-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 6,
};

export const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 7,
  padding: "6px 10px",
  color: "var(--c-text)",
  fontSize: "var(--fs-subtitle)",
  outline: "none",
};

export const stepperBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 4,
  width: 20,
  height: 20,
  color: "var(--c-muted)",
  cursor: "pointer",
  fontSize: "var(--fs-subtitle)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
};

export interface PackContentEntry {
  name: string;
  quantity: number;
}

function singularizeLoose(name: string): string {
  const n = String(name ?? "").trim();
  if (!n) return n;
  if (/tools$/i.test(n)) return n;
  if (/ies$/i.test(n)) return `${n.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/i.test(n)) return n.slice(0, -2);
  if (/s$/i.test(n) && !/ss$/i.test(n)) return n.slice(0, -1);
  return n;
}

function normalizePackItemName(raw: string): string {
  let name = String(raw ?? "").trim().replace(/\.$/, "");
  name = name.replace(/^(?:and|or)\s+/i, "");
  name = name.replace(/^an?\s+/i, "");
  name = name.replace(/^(?:set|pair)\s+of\s+/i, "");
  name = name.replace(/^(?:flasks?|vials?|sheets?|sticks?|pieces?|pounds?|days?)\s+of\s+/i, "");
  return name.trim();
}

function splitPackListText(listText: string): string[] {
  const base = String(listText ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");
  if (!base) return [];
  return base
    .split(/\s*,\s*/g)
    .flatMap((part, index, all) => (index === all.length - 1 ? part.split(/\s+and\s+/i) : [part]))
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parsePackContentsFromDescription(description: string): PackContentEntry[] {
  const raw = String(description ?? "");
  if (!raw) return [];
  const listMatch = raw.match(/\bpack contains the following items:\s*([\s\S]*?)(?:\n\s*Source:|Source:|$)/i);
  if (!listMatch?.[1]) return [];
  const tokens = splitPackListText(listMatch[1]);
  if (tokens.length === 0) return [];
  return tokens
    .map((token) => {
      const qtyMatch = token.match(/^(\d[\d,]*)\s+(.+)$/);
      const quantity = qtyMatch ? Math.max(1, Number(qtyMatch[1].replace(/,/g, "")) || 1) : 1;
      const rawName = qtyMatch ? qtyMatch[2] : token;
      let name = normalizePackItemName(rawName);
      if (quantity > 1) name = singularizeLoose(name);
      if (/^backpacks?$/i.test(name)) return null;
      return { name, quantity } satisfies PackContentEntry;
    })
    .filter((entry): entry is PackContentEntry => Boolean(entry?.name));
}

export function inferStackKey(item: Pick<InventoryItem, "name" | "itemId" | "type">): string {
  const itemId = String(item.itemId ?? "").trim();
  if (itemId) return `id:${itemId.toLowerCase()}`;
  const normalizedName = normalizeInventoryItemLookupName(singularizeInventoryLookupName(item.name));
  const normalizedType = String(item.type ?? "").trim().toLowerCase();
  return `name:${normalizedName}|type:${normalizedType}`;
}

export function isStackableItem(item: InventoryItem): boolean {
  return !isWeaponItem(item) && !isArmorItem(item) && !isWearableItem(item);
}

export function mergeStackedInventoryItem(existing: InventoryItem, incoming: InventoryItem): InventoryItem {
  return {
    ...existing,
    quantity: Math.max(1, existing.quantity) + Math.max(1, incoming.quantity),
    source: existing.source ?? incoming.source,
    itemId: existing.itemId ?? incoming.itemId,
    rarity: existing.rarity ?? incoming.rarity ?? null,
    type: existing.type ?? incoming.type ?? null,
    weight: existing.weight ?? incoming.weight ?? null,
    description: existing.description ?? incoming.description,
    notes: existing.notes ?? incoming.notes,
  };
}
