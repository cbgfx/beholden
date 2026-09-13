import type { Db } from "../db.js";

/**
 * Self-healing startup fixup: `CREATE TABLE IF NOT EXISTS` in dbSchema.ts is a no-op against an
 * already-existing database, so `party_inventory.payload_json` only lands on brand-new databases.
 * Existing installs need it added explicitly. Idempotent and cheap once the column exists.
 */
export function ensurePartyInventoryPayloadColumn(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(party_inventory)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === "payload_json")) return;
  db.exec("ALTER TABLE party_inventory ADD COLUMN payload_json TEXT");
}
