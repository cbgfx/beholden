import type { Db } from "./db.js";

/** Adds the ruleset column to existing databases; new databases get it from dbSchema.ts. */
export function ensureCharacterRulesetColumn(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(user_characters)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === "ruleset")) return;
  db.exec("ALTER TABLE user_characters ADD COLUMN ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e'))");
}
