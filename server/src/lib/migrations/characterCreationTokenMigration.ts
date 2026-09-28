import type { Db } from "../db.js";

/** Adds the pre-release character-creation idempotency key to existing databases. */
export function ensureCharacterCreationTokenColumn(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(user_characters)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "creation_token")) {
    db.exec("ALTER TABLE user_characters ADD COLUMN creation_token TEXT");
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_uchars_creation_token ON user_characters(user_id, creation_token) WHERE creation_token IS NOT NULL");
}
