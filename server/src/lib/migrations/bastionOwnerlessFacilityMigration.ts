import type { Db } from "../db.js";
import { grantOwnerlessFacilities } from "../../services/bastions/ownerlessFacilities.js";

/**
 * Self-healing startup fixup: turns player facilities whose owner is gone into Granted facilities.
 *
 * Deleting a player cascades away their `bastion_players` link, but `facilities_json` keeps the
 * deleted owner id. Every save then failed validation, so an affected bastion couldn't be edited at
 * all, and the only way out was deleting it. Reads and writes now grant these facilities as they go
 * (see grantOwnerlessFacilities); this repairs rows that were already broken.
 *
 * Idempotent: a repaired row has no ownerless player facilities left, so it isn't written again.
 */
export function grantOwnerlessBastionFacilities(db: Db): void {
  const bastions = db
    .prepare("SELECT id, facilities_json, updated_at FROM bastions")
    .all() as Array<{ id: string; facilities_json: string; updated_at: number }>;
  if (bastions.length === 0) return;

  const assignedPlayers = db.prepare("SELECT player_id FROM bastion_players WHERE bastion_id = ?").pluck();
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

      // Read ownership the same way parseFacilityState does: a missing source means "player", and a
      // blank owner means none.
      const facilities = raw
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((value) => {
          const source: "player" | "dm_extra" = value.source === "dm_extra" ? "dm_extra" : "player";
          const owner = typeof value.ownerPlayerId === "string" ? value.ownerPlayerId.trim() : "";
          return { ...value, source, ownerPlayerId: source === "player" && owner ? owner : null };
        });

      const result = grantOwnerlessFacilities(facilities, assignedPlayers.all(bastion.id) as string[]);
      if (!result.changed) continue;
      // The content changed, so the version does too; never reuse the previous timestamp.
      update.run(JSON.stringify(result.facilities), Math.max(Date.now(), bastion.updated_at + 1), bastion.id);
    }
  })();
}
