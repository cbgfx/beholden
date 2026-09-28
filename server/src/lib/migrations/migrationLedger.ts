import type { Db } from "../db.js";

// server/src/lib/migrations/migrationLedger.ts
//
// A record, inside the database itself, of which one-time data migrations have finished, so later
// startups can skip them instead of re-scanning data that is already converted.
//
// Only migrations that rewrite stored data once belong here. Leave these out:
// - "ensure" steps that add a missing column, table, index or trigger. They check the schema first,
//   cost next to nothing, and must keep running because SQLite rebuilds can drop what they add.
// - steps that tidy data on every start by design (syncCharacterDerivedColumns, identity
//   reconciliation), because data can drift after startup.
//
// A one-time step is only safe once the old shape can no longer come back in: the schema must
// reject it, so pack imports and the editor cannot store it again.
//
// The ledger lives in the database, so it travels with it: a whole-database restore migrates the
// uploaded copy through openDb first and then copies every table, this one included.

/**
 * Every id this version of Beholden knows about. A migration id is permanent: if a migration's
 * conversion changes, give it a new id (for example `.v2`) so databases that already recorded the
 * old one run the new version.
 */
export const ONE_TIME_MIGRATIONS = {
  compendiumClassFeatCanonical: "compendiumClassFeatCanonical.v1",
  compendiumLegacyEffectKinds: "compendiumLegacyEffectKinds.v1",
  monsterTreasureField: "monsterTreasureField.v1",
} as const;

const KNOWN_IDS: ReadonlySet<string> = new Set(Object.values(ONE_TIME_MIGRATIONS));

function ledgerExists(db: Db): boolean {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get() !== undefined;
}

/**
 * Refuses a database that a newer version of Beholden has already migrated. Runs before openDb
 * changes anything, so an older version never half-upgrades data it does not understand.
 */
export function assertNoUnknownMigrations(db: Db): void {
  if (!ledgerExists(db)) return;
  const unknown = (db.prepare("SELECT id FROM schema_migrations ORDER BY id").pluck().all() as string[])
    .filter((id) => !KNOWN_IDS.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `This database was updated by a newer version of Beholden (unknown migrations: ${unknown.join(", ")}). `
      + "Update Beholden before opening it.",
    );
  }
}

/**
 * Runs a one-time migration unless the ledger says it already finished. The step returns whether
 * it completed: `false` means it had to leave some rows as they were (for example unreadable JSON),
 * so it is not recorded and will try again on the next start. The step and its ledger row are
 * written in one transaction, so a failure leaves neither behind.
 */
export function runOnce(db: Db, id: string, step: (db: Db) => boolean): void {
  if (!KNOWN_IDS.has(id)) throw new Error(`Unregistered one-time migration "${id}".`);
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(id)) return;
  db.transaction(() => {
    if (step(db)) db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(id, Date.now());
  })();
}
