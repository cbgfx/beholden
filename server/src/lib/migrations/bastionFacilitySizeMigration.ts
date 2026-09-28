import type { Db } from "../db.js";

/**
 * Space and hireling counts for the six special facilities that shipped in `Bastions.json` with
 * both fields null (DMG 2024, chapter 8). Every other facility already carried them.
 */
const MISSING_FACILITY_SIZES = [
  { name: "Arcane Study", space: "Roomy", hirelings: 1 },
  { name: "Sanctuary", space: "Roomy", hirelings: 1 },
  { name: "Sacristy", space: "Roomy", hirelings: 1 },
  { name: "Reliquary", space: "Cramped", hirelings: 1 },
  { name: "Demiplane", space: "Vast", hirelings: 1 },
  { name: "Sanctum", space: "Roomy", hirelings: 4 },
] as const;

/**
 * Self-healing startup fixup: databases that imported the bastion corpus before it was corrected
 * have NULL `space`/`hirelings` on these six rows, which made hireling totals under-count.
 *
 * Only NULLs are filled -- a value someone has already entered by hand is left alone. `data_json`
 * (the raw imported entry, re-exported by the native compendium export) is patched with the same
 * values so an export/import round trip doesn't bring the nulls back. Idempotent: once filled, the
 * WHERE clause matches nothing.
 */
export function fillMissingBastionFacilitySizes(db: Db): void {
  // In an UPDATE, every right-hand expression reads the row's *old* values, so the COALESCEs in
  // the data_json branch see the same pre-update space/hirelings as the column assignments do.
  const update = db.prepare(`
    UPDATE compendium_bastion_facilities
    SET
      space = COALESCE(space, @space),
      hirelings = COALESCE(hirelings, @hirelings),
      data_json = CASE
        WHEN json_valid(data_json) THEN json_set(
          data_json,
          '$.space', COALESCE(space, @space),
          '$.hirelings', CAST(COALESCE(hirelings, @hirelings) AS INTEGER)
        )
        ELSE data_json
      END
    WHERE name = @name COLLATE NOCASE
      AND facility_type = 'special'
      AND (space IS NULL OR hirelings IS NULL)
  `);
  db.transaction(() => {
    for (const facility of MISSING_FACILITY_SIZES) update.run(facility);
  })();
}
