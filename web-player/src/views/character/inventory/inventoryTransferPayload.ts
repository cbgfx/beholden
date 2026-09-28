import type { InventoryItem } from "@/views/character/inventory/CharacterInventoryTypes";

/**
 * Party-stash transfers carry the *item*, not the holder's relationship to it.
 * These fields describe where/how a specific character was using the item and
 * must be reset when it lands on a new sheet — never carried through the stash.
 */
const CHARACTER_SPECIFIC_KEYS = new Set<keyof InventoryItem>([
  "id",
  "equipped",
  "equipState",
  "containerId",
  "attuned",
  "pactWeapon",
  "linkedAmmoId",
]);

/**
 * The full portable state of an inventory item: everything except the
 * character-specific keys above. Edited damage/AC, remaining charges, stored
 * spells, custom properties, and notes all travel with it.
 */
export function toInventoryTransferPayload(item: InventoryItem): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (value === undefined) continue;
    if (CHARACTER_SPECIFIC_KEYS.has(key as keyof InventoryItem)) continue;
    payload[key] = value;
  }
  return payload;
}

export interface TransferFallback {
  name: string;
  quantity: number;
  weight?: number | null;
  notes?: string;
  rarity?: string | null;
  type?: string | null;
  description?: string | null;
  source?: "compendium" | "custom" | null;
  itemId?: string | null;
}

/**
 * Rebuild a character inventory item from a stash row. A row created by a
 * transfer carries the full `payload`; a legacy or plain row only has the flat
 * summary in `fallback`. Character-specific state is always reset.
 */
export function fromInventoryTransferPayload(
  payload: Record<string, unknown> | null | undefined,
  fallback: TransferFallback,
  overrides: { id: string; containerId: string },
): InventoryItem {
  const base = payload && typeof payload === "object" ? { ...payload } : {};
  // Never inherit the previous holder's relationship to the item.
  for (const key of CHARACTER_SPECIFIC_KEYS) delete (base as Record<string, unknown>)[key];

  // Fields with their own `party_inventory` column are live and editable (the
  // stepper, a DM edit, `changePartyStashQty`) — the current row value wins over
  // whatever the payload captured at deposit. Fields with no column (edited
  // damage, remaining charges, stored spells, …) come from the payload.
  const live: Record<string, unknown> = {
    name: fallback.name,
    quantity: Math.max(1, Number(fallback.quantity) || 1),
  };
  if (fallback.weight !== undefined) live.weight = fallback.weight;
  if (fallback.notes !== undefined) live.notes = fallback.notes;
  if (fallback.rarity !== undefined) live.rarity = fallback.rarity;
  if (fallback.type !== undefined) live.type = fallback.type;
  if (fallback.description !== undefined) live.description = fallback.description;
  if (fallback.source !== undefined) live.source = fallback.source;
  if (fallback.itemId !== undefined) live.itemId = fallback.itemId;

  return {
    ...base,
    ...live,
    id: overrides.id,
    equipped: false,
    equipState: "backpack",
    containerId: overrides.containerId,
  } as InventoryItem;
}

/**
 * Whether an item carries character-authored detail that makes it distinct from
 * a plain catalog stack — used to decide when a transfer must NOT merge it into
 * an existing stack (which would silently drop that detail).
 */
export function hasCustomTransferState(
  item: Pick<
    InventoryItem,
    | "notes" | "dmg1" | "dmg2" | "dmgType" | "ac" | "mastery" | "modifiers"
    | "storedSpells" | "spells" | "spellcasting" | "spellTemplate" | "effects"
    | "chargesMax" | "charges"
  >,
): boolean {
  // `description` is deliberately excluded — catalog enrichment fills it in for
  // ordinary compendium items, so it isn't player-authored detail and must not
  // fragment otherwise-mergeable stacks.
  if (item.notes && item.notes.trim()) return true;
  if (item.dmg1 || item.dmg2 || item.dmgType || item.mastery) return true;
  if (item.ac != null) return true;
  if (Array.isArray(item.modifiers) && item.modifiers.length > 0) return true;
  if (Array.isArray(item.storedSpells) && item.storedSpells.length > 0) return true;
  if (item.spells || item.spellcasting || item.spellTemplate) return true;
  if (Array.isArray(item.effects) && item.effects.length > 0) return true;
  // A charged item that isn't at full charges carries state worth preserving.
  if (item.chargesMax != null && item.charges != null && item.charges !== item.chargesMax) return true;
  return false;
}
