import type { Db } from "../db.js";
import { defaultFacilitySize } from "@beholden/shared/domain/bastionFacilities";

/**
 * Startup fixup: gives every stored bastion facility a `size`.
 *
 * Facilities added before sizes existed have none. They get the same size a newly added facility
 * starts at: Cramped for basic facilities, the catalogue size for special ones. A facility that
 * already has a size, or whose definition isn't in the compendium, is left alone. Idempotent.
 */
export function fillBastionFacilityInstanceSizes(db: Db): void {
  const definitions = new Map(
    (db.prepare("SELECT name_key, facility_type, space, hirelings FROM compendium_bastion_facilities").all() as Array<{
      name_key: string;
      facility_type: string;
      space: string | null;
      hirelings: number | null;
    }>).map((row) => [
      row.name_key.toLowerCase(),
      { type: row.facility_type === "basic" ? "basic" as const : "special" as const, space: row.space, hirelings: row.hirelings },
    ]),
  );
  if (definitions.size === 0) return;

  const bastions = db
    .prepare("SELECT id, facilities_json, updated_at FROM bastions")
    .all() as Array<{ id: string; facilities_json: string; updated_at: number }>;
  const update = db.prepare("UPDATE bastions SET facilities_json = ?, updated_at = ? WHERE id = ?");

  db.transaction(() => {
    for (const bastion of bastions) {
      let raw: unknown;
      try {
        raw = JSON.parse(bastion.facilities_json);
      } catch {
        continue;
      }
      if (!Array.isArray(raw)) continue;

      let changed = false;
      const next = raw.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const value = entry as Record<string, unknown>;
        if (typeof value.size === "string" && value.size.trim()) return value;
        const definition = definitions.get(String(value.facilityKey ?? "").trim().toLowerCase());
        const size = definition ? defaultFacilitySize(definition) : null;
        if (!size) return value;
        changed = true;
        return { ...value, size };
      });
      // The content changed, so the version does too; never reuse the previous timestamp.
      if (changed) update.run(JSON.stringify(next), Math.max(Date.now(), bastion.updated_at + 1), bastion.id);
    }
  })();
}
