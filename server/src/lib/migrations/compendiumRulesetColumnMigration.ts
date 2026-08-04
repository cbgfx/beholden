import type Database from "better-sqlite3";

const COMPENDIUM_TABLES = [
  "compendium_monsters",
  "compendium_items",
  "compendium_spells",
  "compendium_class_talents",
  "compendium_classes",
  "compendium_races",
  "compendium_backgrounds",
  "compendium_feats",
  "compendium_deck_cards",
  "compendium_bastion_spaces",
  "compendium_bastion_orders",
  "compendium_bastion_facilities",
] as const;

export function ensureCompendiumRulesetColumns(db: Database.Database): void {
  for (const table of COMPENDIUM_TABLES) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "ruleset")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ruleset TEXT NOT NULL DEFAULT '5.5e' CHECK (ruleset IN ('5e', '5.5e'))`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_ruleset ON ${table}(ruleset)`);
  }
}
