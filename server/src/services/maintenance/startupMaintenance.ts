// Housekeeping that used to require someone to stop the server and run
// `npm run db:maintenance --execute` by hand. On a hosted deployment nobody is
// there to do that, so the server does it for itself at boot — the one moment
// when it is guaranteed to be the only connection to the database.

import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { deleteOrphanImages, findOrphanImages } from "../images/orphanImages.js";
import { checkCombatIntegrity } from "../combat.removal.js";

/** VACUUM rewrites the whole file, so only bother once enough space is actually free. */
const DEFAULT_VACUUM_THRESHOLD_MIB = 8;

export type MaintenanceSummary = {
  ran: boolean;
  orphanImagesDeleted: number;
  orphanImageBytes: number;
  orphanCombatantsDeleted: number;
  strandedCasterConditionsCleared: number;
  danglingTurnPointersCleared: number;
  vacuumed: boolean;
  reclaimableBytes: number;
  legacyDirectoriesRemoved: string[];
};

/** Image directories older installs created that nothing writes to any more. */
const LEGACY_IMAGE_DIRECTORIES = ["character-banners"];

/** Removes a dead image directory, but only once it is empty — never deletes anyone's files. */
function removeEmptyLegacyDirectories(dataDir: string): string[] {
  const removed: string[] = [];
  for (const name of LEGACY_IMAGE_DIRECTORIES) {
    const directory = path.join(dataDir, name);
    try {
      if (!fs.existsSync(directory)) continue;
      if (fs.readdirSync(directory).length > 0) continue;
      fs.rmdirSync(directory);
      removed.push(name);
    } catch {
      // Best effort; a directory we cannot remove is not worth failing a boot over.
    }
  }
  return removed;
}

/** Bytes sitting in the database file that no longer hold data (deleted rows, dropped tables). */
export function reclaimableBytes(db: Database.Database): number {
  const pageSize = Number(db.pragma("page_size", { simple: true }));
  const freePages = Number(db.pragma("freelist_count", { simple: true }));
  return pageSize * freePages;
}

/** Fold the WAL back in and rewrite the file so the free pages are handed back to the disk. */
export function compactDatabase(db: Database.Database): void {
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.exec("VACUUM");
  db.pragma("optimize");
  db.pragma("journal_size_limit = 16777216");
}

function envFlagIsOff(value: string | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "0" || normalized === "off" || normalized === "false" || normalized === "no";
}

function vacuumThresholdBytes(): number {
  const raw = Number(process.env.BEHOLDEN_STARTUP_VACUUM_MIN_MB ?? DEFAULT_VACUUM_THRESHOLD_MIB);
  const mib = Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_VACUUM_THRESHOLD_MIB;
  return mib * 1024 * 1024;
}

/**
 * Runs at server start: deletes image files no row points at any more, and compacts the
 * database when enough space has piled up to be worth the rewrite. Never throws — a
 * failed cleanup must not stop the server from coming up.
 *
 * Set `BEHOLDEN_STARTUP_MAINTENANCE=off` to skip it entirely.
 */
export function runStartupMaintenance(
  db: Database.Database,
  dataDir: string,
  log: (message: string) => void = console.log,
): MaintenanceSummary {
  const summary: MaintenanceSummary = {
    ran: false,
    orphanImagesDeleted: 0,
    orphanImageBytes: 0,
    orphanCombatantsDeleted: 0,
    strandedCasterConditionsCleared: 0,
    danglingTurnPointersCleared: 0,
    vacuumed: false,
    reclaimableBytes: 0,
    legacyDirectoriesRemoved: [],
  };

  if (envFlagIsOff(process.env.BEHOLDEN_STARTUP_MAINTENANCE)) return summary;
  summary.ran = true;

  summary.legacyDirectoriesRemoved = removeEmptyLegacyDirectories(dataDir);

  try {
    const orphans = findOrphanImages(db, dataDir);
    if (orphans.length > 0) {
      summary.orphanImageBytes = orphans.reduce((total, orphan) => total + orphan.bytes, 0);
      summary.orphanImagesDeleted = deleteOrphanImages(orphans);
      log(`[beholden] Removed ${summary.orphanImagesDeleted} orphaned image file(s) (${formatMiB(summary.orphanImageBytes)}).`);
    }
  } catch (error) {
    console.error("[beholden] Orphaned image cleanup failed:", error);
  }

  try {
    // Anything in a fight that points at something no longer there: combatants whose player or
    // INPC was deleted, conditions whose caster left, a turn aimed at nobody. Nothing is listening
    // yet at startup, so nobody needs telling.
    const report = checkCombatIntegrity(db, () => {}, { repair: true });
    summary.orphanCombatantsDeleted = report.orphanedCombatants;
    summary.strandedCasterConditionsCleared = report.strandedCasterConditions;
    summary.danglingTurnPointersCleared = report.danglingTurnPointers;
    const repaired = report.orphanedCombatants + report.strandedCasterConditions + report.danglingTurnPointers;
    if (repaired > 0) {
      log(`[beholden] Repaired combat references: ${report.orphanedCombatants} orphaned combatant(s), `
        + `${report.strandedCasterConditions} condition(s) whose caster had left, `
        + `${report.danglingTurnPointers} turn(s) pointing at nobody.`);
    }
  } catch (error) {
    console.error("[beholden] Orphaned combatant cleanup failed:", error);
  }

  try {
    summary.reclaimableBytes = reclaimableBytes(db);
    if (summary.reclaimableBytes >= vacuumThresholdBytes()) {
      log(`[beholden] Compacting database (${formatMiB(summary.reclaimableBytes)} reclaimable)...`);
      compactDatabase(db);
      summary.vacuumed = true;
      log("[beholden] Database compacted.");
    }
  } catch (error) {
    console.error("[beholden] Database compaction failed:", error);
  }

  return summary;
}

export function formatMiB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}
