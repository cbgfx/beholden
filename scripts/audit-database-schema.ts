import Database from "better-sqlite3";
import { resolve } from "node:path";

const databasePath = resolve(process.argv[2] ?? ".tmp/schema-audit-20260923/beholden.db");
const db = new Database(databasePath, { readonly: true });
const one = (sql: string): Record<string, unknown> => db.prepare(sql).get() as Record<string, unknown>;
const all = (sql: string): Record<string, unknown>[] => db.prepare(sql).all() as Record<string, unknown>[];
const count = (sql: string): number => Number(one(sql).n);

const tableNames = all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .map((row) => String(row.name));
const compendiumTables = [
  "compendium_monsters", "compendium_items", "compendium_spells", "compendium_class_talents",
  "compendium_classes", "compendium_races", "compendium_backgrounds", "compendium_feats",
].filter((table) => tableNames.includes(table));

const report = {
  databasePath,
  integrity: one("PRAGMA integrity_check"),
  foreignKeyIssues: all("PRAGMA foreign_key_check").length,
  counts: Object.fromEntries(tableNames.map((table) => [table, count(`SELECT count(*) AS n FROM ${table}`)])),
  malformedCompendiumJson: Object.fromEntries(compendiumTables.map((table) => [table, count(`SELECT count(*) AS n FROM ${table} WHERE json_valid(data_json)=0`)])),
  identitiesPresentInMultipleRulesets: Object.fromEntries(compendiumTables.map((table) => [table,
    all(`SELECT id FROM ${table} GROUP BY id HAVING count(DISTINCT ruleset)>1`).length,
  ])),
  logicalReferenceIssues: {
    encounterCampaignMismatch: count("SELECT count(*) AS n FROM encounters e JOIN adventures a ON a.id=e.adventure_id WHERE e.campaign_id<>a.campaign_id"),
    noteCampaignMismatch: count("SELECT count(*) AS n FROM notes n JOIN adventures a ON a.id=n.adventure_id WHERE n.campaign_id<>a.campaign_id"),
    treasureAdventureMismatch: count("SELECT count(*) AS n FROM treasure t JOIN adventures a ON a.id=t.adventure_id WHERE t.campaign_id<>a.campaign_id"),
    treasureEncounterMismatch: count("SELECT count(*) AS n FROM treasure t JOIN encounters e ON e.id=t.encounter_id WHERE t.campaign_id<>e.campaign_id"),
    combatantMissingLocalBase: count(`SELECT count(*) AS n FROM combatants c WHERE
      (base_type='player' AND NOT EXISTS(SELECT 1 FROM players p WHERE p.id=c.base_id)) OR
      (base_type='inpc' AND NOT EXISTS(SELECT 1 FROM inpcs i WHERE i.id=c.base_id))`),
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
db.close();
