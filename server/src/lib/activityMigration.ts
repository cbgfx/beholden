import type { Db } from "./db.js";

function hasColumn(db: Db, table: string, column: string): boolean {
  return Boolean(
    (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
      .some((entry) => entry.name === column),
  );
}

/** Adds reversible soft-archive flags without changing any relationships. */
export function ensureActivityColumns(db: Db): void {
  if (!hasColumn(db, "campaigns", "is_active")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))");
  }
  if (!hasColumn(db, "user_characters", "is_active")) {
    db.exec("ALTER TABLE user_characters ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))");
  }
  db.exec("DROP INDEX IF EXISTS idx_players_campaign_activity");
  if (hasColumn(db, "players", "is_active")) {
    db.exec("ALTER TABLE players DROP COLUMN is_active");
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_campaigns_activity_updated
      ON campaigns(is_active, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_characters_activity_updated
      ON user_characters(user_id, is_active, updated_at DESC);
  `);
}
