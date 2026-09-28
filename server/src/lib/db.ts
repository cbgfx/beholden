import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./dbSchema.js";
import { syncCharacterDerivedColumns } from "./dbCharacterSync.js";
import { normalizeLegacyCompendiumEffectKinds } from "./migrations/compendiumLegacyKindMigration.js";
import { extractMonsterTreasureTraits } from "./migrations/monsterTreasureMigration.js";
import { ensureTreasureEncounterColumn } from "./migrations/treasureEncounterColumnMigration.js";
import { ensureEncounterXpAwardedColumn } from "./migrations/encounterXpAwardedMigration.js";
import { ensureTreasureFollowsEncounterDelete } from "./migrations/treasureEncounterCascadeMigration.js";
import { ensurePartyInventoryPayloadColumn } from "./migrations/partyInventoryPayloadColumnMigration.js";
import { ensureUserLastLoginColumn } from "./migrations/userLastLoginColumnMigration.js";
import { ensureUserTextScaleColumn } from "./migrations/userTextScaleMigration.js";
import { ensureImageVersionColumns } from "./migrations/imageVersionColumnMigration.js";
import { ensureCompendiumContentHashColumns } from "./migrations/compendiumContentHashColumnMigration.js";
import { ensureMortalClassColumn } from "./migrations/mortalClassColumnMigration.js";
import { displayNoteTitle } from "./dbConverters.js";
import { ensureCompendiumRulesetColumns } from "./migrations/compendiumRulesetColumnMigration.js";
import { ensureCharacterRulesetColumn } from "./migrations/characterRulesetColumnMigration.js";
import { ensureCharacterCreationTokenColumn } from "./migrations/characterCreationTokenMigration.js";
import { migrateCharacterProgression } from "./migrations/characterProgressionMigration.js";
import { ensureCampaignRulesetColumn } from "./migrations/campaignRulesetMigration.js";
import { removeLegacyBinderNpcMonsterForeignKey } from "./migrations/binderNpcMonsterForeignKeyMigration.js";
import { ensureCompendiumCompositePrimaryKey } from "./migrations/compendiumPrimaryKeyMigration.js";
import { BINDER_SCHEMA_SQL } from "./binderSchema.js";
import { ensureActivityColumns } from "./migrations/activityMigration.js";
import { ensureInpcBinderMortalLink } from "./migrations/inpcBinderMigration.js";
import { fillMissingBastionFacilitySizes } from "./migrations/bastionFacilitySizeMigration.js";
import { grantOwnerlessBastionFacilities } from "./migrations/bastionOwnerlessFacilityMigration.js";
import { ensureBastionSpaceDataColumn } from "./migrations/bastionCompendiumDataMigration.js";
import { dropItemDisplayColumns } from "./migrations/itemDisplayColumnMigration.js";
import { canonicalizeStoredClassesAndFeats } from "./migrations/compendiumClassFeatCanonicalMigration.js";
import { fillBastionFacilityInstanceSizes } from "./migrations/bastionFacilityInstanceSizeMigration.js";
import { migrateInventoryIntegrity } from "./migrations/inventoryIntegrityMigration.js";
import { migratePreparedSpellFlags } from "./migrations/preparedSpellFlagMigration.js";
import { migrateHitDiceSpent } from "./migrations/hitDiceSpentMigration.js";
import { migrateLiveStateToSheet } from "./migrations/liveStateHomeMigration.js";
import { migrateSheetLiveColumns } from "./migrations/sheetLiveColumnsMigration.js";
import { ensureSheetLiveColumns } from "./sheetLiveColumns.js";
import { migrateProfileToSheet } from "./migrations/profileHomeMigration.js";
import { ensurePlayerRowsView } from "./playerRowsView.js";
import { migrateCanonicalCharacterProgression } from "./migrations/characterProgressionCanonicalMigration.js";
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
import { assertNoUnknownMigrations, ONE_TIME_MIGRATIONS, runOnce } from "./migrations/migrationLedger.js";

export type Db = Database.Database;

// Re-export columns and converters so existing import sites don't need to change.
export * from "./dbColumns.js";
export * from "./dbConverters.js";

export function getCampaignCharacterRow(db: Db, playerId: string): Record<string, unknown> | undefined {
  return db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM player_rows WHERE id = ?`).get(playerId) as Record<string, unknown> | undefined;
}

export function openDb(dbPath: string): Db {
  const db = new Database(dbPath);
  try {
    // Checked before anything below writes to the file.
    assertNoUnknownMigrations(db);
  } catch (error) {
    db.close();
    throw error;
  }
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("journal_size_limit = 16777216");
  db.exec(SCHEMA_SQL);
  // SCHEMA_SQL can create the current player view over an older user_characters table. Drop it
  // before any ALTER TABLE migration: SQLite reparses every view during a table rebuild and would
  // otherwise reject the missing current columns before we get a chance to add them.
  db.exec("DROP VIEW IF EXISTS player_rows");
  ensureImageVersionColumns(db);
  ensureSheetLiveColumns(db);
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
  // Every column the player view reads now exists; everything below reads players through it.
  ensurePlayerRowsView(db);
  reconcileLinkedCharacterIdentities(db);
  ensureCompendiumRulesetColumns(db);
  removeLegacyBinderNpcMonsterForeignKey(db);
  ensureCompendiumCompositePrimaryKey(db);
  db.exec(BINDER_SCHEMA_SQL);
  ensureCharacterRulesetColumn(db);
  ensureCharacterCreationTokenColumn(db);
  migrateCharacterProgression(db);
  migratePreparedSpellFlags(db);
  migrateCanonicalCharacterProgression(db);
  migrateHitDiceSpent(db);
  migrateInventoryIntegrity(db);
  ensureCampaignRulesetColumn(db);
  ensureTreasureEncounterColumn(db);
  ensureEncounterXpAwardedColumn(db);
  ensureTreasureFollowsEncounterDelete(db);
  ensurePartyInventoryPayloadColumn(db);
  ensureUserLastLoginColumn(db);
  ensureUserTextScaleColumn(db);
  ensureCompendiumContentHashColumns(db);
  ensureBastionSpaceDataColumn(db);
  dropItemDisplayColumns(db);
  // One-time data migrations run through the ledger (migrationLedger.ts) and are skipped once done.
  runOnce(db, ONE_TIME_MIGRATIONS.compendiumClassFeatCanonical, canonicalizeStoredClassesAndFeats);
  db.function("note_display_title", { deterministic: true }, displayNoteTitle);

  // A linked player's live state and profile move to its sheet, once each.
  migrateSheetLiveColumns(db);
  migrateLiveStateToSheet(db);
  migrateProfileToSheet(db);
  // Recreated in case a migration above rebuilt a table the view reads.
  ensurePlayerRowsView(db);
  syncCharacterDerivedColumns(db);
  runOnce(db, ONE_TIME_MIGRATIONS.compendiumLegacyEffectKinds, normalizeLegacyCompendiumEffectKinds);
  runOnce(db, ONE_TIME_MIGRATIONS.monsterTreasureField, extractMonsterTreasureTraits);
  fillMissingBastionFacilitySizes(db);
  grantOwnerlessBastionFacilities(db);
  fillBastionFacilityInstanceSizes(db);
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
