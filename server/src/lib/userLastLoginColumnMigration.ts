import type { Db } from "./db.js";

/** Adds login tracking to existing databases; new databases get it from dbSchema.ts. */
export function ensureUserLastLoginColumn(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === "last_login_at")) return;
  db.exec("ALTER TABLE users ADD COLUMN last_login_at INTEGER");
}
