import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./dbSchema.js";
import { syncCharacterDerivedColumns } from "./dbCharacterSync.js";
import { normalizeLegacyCompendiumEffectKinds } from "./migrations/compendiumLegacyKindMigration.js";
import { extractMonsterTreasureTraits } from "./migrations/monsterTreasureMigration.js";
import { ensureTreasureEncounterColumn } from "./migrations/treasureEncounterColumnMigration.js";
import { ensureUserLastLoginColumn } from "./migrations/userLastLoginColumnMigration.js";
import { ensureImageVersionColumns } from "./migrations/imageVersionColumnMigration.js";
import { ensureCompendiumContentHashColumns } from "./migrations/compendiumContentHashColumnMigration.js";
import { ensureMortalClassColumn } from "./migrations/mortalClassColumnMigration.js";
import { displayNoteTitle } from "./dbConverters.js";
import { ensureCompendiumRulesetColumns } from "./migrations/compendiumRulesetColumnMigration.js";
import { ensureCharacterRulesetColumn } from "./migrations/characterRulesetColumnMigration.js";
import { ensureCampaignRulesetColumn } from "./migrations/campaignRulesetMigration.js";
import { removeLegacyBinderNpcMonsterForeignKey } from "./migrations/binderNpcMonsterForeignKeyMigration.js";
import { ensureCompendiumCompositePrimaryKey } from "./migrations/compendiumPrimaryKeyMigration.js";
import { BINDER_SCHEMA_SQL } from "./binderSchema.js";
import { ensureActivityColumns } from "./migrations/activityMigration.js";
import { ensureInpcBinderMortalLink } from "./migrations/inpcBinderMigration.js";
import { reconcileLinkedCharacterIdentities } from "../services/binders/linkedCharacterSync.js";
import {
  ensureBinderCampaignColumns,
  ensureBinderColumns,
  ensureBinderRecordTypes,
  ensureBinderLocationNaming,
  ensureBinderUnsetConventions,
  ensureCanonicalMortalPositions,
  ensureConcreteMortalResidences,
} from "./migrations/binderCampaignMigration.js";
import { CAMPAIGN_CHARACTER_COLS } from "./dbColumns.js";

export type Db = Database.Database;

// Re-export columns and converters so existing import sites don't need to change.
export * from "./dbColumns.js";
export * from "./dbConverters.js";

export function getCampaignCharacterRow(db: Db, playerId: string): Record<string, unknown> | undefined {
  return db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(playerId) as Record<string, unknown> | undefined;
}

export function openDb(dbPath: string): Db {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("journal_size_limit = 16777216");
  db.exec(SCHEMA_SQL);
  ensureActivityColumns(db);
  // Binder tables must exist before SQLite can add campaigns.binder_id with
  // its foreign-key reference on upgraded databases.
  ensureBinderLocationNaming(db);
  db.exec(BINDER_SCHEMA_SQL);
  ensureInpcBinderMortalLink(db);
  ensureBinderColumns(db);
  ensureBinderRecordTypes(db);
  ensureBinderUnsetConventions(db);
  ensureCanonicalMortalPositions(db);
  ensureConcreteMortalResidences(db);
  // Recreate Binder indexes/triggers that may have belonged to a rebuilt table.
  db.exec(BINDER_SCHEMA_SQL);
  ensureBinderCampaignColumns(db);
  ensureMortalClassColumn(db);
  reconcileLinkedCharacterIdentities(db);
  ensureCompendiumRulesetColumns(db);
  removeLegacyBinderNpcMonsterForeignKey(db);
  ensureCompendiumCompositePrimaryKey(db);
  db.exec(BINDER_SCHEMA_SQL);
  ensureCharacterRulesetColumn(db);
  ensureCampaignRulesetColumn(db);
  ensureTreasureEncounterColumn(db);
  ensureUserLastLoginColumn(db);
  ensureImageVersionColumns(db);
  ensureCompendiumContentHashColumns(db);
  db.function("note_display_title", { deterministic: true }, displayNoteTitle);

  // Linked campaign rows are projections of canonical character sheets.
  syncCharacterDerivedColumns(db);
  normalizeLegacyCompendiumEffectKinds(db);
  extractMonsterTreasureTraits(db);
  db.pragma("optimize");
  return db;
}

const NEXT_SORT_ALLOWLIST = new Set([
  "adventures|campaign_id",
  "encounters|adventure_id",
  "notes|campaign_id",
  "notes|adventure_id",
  "treasure|campaign_id",
  "treasure|adventure_id",
  "treasure|encounter_id",
]);

/** Returns max(sort)+1 for rows in a table matching a given column/value. */
export function nextSortFor(db: Db, table: string, col: string, val: string): number {
  if (!NEXT_SORT_ALLOWLIST.has(`${table}|${col}`)) {
    throw new Error(`nextSortFor: disallowed table/column pair: ${table}.${col}`);
  }
  const row = db.prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM ${table} WHERE ${col} = ?`).get(val) as { n: number };
  return row.n;
}
