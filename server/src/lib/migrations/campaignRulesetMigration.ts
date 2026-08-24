import type Database from "better-sqlite3";

export function ensureCampaignRulesetColumn(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(campaigns)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "ruleset")) {
    db.exec("ALTER TABLE campaigns ADD COLUMN ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK(ruleset IN ('5e', '5.5e'))");
  }
}
