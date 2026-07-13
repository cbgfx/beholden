import type { Db } from "./db.js";

const IMAGE_TABLES = ["campaigns", "players", "user_characters"] as const;

export function ensureImageVersionColumns(db: Db): void {
  for (const table of IMAGE_TABLES) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "image_updated_at")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN image_updated_at INTEGER`);
    }
    db.prepare(`
      UPDATE ${table}
      SET image_updated_at = updated_at
      WHERE image_url IS NOT NULL AND image_updated_at IS NULL
    `).run();
  }
}
