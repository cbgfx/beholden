import {
  getEquipState,
  isCurrencyItem,
  totalInventoryWeight,
  type InventoryContainer,
  type InventoryItem,
} from "@/views/character/CharacterInventory";
import { DEFAULT_CONTAINER_ID } from "@/views/character/CharacterInventoryPanelHelpers";

export type CurrencyCode = "PP" | "GP" | "EP" | "SP" | "CP";

const EMPTY_CURRENCY_TOTALS: Record<CurrencyCode, number> = {
  PP: 0,
  GP: 0,
  EP: 0,
  SP: 0,
  CP: 0,
};

export function deriveInventoryDisplayState({
  items,
  containers,
  strengthScore,
  selectedItemId,
}: {
  items: InventoryItem[];
  containers: InventoryContainer[];
  strengthScore: number | null | undefined;
  selectedItemId: string | null;
}) {
  const equipped = items.filter((item) => getEquipState(item) !== "backpack");
  const currencyTotals = items.reduce<Record<CurrencyCode, number>>((totals, item) => {
    const code = String(item.name ?? "").trim().toUpperCase();
    if (code in totals) {
      totals[code as CurrencyCode] += Math.max(0, item.quantity || 0);
    }
    return totals;
  }, { ...EMPTY_CURRENCY_TOTALS });

  const knownContainerIds = new Set(containers.map((container) => container.id));
  const itemsByContainer = new Map<string, InventoryItem[]>();
  for (const item of items) {
    if (getEquipState(item) !== "backpack" || isCurrencyItem(item)) continue;
    const containerId = item.containerId && knownContainerIds.has(item.containerId)
      ? item.containerId
      : DEFAULT_CONTAINER_ID;
    const containerItems = itemsByContainer.get(containerId) ?? [];
    containerItems.push(item.containerId === containerId ? item : { ...item, containerId });
    itemsByContainer.set(containerId, containerItems);
  }

  const carriedWeight = totalInventoryWeight(items, containers);
  const carryCapacity = Math.max(0, strengthScore ?? 0) * 15;
  const selectedItem = selectedItemId
    ? items.find((item) => item.id === selectedItemId) ?? null
    : null;
  const otherAttunedCount = items.filter((item) => item.attuned && item.id !== selectedItem?.id).length;

  return {
    equipped,
    currencyTotals,
    itemsByContainer,
    carriedWeight,
    carryCapacity,
    overCapacity: carryCapacity > 0 && carriedWeight > carryCapacity,
    selectedItem,
    otherAttunedCount,
  };
}
