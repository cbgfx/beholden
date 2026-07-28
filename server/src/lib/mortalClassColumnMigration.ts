import type { Db } from "./db.js";

/** Adds the free-text Class field to existing databases; new databases get it from binderSchema.ts. */
export function ensureMortalClassColumn(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(mortals)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === "class_name")) return;
  db.exec("ALTER TABLE mortals ADD COLUMN class_name TEXT");
}
