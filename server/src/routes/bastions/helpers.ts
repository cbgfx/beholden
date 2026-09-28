import type { ServerContext } from "../../server/context.js";
import { parseJson } from "../../lib/db.js";
import { grantOwnerlessFacilities } from "../../services/bastions/ownerlessFacilities.js";
import {
  FALLBACK_SPECIAL_FACILITY_SLOTS,
  allowedFacilitySizes,
  defaultFacilitySize,
  facilityHirelings,
  specialFacilitySlotsForLevel,
  type BastionFacilityUpgrade,
  type BastionSpaceDefinition,
  type SpecialFacilitySlotStep,
} from "@beholden/shared/domain/bastionFacilities";
import type { FacilityInput } from "./schemas.js";
import {
  BastionCompendiumFacility,
  BastionFacilityState,
  BastionRow,
  FACILITY_ID_PREFIX,
} from "./types.js";

export const BASTION_SELECT = `
  b.id, b.campaign_id, b.name, b.active, b.walled, b.defenders_armed, b.defenders_unarmed,
  COALESCE(
    (SELECT json_group_array(bp.player_id) FROM bastion_players bp WHERE bp.bastion_id = b.id),
    '[]'
  ) AS assigned_player_ids_json,
  COALESCE(
    (SELECT json_group_array(bc.character_id) FROM bastion_characters bc WHERE bc.bastion_id = b.id),
    '[]'
  ) AS assigned_character_ids_json,
  b.notes, b.maintain_order, b.facilities_json, b.created_at, b.updated_at
`;

// MARK: - Replace Bastion Assignments
export function replaceBastionAssignments(
  db: ServerContext["db"],
  bastionId: string,
  playerIds: string[],
  characterIds: string[],
): void {
  const insertPlayer = db.prepare(
    `INSERT OR IGNORE INTO bastion_players (bastion_id, player_id)
     SELECT b.id, p.id
     FROM bastions b
     JOIN player_rows p ON p.id = ? AND p.campaign_id = b.campaign_id
     WHERE b.id = ?`,
  );
  const insertCharacter = db.prepare(
    `INSERT OR IGNORE INTO bastion_characters (bastion_id, character_id)
     SELECT ?, id FROM user_characters WHERE id = ?`,
  );
  db.prepare("DELETE FROM bastion_players WHERE bastion_id = ?").run(bastionId);
  db.prepare("DELETE FROM bastion_characters WHERE bastion_id = ?").run(bastionId);
  for (const playerId of playerIds) insertPlayer.run(playerId, bastionId);
  for (const characterId of characterIds) insertCharacter.run(bastionId, characterId);
}

/** Trimmed, non-empty, de-duplicated strings in first-seen order. */
export function unique(values: string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
}

function jsonObject(raw: string | null | undefined): Record<string, unknown> {
  return raw ? parseJson<Record<string, unknown>>(raw, {}) : {};
}

// MARK: - Bastion Catalog
/** Everything a bastion route needs from the compendium, read once per request. */
export type BastionCatalog = {
  facilities: BastionCompendiumFacility[];
  spaces: BastionSpaceDefinition[];
  specialFacilitySlots: SpecialFacilitySlotStep[];
};

export function resolveBastionRuleset(db: ServerContext["db"], requested?: "5e" | "5.5e" | null): "5e" | "5.5e" | null {
  if (requested) return requested;
  const row = db.prepare(
    `SELECT ruleset FROM (
       SELECT ruleset FROM compendium_bastion_rules
       UNION SELECT ruleset FROM compendium_bastion_spaces
       UNION SELECT ruleset FROM compendium_bastion_orders
       UNION SELECT ruleset FROM compendium_bastion_facilities
     ) ORDER BY CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END LIMIT 1`,
  ).get() as { ruleset?: "5e" | "5.5e" } | undefined;
  return row?.ruleset ?? null;
}

export function readBastionCatalog(db: ServerContext["db"], requestedRuleset?: "5e" | "5.5e" | null): BastionCatalog {
  const ruleset = resolveBastionRuleset(db, requestedRuleset);
  return {
    facilities: readCompendiumFacilities(db, ruleset),
    spaces: readBastionSpaces(db, ruleset),
    specialFacilitySlots: readSpecialFacilitySlots(db, ruleset),
  };
}

/** A facility's `upgrade` block from its stored entry, or null when absent or incomplete. */
function parseFacilityUpgrade(value: unknown): BastionFacilityUpgrade | null {
  if (!value || typeof value !== "object") return null;
  const upgrade = value as Record<string, unknown>;
  const to = typeof upgrade.to === "string" ? upgrade.to.trim().toLowerCase() : "";
  if (!to || typeof upgrade.costGp !== "number" || !Number.isFinite(upgrade.costGp)) return null;
  return {
    to,
    costGp: upgrade.costGp,
    ...(typeof upgrade.hirelingsDelta === "number" ? { hirelingsDelta: upgrade.hirelingsDelta } : {}),
    ...(typeof upgrade.summary === "string" && upgrade.summary.trim() ? { summary: upgrade.summary.trim() } : {}),
  };
}

/** A `{ costGp, days }` block from a stored entry, or null. */
function parseCost(value: unknown): { costGp: number; days: number | null } | null {
  if (!value || typeof value !== "object") return null;
  const cost = value as Record<string, unknown>;
  if (typeof cost.costGp !== "number" || !Number.isFinite(cost.costGp)) return null;
  return { costGp: cost.costGp, days: typeof cost.days === "number" ? cost.days : null };
}

// MARK: - Read Compendium Facilities
export function readCompendiumFacilities(db: ServerContext["db"], ruleset?: "5e" | "5.5e" | null): BastionCompendiumFacility[] {
  const rows = db.prepare(
    `SELECT id, name, name_key, facility_type, minimum_level, prerequisite, orders_json, allow_multiple, space, hirelings, description, data_json FROM compendium_bastion_facilities${ruleset ? " WHERE ruleset = ?" : ""} ORDER BY minimum_level ASC, name COLLATE NOCASE ASC`,
  ).all(...(ruleset ? [ruleset] : [])) as Array<{
    id: string;
    name: string;
    name_key: string;
    facility_type: string;
    minimum_level: number;
    prerequisite: string | null;
    orders_json: string;
    allow_multiple: number;
    space: string | null;
    hirelings: number | null;
    description: string | null;
    data_json: string | null;
  }>;

  return rows.map((row) => {
    // Sizes and upgrades have no columns; they're read from the stored entry.
    const data = jsonObject(row.data_json);
    return {
      id: row.id,
      key: row.name_key,
      name: row.name,
      type: row.facility_type === "basic" ? "basic" : "special",
      minimumLevel: row.minimum_level,
      prerequisite: row.prerequisite,
      orders: unique(parseJson<string[]>(row.orders_json, [])),
      allowMultiple: row.allow_multiple === 1,
      space: row.space,
      hirelings: row.hirelings,
      description: row.description,
      spaces: Array.isArray(data.spaces) ? data.spaces.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean) : null,
      upgrade: parseFacilityUpgrade(data.upgrade),
    };
  });
}

// MARK: - Read Bastion Spaces
/** Space entries with their compendium costs, in compendium order (Cramped, Roomy, Vast). */
export function readBastionSpaces(db: ServerContext["db"], ruleset?: "5e" | "5.5e" | null): Array<BastionSpaceDefinition & { id: string; squares: number | null; label: string | null }> {
  const rows = db.prepare(
    `SELECT id, name, name_key, squares, label, sort_index, data_json FROM compendium_bastion_spaces${ruleset ? " WHERE ruleset = ?" : ""} ORDER BY sort_index ASC, name COLLATE NOCASE ASC`,
  ).all(...(ruleset ? [ruleset] : [])) as Array<{ id: string; name: string; name_key: string; squares: number | null; label: string | null; sort_index: number; data_json: string | null }>;

  return rows.map((row) => {
    const data = jsonObject(row.data_json);
    const upgrade = parseCost(data.basicUpgrade);
    const upgradeTo = data.basicUpgrade && typeof (data.basicUpgrade as Record<string, unknown>).to === "string"
      ? String((data.basicUpgrade as Record<string, unknown>).to).trim().toLowerCase()
      : "";
    return {
      id: row.id,
      key: row.name_key.toLowerCase(),
      name: row.name,
      sort: row.sort_index,
      squares: row.squares,
      label: row.label,
      basicAdd: parseCost(data.basicAdd),
      basicUpgrade: upgrade && upgradeTo ? { to: upgradeTo, ...upgrade } : null,
    };
  });
}

// MARK: - Read Special Facility Slots
/**
 * Special facility slots by level, from the compendium's rules entry. A database imported before
 * rules entries existed has none, and falls back to the book's progression until it's re-imported.
 */
export function readSpecialFacilitySlots(db: ServerContext["db"], ruleset?: "5e" | "5.5e" | null): SpecialFacilitySlotStep[] {
  // Bastions are a 2024 DMG feature, so a 5.5e rules entry wins if both rulesets have one.
  const row = db.prepare(
    `SELECT data_json FROM compendium_bastion_rules${ruleset ? " WHERE ruleset = ?" : ""} ORDER BY CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END, id LIMIT 1`,
  ).get(...(ruleset ? [ruleset] : [])) as { data_json: string } | undefined;
  const slots = jsonObject(row?.data_json).specialFacilitySlots;
  const steps = Array.isArray(slots)
    ? slots.flatMap((step) => {
      const value = step as Record<string, unknown>;
      return typeof value?.level === "number" && typeof value.count === "number" ? [{ level: value.level, count: value.count }] : [];
    })
    : [];
  return steps.length > 0 ? steps : FALLBACK_SPECIAL_FACILITY_SLOTS;
}

// MARK: - Read Campaign Player Rows
export function readCampaignPlayerRows(
  db: ServerContext["db"],
  campaignId: string,
): Array<{ id: string; user_id: string | null; level: number; character_id: string | null; character_name: string }> {
  const rows = db.prepare(
    `SELECT
       p.id,
       COALESCE(p.user_id, uc.user_id) AS user_id,
       p.character_id,
       p.level,
       p.character_name
     FROM player_rows p
     LEFT JOIN user_characters uc ON uc.id = p.character_id
     WHERE p.campaign_id = ?`,
  ).all(campaignId) as Array<{
    id: string;
    user_id: string | null;
    character_id: string | null;
    level: number | null;
    character_name: string | null;
  }>;

  return rows.map((row) => {
    const levelRaw = typeof row.level === "number" ? row.level : 1;
    return {
      id: row.id,
      user_id: row.user_id,
      character_id: row.character_id,
      level: Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1,
      character_name:
        (typeof row.character_name === "string" && row.character_name.trim())
          ? row.character_name.trim()
          : "",
    };
  });
}

// MARK: - Role For Campaign
export function roleForCampaign(
  db: ServerContext["db"],
  campaignId: string,
  userId: string,
): "dm" | "player" | null {
  const row = db
    .prepare("SELECT role FROM campaign_membership WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, userId) as { role: string } | undefined;
  if (!row) return null;
  return row.role === "dm" ? "dm" : "player";
}

// MARK: - Parse Facility State
export function parseFacilityState(raw: unknown): BastionFacilityState[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const value = entry as Record<string, unknown>;
      const facilityKey = String(value.facilityKey ?? "").trim();
      const source = value.source === "dm_extra" ? "dm_extra" : "player";
      const ownerPlayerId = source === "player" ? (String(value.ownerPlayerId ?? "").trim() || null) : null;
      if (!facilityKey) return null;
      return {
        id: String(value.id ?? "").trim() || `${FACILITY_ID_PREFIX}:${Math.random().toString(36).slice(2, 10)}`,
        facilityKey,
        source,
        ownerPlayerId,
        order: value.order == null ? null : String(value.order).trim() || null,
        notes: String(value.notes ?? ""),
        size: typeof value.size === "string" && value.size.trim() ? value.size.trim().toLowerCase() : null,
      } as BastionFacilityState;
    })
    .filter((entry): entry is BastionFacilityState => Boolean(entry));
}

// MARK: - With Facility Sizes
/**
 * Gives facilities stored without a size the size they'd start at. The startup migration persists
 * this; applying it on read too means a facility never shows without a size in between.
 */
export function withFacilitySizes(
  facilities: BastionFacilityState[],
  compendiumFacilities: BastionCompendiumFacility[],
): BastionFacilityState[] {
  const byKey = new Map(compendiumFacilities.map((facility) => [facility.key, facility]));
  return facilities.map((facility) => {
    if (facility.size) return facility;
    const def = byKey.get(facility.facilityKey);
    const size = def ? defaultFacilitySize(def) : null;
    return size ? { ...facility, size } : facility;
  });
}

// MARK: - Normalize And Validate Facilities
/** Validates the facilities a new bastion is created with. Operations validate one change at a time instead. */
export function normalizeAndValidateFacilities(args: {
  db: ServerContext["db"];
  campaignId: string;
  facilities: FacilityInput[];
  catalog: BastionCatalog;
  assignedPlayerIds: string[];
}): {
  facilities: BastionFacilityState[];
  level: number;
  specialSlots: number;
  specialSlotsUsed: number;
} {
  const { db, campaignId, facilities, catalog, assignedPlayerIds } = args;
  const byKey = new Map(catalog.facilities.map((facility) => [facility.key, facility]));
  const slotsForLevel = (level: number) => specialFacilitySlotsForLevel(level, catalog.specialFacilitySlots);

  const allCampaignPlayers = readCampaignPlayerRows(db, campaignId);
  const knownPlayerIds = new Set(allCampaignPlayers.map((row) => row.id));
  for (const assignedPlayerId of assignedPlayerIds) {
    if (!knownPlayerIds.has(assignedPlayerId)) {
      throw new Error(`Assigned player not found in campaign: ${assignedPlayerId}`);
    }
  }
  const playerRows = allCampaignPlayers.filter((row) => assignedPlayerIds.includes(row.id));
  const level = Math.max(1, ...playerRows.map((row) => row.level), 1);
  const slotsByPlayerId = new Map(
    playerRows.map((row) => [row.id, slotsForLevel(row.level)]),
  );
  const specialSlots = [...slotsByPlayerId.values()].reduce((sum, value) => sum + value, 0);

  const withOwners: BastionFacilityState[] = facilities.map((facility, index) => {
    const facilityKey = facility.facilityKey.trim().toLowerCase();
    const def = byKey.get(facilityKey);
    return {
      id:
        (facility.id ?? "").trim() ||
        `${FACILITY_ID_PREFIX}:${index + 1}:${Math.random().toString(36).slice(2, 8)}`,
      facilityKey,
      source: facility.source,
      ownerPlayerId:
        facility.source === "player"
          ? facility.ownerPlayerId?.trim() || (assignedPlayerIds.length === 1 ? (assignedPlayerIds[0] ?? null) : null)
          : null,
      order: facility.order == null ? null : facility.order.trim() || null,
      notes: String(facility.notes ?? ""),
      size: def ? defaultFacilitySize(def) : null,
    };
  });
  // A player facility whose owner isn't on this bastion (unassigned, or the player was deleted)
  // becomes Granted instead of failing the whole save.
  const normalized = grantOwnerlessFacilities(withOwners, assignedPlayerIds).facilities;

  for (const facility of normalized) {
    const def = byKey.get(facility.facilityKey);
    if (!def) {
      throw new Error(`Unknown facility: ${facility.facilityKey}`);
    }

    if (facility.source === "player") {
      if (!facility.ownerPlayerId) {
        throw new Error(`${def.name} must be assigned to a player.`);
      }
      if (!slotsByPlayerId.has(facility.ownerPlayerId)) {
        throw new Error(`${def.name} has an invalid owner player assignment.`);
      }
      const ownerLevel = playerRows.find((row) => row.id === facility.ownerPlayerId)?.level ?? 1;
      if (def.type === "special" && def.minimumLevel > ownerLevel) {
        throw new Error(`${def.name} requires level ${def.minimumLevel} for that player.`);
      }
    }
    // Granted (DM extra) facilities aren't held to level: granting is the DM's override, and the DM
    // picker already offers them at any level.

    const allowedOrders = new Set(def.orders.map((order) => order.toLowerCase()));
    allowedOrders.add("maintain");
    if (facility.order && !allowedOrders.has(facility.order.toLowerCase())) {
      throw new Error(`${facility.order} is not a valid order for ${def.name}.`);
    }
  }

  const duplicateTracker = new Map<string, number>();
  for (const facility of normalized) {
    const def = byKey.get(facility.facilityKey);
    if (!def) continue;
    const count = (duplicateTracker.get(facility.facilityKey) ?? 0) + 1;
    duplicateTracker.set(facility.facilityKey, count);
    if (count > 1 && !def.allowMultiple) {
      throw new Error(`${def.name} can only be added once.`);
    }
  }

  const specialSlotsUsed = normalized.filter((facility) => {
    const def = byKey.get(facility.facilityKey);
    if (!def) return false;
    return def.type === "special" && facility.source !== "dm_extra";
  }).length;

  const specialUsedByPlayer = new Map<string, number>();
  for (const facility of normalized) {
    if (facility.source !== "player" || !facility.ownerPlayerId) continue;
    const def = byKey.get(facility.facilityKey);
    if (!def || def.type !== "special") continue;
    specialUsedByPlayer.set(
      facility.ownerPlayerId,
      (specialUsedByPlayer.get(facility.ownerPlayerId) ?? 0) + 1,
    );
  }
  for (const [playerId, used] of specialUsedByPlayer) {
    const maxSlots = slotsByPlayerId.get(playerId) ?? 0;
    if (used > maxSlots) {
      throw new Error(`Special facility slots exceeded for player ${playerId} (${used}/${maxSlots}).`);
    }
  }

  return { facilities: normalized, level, specialSlots, specialSlotsUsed };
}

// MARK: - Validate New Facility
/**
 * Checks one facility being added against the bastion as it stands. Returns an error message, or
 * null when it may be added.
 *
 * Operations validate only what they change. Re-validating every stored facility on each write is
 * what let one stale entry (a deleted owner, a player whose level dropped) block unrelated edits.
 */
export function validateNewFacility(args: {
  facility: BastionFacilityState;
  existing: BastionFacilityState[];
  catalog: BastionCatalog;
  playerRows: Array<{ id: string; level: number }>;
  assignedPlayerIds: string[];
}): string | null {
  const { facility, existing, catalog, playerRows, assignedPlayerIds } = args;
  const def = catalog.facilities.find((entry) => entry.key === facility.facilityKey);
  if (!def) return `Unknown facility: ${facility.facilityKey}`;

  if (!def.allowMultiple && existing.some((entry) => entry.facilityKey === def.key)) {
    return `${def.name} can only be added once.`;
  }

  // Granting is the DM's override: no owner, level or slot limits.
  if (facility.source === "dm_extra") return null;

  const owner = facility.ownerPlayerId && assignedPlayerIds.includes(facility.ownerPlayerId)
    ? playerRows.find((row) => row.id === facility.ownerPlayerId)
    : undefined;
  if (!owner) return `${def.name} must belong to a player assigned to this Bastion.`;

  if (def.type === "special") {
    if (def.minimumLevel > owner.level) {
      return `${def.name} requires level ${def.minimumLevel} for that player.`;
    }
    const slots = specialFacilitySlotsForLevel(owner.level, catalog.specialFacilitySlots);
    const used = existing.filter((entry) => (
      entry.source === "player" &&
      entry.ownerPlayerId === owner.id &&
      catalog.facilities.find((candidate) => candidate.key === entry.facilityKey)?.type === "special"
    )).length;
    if (used >= slots) return `Special facility slots are full for that player (${used}/${slots}).`;
  }
  return null;
}

// MARK: - Validate Facility Order
/** Checks that an order is one this facility accepts. Maintain is always allowed. Null clears it. */
export function validateFacilityOrder(
  facility: BastionFacilityState,
  order: string | null,
  compendiumFacilities: BastionCompendiumFacility[],
): string | null {
  if (order === null) return null;
  const def = compendiumFacilities.find((entry) => entry.key === facility.facilityKey);
  if (!def) return `Unknown facility: ${facility.facilityKey}`;
  const allowed = new Set([...def.orders, "Maintain"].map((entry) => entry.toLowerCase()));
  return allowed.has(order.toLowerCase()) ? null : `${order} is not a valid order for ${def.name}.`;
}

// MARK: - Validate Facility Size
/**
 * Checks that a size is one this facility can have: one of a basic facility's listed sizes, or a
 * special facility's catalogue size or its upgrade.
 */
export function validateFacilitySize(
  facility: BastionFacilityState,
  size: string,
  compendiumFacilities: BastionCompendiumFacility[],
): string | null {
  const def = compendiumFacilities.find((entry) => entry.key === facility.facilityKey);
  if (!def) return `Unknown facility: ${facility.facilityKey}`;
  return allowedFacilitySizes(def).includes(size) ? null : `${def.name} can't be ${size}.`;
}

// MARK: - Parse Bastion Row
export function parseBastionRow(
  row: BastionRow,
  catalog: BastionCatalog,
  playerRows: Array<{
    id: string;
    user_id: string | null;
    level: number;
    character_id: string | null;
    character_name: string;
  }>,
) {
  const assignedPlayerIds = unique(parseJson<string[]>(row.assigned_player_ids_json, []));
  const assignedCharacterIds = unique(parseJson<string[]>(row.assigned_character_ids_json, []));
  // Shown as Granted even before the next write persists it, so nobody sees a facility with no owner,
  // and sized even if the startup migration hasn't reached this row.
  const facilities = withFacilitySizes(
    grantOwnerlessFacilities(parseFacilityState(parseJson<unknown[]>(row.facilities_json, [])), assignedPlayerIds).facilities,
    catalog.facilities,
  );
  const level = Math.max(
    1,
    ...playerRows.filter((entry) => assignedPlayerIds.includes(entry.id)).map((entry) => entry.level),
    1,
  );
  const assignedPlayersForSlots = playerRows.filter((entry) => assignedPlayerIds.includes(entry.id));
  const specialSlots = assignedPlayersForSlots.reduce(
    (sum, entry) => sum + specialFacilitySlotsForLevel(entry.level, catalog.specialFacilitySlots),
    0,
  );
  const compendiumByKey = new Map(catalog.facilities.map((facility) => [facility.key, facility]));
  const specialSlotsUsed = facilities.filter((facility) => {
    const def = compendiumByKey.get(facility.facilityKey);
    if (!def) return false;
    return def.type === "special" && facility.source !== "dm_extra";
  }).length;
  const hirelingsTotal = facilities.reduce((sum, facility) => {
    const def = compendiumByKey.get(facility.facilityKey);
    return sum + (def ? facilityHirelings(def, facility.size) : 0);
  }, 0);

  const playerLookup = new Map(playerRows.map((entry) => [entry.id, entry]));

  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    active: row.active === 1,
    walled: row.walled === 1,
    defendersArmed: Math.max(0, Math.floor(Number(row.defenders_armed ?? 0))),
    defendersUnarmed: Math.max(0, Math.floor(Number(row.defenders_unarmed ?? 0))),
    assignedPlayerIds,
    assignedCharacterIds,
    assignedPlayers: assignedPlayerIds
      .map((playerId) => {
        const player = playerLookup.get(playerId);
        if (!player) return null;
        return {
          id: player.id,
          userId: player.user_id,
          level: player.level,
          characterId: player.character_id,
          characterName: player.character_name,
        };
      })
      .filter(
        (entry): entry is {
          id: string;
          userId: string | null;
          level: number;
          characterId: string | null;
          characterName: string;
        } => Boolean(entry),
      ),
    notes: row.notes,
    maintainOrder: row.maintain_order === 1,
    facilities: facilities.map((facility) => {
      const def = compendiumByKey.get(facility.facilityKey);
      return {
        ...facility,
        // Hirelings at this facility's current size, upgrade included.
        hirelings: def ? facilityHirelings(def, facility.size) : 0,
        definition: def
          ? {
              key: def.key,
              name: def.name,
              type: def.type,
              minimumLevel: def.minimumLevel,
              prerequisite: def.prerequisite,
              orders: def.orders,
              allowMultiple: def.allowMultiple,
              space: def.space,
              hirelings: def.hirelings,
              description: def.description,
              spaces: def.spaces,
              upgrade: def.upgrade,
            }
          : null,
      };
    }),
    level,
    specialSlots,
    specialSlotsUsed,
    hirelingsTotal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
