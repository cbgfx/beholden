/** The fields that decide who a bastion facility belongs to. */
type OwnedFacility = { source: "player" | "dm_extra"; ownerPlayerId: string | null };

/**
 * Converts player facilities whose owner is no longer assigned to the bastion into Granted
 * (`dm_extra`) facilities, keeping everything else about them.
 *
 * An owner disappears when a player is unassigned, or when their player row is deleted: deleting a
 * character removes it, and the `bastion_players` link cascades away with it. The facility list is
 * JSON, so it keeps the stale owner id. That used to fail validation on every save and leave the
 * whole bastion uneditable. Granting keeps the facility and leaves the decision to the DM.
 *
 * `changed` tells callers whether a write is needed.
 */
export function grantOwnerlessFacilities<F extends OwnedFacility>(
  facilities: F[],
  assignedPlayerIds: readonly string[],
): { facilities: F[]; changed: boolean } {
  const assigned = new Set(assignedPlayerIds);
  let changed = false;
  const next = facilities.map((facility) => {
    if (facility.source !== "player") return facility;
    if (facility.ownerPlayerId && assigned.has(facility.ownerPlayerId)) return facility;
    changed = true;
    return { ...facility, source: "dm_extra", ownerPlayerId: null } as F;
  });
  return { facilities: next, changed };
}
