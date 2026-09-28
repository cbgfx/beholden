type InventoryRecord = Record<string, unknown>;

export interface InventoryValidationProblem {
  code: "invalid-inventory";
  message: string;
}

const record = (value: unknown): InventoryRecord | null =>
  value != null && typeof value === "object" && !Array.isArray(value) ? value as InventoryRecord : null;

const validId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 128;

/** Validates the player-owned inventory state at every server write boundary. */
export function inventoryValidationProblem(characterData: Record<string, unknown> | null | undefined): InventoryValidationProblem | null {
  if (!characterData) return null;
  const rawItems = characterData.inventory;
  const rawContainers = characterData.inventoryContainers;
  if (rawItems !== undefined && !Array.isArray(rawItems)) return { code: "invalid-inventory", message: "Inventory must be a list." };
  if (rawContainers !== undefined && !Array.isArray(rawContainers)) return { code: "invalid-inventory", message: "Inventory containers must be a list." };
  const items = (rawItems ?? []) as unknown[];
  const containers = (rawContainers ?? []) as unknown[];
  if (items.length > 5000 || containers.length > 500) return { code: "invalid-inventory", message: "Inventory is too large." };

  const containerIds = new Set<string>();
  for (const raw of containers) {
    const container = record(raw);
    if (!container || !validId(container.id)) return { code: "invalid-inventory", message: "Every inventory container needs a valid id." };
    if (containerIds.has(container.id)) return { code: "invalid-inventory", message: `Duplicate inventory container id: ${container.id}.` };
    containerIds.add(container.id);
    if (typeof container.name !== "string" || !container.name.trim() || container.name.length > 200) {
      return { code: "invalid-inventory", message: `Inventory container ${container.id} needs a valid name.` };
    }
  }

  const itemIds = new Set<string>();
  const itemById = new Map<string, InventoryRecord>();
  let attunedCount = 0;
  const occupiedHands = new Set<string>();
  for (const raw of items) {
    const item = record(raw);
    if (!item || !validId(item.id)) return { code: "invalid-inventory", message: "Every inventory item needs a valid id." };
    if (itemIds.has(item.id)) return { code: "invalid-inventory", message: `Duplicate inventory item id: ${item.id}.` };
    itemIds.add(item.id);
    itemById.set(item.id, item);
    if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 500) {
      return { code: "invalid-inventory", message: `Inventory item ${item.id} needs a valid name.` };
    }
    if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 1_000_000)) {
      return { code: "invalid-inventory", message: `${item.name} has an invalid quantity.` };
    }
    if (item.containerId != null && (!validId(item.containerId) || !containerIds.has(item.containerId))) {
      return { code: "invalid-inventory", message: `${item.name} refers to a missing inventory container.` };
    }
    const chargesMax = item.chargesMax;
    const charges = item.charges;
    if (chargesMax != null && (!Number.isInteger(chargesMax) || Number(chargesMax) < 0 || Number(chargesMax) > 1_000_000)) {
      return { code: "invalid-inventory", message: `${item.name} has an invalid maximum charge count.` };
    }
    if (charges != null && (!Number.isInteger(charges) || Number(charges) < 0 || Number(charges) > 1_000_000 || (chargesMax != null && Number(charges) > Number(chargesMax)))) {
      return { code: "invalid-inventory", message: `${item.name} has an invalid charge count.` };
    }
    if (item.attuned === true) attunedCount += 1;
    const equipState = item.equipState;
    if (equipState != null && !["backpack", "mainhand-1h", "mainhand-2h", "offhand", "worn"].includes(String(equipState))) {
      return { code: "invalid-inventory", message: `${item.name} has an invalid equip state.` };
    }
    if (equipState === "mainhand-1h" || equipState === "mainhand-2h" || equipState === "offhand") {
      if (occupiedHands.has(String(equipState))) return { code: "invalid-inventory", message: `More than one item occupies ${equipState}.` };
      occupiedHands.add(String(equipState));
    }
  }
  if (attunedCount > 3) return { code: "invalid-inventory", message: "A character cannot be attuned to more than three items." };
  if (occupiedHands.has("mainhand-2h") && (occupiedHands.has("mainhand-1h") || occupiedHands.has("offhand"))) {
    return { code: "invalid-inventory", message: "A two-handed weapon cannot be equipped with another held item." };
  }
  for (const item of itemById.values()) {
    if (item.linkedAmmoId == null) continue;
    if (!validId(item.linkedAmmoId) || item.linkedAmmoId === item.id || !itemById.has(item.linkedAmmoId)) {
      return { code: "invalid-inventory", message: `${item.name} refers to missing ammunition.` };
    }
    const ammo = itemById.get(item.linkedAmmoId)!;
    if (typeof item.weaponAmmo === "string" && ammo.ammo !== item.weaponAmmo) {
      return { code: "invalid-inventory", message: `${item.name} is linked to incompatible ammunition.` };
    }
  }
  return null;
}
