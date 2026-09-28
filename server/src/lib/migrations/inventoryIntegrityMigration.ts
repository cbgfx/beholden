import type { Db } from "../db.js";

const VERSION = 1;

type InventoryItem = Record<string, unknown>;

/**
 * Repairs the one legacy inventory relationship that cannot be represented by
 * a database foreign key because inventories live inside character JSON.
 * Current write boundaries remain strict; the version marker makes this a
 * one-time upgrade for records created before those boundaries existed.
 */
export function migrateInventoryIntegrity(db: Db): void {
  const rows = db.prepare("SELECT id, character_data_json AS json FROM user_characters")
    .all() as Array<{ id: string; json: string | null }>;
  const update = db.prepare("UPDATE user_characters SET character_data_json = ? WHERE id = ?");
  const migrate = db.transaction(() => {
    for (const row of rows) {
      let data: Record<string, unknown>;
      try {
        const parsed = JSON.parse(row.json ?? "{}") as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        data = parsed as Record<string, unknown>;
      } catch {
        continue;
      }
      if (Number(data.inventoryIntegrityVersion) >= VERSION) continue;
      const rawInventory = Array.isArray(data.inventory) ? data.inventory : [];
      const inventory = rawInventory.filter((item): item is InventoryItem => Boolean(item) && typeof item === "object" && !Array.isArray(item));
      const byId = new Map(inventory
        .filter((item) => typeof item.id === "string" && item.id.length > 0)
        .map((item) => [item.id as string, item]));
      const repairedInventory = rawInventory.map((rawItem) => {
        if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return rawItem;
        const item = rawItem as InventoryItem;
        if (item.linkedAmmoId == null) return item;
        const linked = typeof item.linkedAmmoId === "string" ? byId.get(item.linkedAmmoId) : undefined;
        const compatible = linked && (typeof item.weaponAmmo !== "string" || linked.ammo === item.weaponAmmo);
        if (compatible && linked !== item) return item;
        const candidates = typeof item.weaponAmmo === "string"
          ? inventory.filter((candidate) => candidate !== item && candidate.ammo === item.weaponAmmo && typeof candidate.id === "string")
          : [];
        if (candidates.length === 1) return { ...item, linkedAmmoId: candidates[0]!.id };
        const { linkedAmmoId: _removed, ...withoutDanglingLink } = item;
        return withoutDanglingLink;
      });
      update.run(JSON.stringify({
        ...data,
        inventoryIntegrityVersion: VERSION,
        ...(Array.isArray(data.inventory) ? { inventory: repairedInventory } : {}),
      }), row.id);
    }
  });
  migrate();
}
