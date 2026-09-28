import type { Db } from "../db.js";

export function ensureUserTextScaleColumn(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "text_scale")) db.exec("ALTER TABLE users ADD COLUMN text_scale REAL NOT NULL DEFAULT 1");
}
