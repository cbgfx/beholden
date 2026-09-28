import type { Db } from "../db.js";

const ITEM_DISPLAY_COLUMNS = ["equippable", "weight", "value", "proficiency"] as const;

/**
 * Removes item presentation columns that duplicate the canonical JSON document.
 * Every reader of these values already parses data_json for the rest of the item.
 */
export function dropItemDisplayColumns(db: Db): void {
  const existing = new Set(
    (db.prepare("PRAGMA table_info(compendium_items)").all() as Array<{ name: string }>).map((column) => column.name),
  );
  for (const column of ITEM_DISPLAY_COLUMNS) {
    if (existing.has(column)) db.exec(`ALTER TABLE compendium_items DROP COLUMN ${column}`);
  }
}
