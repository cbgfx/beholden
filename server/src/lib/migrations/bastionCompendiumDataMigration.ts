import type { Db } from "../db.js";

/**
 * Adds `data_json` to `compendium_bastion_spaces` on databases created before space entries carried
 * build and upgrade costs. New databases get the column from SCHEMA_SQL, and the
 * `compendium_bastion_rules` table is created there too (CREATE TABLE IF NOT EXISTS).
 *
 * Existing rows keep `data_json` NULL until the Bastions compendium is re-imported; until then they
 * simply have no costs, and no upgrade pill is offered for basic facilities.
 */
export function ensureBastionSpaceDataColumn(db: Db): void {
  const spaceColumns = db.prepare("PRAGMA table_info(compendium_bastion_spaces)").all() as Array<{ name: string }>;
  if (!spaceColumns.some((column) => column.name === "data_json")) {
    db.exec("ALTER TABLE compendium_bastion_spaces ADD COLUMN data_json TEXT");
  }
  const orderColumns = db.prepare("PRAGMA table_info(compendium_bastion_orders)").all() as Array<{ name: string }>;
  if (orderColumns.length > 0 && !orderColumns.some((column) => column.name === "data_json")) {
    db.exec("ALTER TABLE compendium_bastion_orders ADD COLUMN data_json TEXT");
  }
}
