// Adds `encounters.xp_awarded_at` to databases made before a fight could remember it had already
// paid out. Existing encounters start as unpaid: there is no way to know after the fact, and the
// DM can reset a fight if they want it locked.

import type Database from "better-sqlite3";

export function ensureEncounterXpAwardedColumn(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(encounters)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === "xp_awarded_at")) return;
  db.exec("ALTER TABLE encounters ADD COLUMN xp_awarded_at INTEGER");
}
