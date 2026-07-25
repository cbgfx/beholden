import type { Db } from "./db.js";

/**
 * Self-healing startup fixup: `CREATE TABLE IF NOT EXISTS` in dbSchema.ts is a no-op against an
 * already-existing database file, so adding `encounter_id` to the `treasure` table there only
 * affects brand-new databases. Existing installs need the column added explicitly. Idempotent and
 * cheap (no-op once the column exists).
 */
export function ensureTreasureEncounterColumn(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(treasure)").all() as Array<{ name: string }>;
  if (columns.some((c) => c.name === "encounter_id")) return;
  db.exec("ALTER TABLE treasure ADD COLUMN encounter_id TEXT");
}
