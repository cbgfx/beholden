import type React from "react";
import type { InventoryContainer, InventoryItem, ItemSummaryRow } from "@/views/character/CharacterInventory";
import { normalizeInventoryItemLookupName } from "@/views/character/CharacterInventory";

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

export function defaultContainer(): InventoryContainer {
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
