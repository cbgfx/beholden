import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseJson } from "../lib/db.js";
import { parseBody } from "../shared/validate.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";

type BastionCompendiumFacility = {
  key: string;
  name: string;
  type: "basic" | "special";
  minimumLevel: number;
  prerequisite: string | null;
  orders: string[];
  allowMultiple: boolean;
  space: string | null;
  hirelings: number | null;
  description: string | null;
};

type BastionFacilityState = {
  id: string;
  facilityKey: string;
  source: "player" | "dm_extra";
  ownerPlayerId: string | null;
  order: string | null;
  notes: string;
};

type BastionRow = {
  id: string;
  campaign_id: string;
  name: string;
  active: number;
  walled: number;
  defenders_armed: number;
  defenders_unarmed: number;
  assigned_player_ids_json: string;
  assigned_character_ids_json: string;
  notes: string;
  maintain_order: number;
  facilities_json: string;
  created_at: number;
  updated_at: number;
};

const FACILITY_ID_PREFIX = "bastion-facility-assignment";

const FacilityInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  facilityKey: z.string().trim().min(1),
  source: z.enum(["player", "dm_extra"]),
  ownerPlayerId: z.string().trim().min(1).nullable().optional(),
  order: z.string().trim().min(1).nullable().optional(),
  notes: z.string().optional(),
});

const BastionCreateSchema = z.object({
  name: z.string().trim().min(1),
  active: z.boolean().optional(),
  walled: z.boolean().optional(),
  defendersArmed: z.number().int().min(0).optional(),
  defendersUnarmed: z.number().int().min(0).optional(),
  assignedPlayerIds: z.array(z.string().trim().min(1)).optional(),
  assignedCharacterIds: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().optional(),
  maintainOrder: z.boolean().optional(),
  facilities: z.array(FacilityInputSchema).optional(),
});

const BastionUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  walled: z.boolean().optional(),
  defendersArmed: z.number().int().min(0).optional(),
  defendersUnarmed: z.number().int().min(0).optional(),
  assignedPlayerIds: z.array(z.string().trim().min(1)).optional(),
  assignedCharacterIds: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().optional(),
  maintainOrder: z.boolean().optional(),
  facilities: z.array(FacilityInputSchema).optional(),
});

const BastionPlayerUpdateSchema = z.object({
  facilities: z.array(FacilityInputSchema),
  maintainOrder: z.boolean().optional(),
  notes: z.string().optional(),
});

function unique(values: string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
}

function specialSlotsForLevel(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 2;
  return 0;
}

function readCompendiumFacilities(db: ServerContext["db"]): BastionCompendiumFacility[] {
  const rows = db.prepare(
    "SELECT name, name_key, facility_type, minimum_level, prerequisite, orders_json, allow_multiple, space, hirelings, description FROM compendium_bastion_facilities ORDER BY minimum_level ASC, name COLLATE NOCASE ASC"
  ).all() as Array<{
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
  }>;

  return rows.map((row) => ({
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
  }));
}

function readCampaignPlayerRows(db: ServerContext["db"], campaignId: string): Array<{ id: string; user_id: string | null; level: number; character_id: string | null; character_name: string }> {
  const rows = db.prepare(
    "SELECT id, user_id, character_id, sheet_json FROM players WHERE campaign_id = ?"
  ).all(campaignId) as Array<{ id: string; user_id: string | null; character_id: string | null; sheet_json: string }>;

  return rows.map((row) => {
    const sheet = parseJson<Record<string, unknown>>(row.sheet_json, {});
    const levelRaw = typeof sheet.level === "number" ? sheet.level : Number(sheet.level ?? 1);
    return {
      id: row.id,
      user_id: row.user_id,
      character_id: row.character_id,
      level: Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1,
      character_name: String(sheet.characterName ?? "").trim(),
    };
  });
}

function roleForCampaign(db: ServerContext["db"], campaignId: string, userId: string): "dm" | "player" | null {
  const row = db.prepare("SELECT role FROM campaign_membership WHERE campaign_id = ? AND user_id = ?").get(campaignId, userId) as { role: string } | undefined;
  if (!row) return null;
  return row.role === "dm" ? "dm" : "player";
}

function parseFacilityState(raw: unknown): BastionFacilityState[] {
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
      } as BastionFacilityState;
    })
    .filter((entry): entry is BastionFacilityState => Boolean(entry));
}

function normalizeAndValidateFacilities(args: {
  db: ServerContext["db"];
  campaignId: string;
  facilities: Array<z.infer<typeof FacilityInputSchema>>;
  compendiumFacilities: BastionCompendiumFacility[];
  assignedPlayerIds: string[];
}): {
  facilities: BastionFacilityState[];
  level: number;
  specialSlots: number;
  specialSlotsUsed: number;
} {
  const { db, campaignId, facilities, compendiumFacilities, assignedPlayerIds } = args;
  const byKey = new Map(compendiumFacilities.map((facility) => [facility.key, facility]));

  const allCampaignPlayers = readCampaignPlayerRows(db, campaignId);
  const knownPlayerIds = new Set(allCampaignPlayers.map((row) => row.id));
  for (const assignedPlayerId of assignedPlayerIds) {
    if (!knownPlayerIds.has(assignedPlayerId)) {
      throw new Error(`Assigned player not found in campaign: ${assignedPlayerId}`);
    }
  }
  const playerRows = allCampaignPlayers.filter((row) => assignedPlayerIds.includes(row.id));
  const level = Math.max(1, ...playerRows.map((row) => row.level), 1);
  const slotsByPlayerId = new Map(playerRows.map((row) => [row.id, specialSlotsForLevel(row.level)]));
  const specialSlots = [...slotsByPlayerId.values()].reduce((sum, value) => sum + value, 0);

  const normalized: BastionFacilityState[] = facilities.map((facility, index) => ({
    id: (facility.id ?? "").trim() || `${FACILITY_ID_PREFIX}:${index + 1}:${Math.random().toString(36).slice(2, 8)}`,
    facilityKey: facility.facilityKey.trim().toLowerCase(),
    source: facility.source,
    ownerPlayerId: facility.source === "player"
      ? (facility.ownerPlayerId?.trim() || (assignedPlayerIds.length === 1 ? (assignedPlayerIds[0] ?? null) : null))
      : null,
    order: facility.order == null ? null : facility.order.trim() || null,
    notes: String(facility.notes ?? ""),
  }));

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
    } else if (def.type === "special" && def.minimumLevel > level) {
      throw new Error(`${def.name} requires level ${def.minimumLevel}.`);
    }

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
    specialUsedByPlayer.set(facility.ownerPlayerId, (specialUsedByPlayer.get(facility.ownerPlayerId) ?? 0) + 1);
  }
  for (const [playerId, used] of specialUsedByPlayer) {
    const maxSlots = slotsByPlayerId.get(playerId) ?? 0;
    if (used > maxSlots) {
      throw new Error(`Special facility slots exceeded for player ${playerId} (${used}/${maxSlots}).`);
    }
  }

  return { facilities: normalized, level, specialSlots, specialSlotsUsed };
}

function parseBastionRow(row: BastionRow, compendiumFacilities: BastionCompendiumFacility[], playerRows: Array<{ id: string; user_id: string | null; level: number; character_id: string | null; character_name: string }>) {
  const assignedPlayerIds = unique(parseJson<string[]>(row.assigned_player_ids_json, []));
  const assignedCharacterIds = unique(parseJson<string[]>(row.assigned_character_ids_json, []));
  const facilities = parseFacilityState(parseJson<unknown[]>(row.facilities_json, []));
  const level = Math.max(1, ...playerRows.filter((entry) => assignedPlayerIds.includes(entry.id)).map((entry) => entry.level), 1);
  const assignedPlayersForSlots = playerRows.filter((entry) => assignedPlayerIds.includes(entry.id));
  const specialSlots = assignedPlayersForSlots.reduce((sum, entry) => sum + specialSlotsForLevel(entry.level), 0);
  const compendiumByKey = new Map(compendiumFacilities.map((facility) => [facility.key, facility]));
  const specialSlotsUsed = facilities.filter((facility) => {
    const def = compendiumByKey.get(facility.facilityKey);
    if (!def) return false;
    return def.type === "special" && facility.source !== "dm_extra";
  }).length;
  const hirelingsTotal = facilities.reduce((sum, facility) => {
    const def = compendiumByKey.get(facility.facilityKey);
    return sum + (def?.hirelings ?? 0);
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
      .filter((entry): entry is { id: string; userId: string | null; level: number; characterId: string | null; characterName: string } => Boolean(entry)),
    notes: row.notes,
    maintainOrder: row.maintain_order === 1,
    facilities: facilities.map((facility) => {
      const def = compendiumByKey.get(facility.facilityKey);
      return {
        ...facility,
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

export function registerBastionRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/bastions", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const user = req.user!;
    const role = user.isAdmin ? "dm" : roleForCampaign(db, campaignId, user.userId);
    if (!role) return res.status(403).json({ ok: false, message: "Forbidden" });

    const playerRows = readCampaignPlayerRows(db, campaignId);
    const currentUserPlayerIds = playerRows.filter((row) => row.user_id === user.userId).map((row) => row.id);

    const rows = db.prepare(
      "SELECT id, campaign_id, name, active, walled, defenders_armed, defenders_unarmed, assigned_player_ids_json, assigned_character_ids_json, notes, maintain_order, facilities_json, created_at, updated_at FROM bastions WHERE campaign_id = ? ORDER BY updated_at DESC, created_at DESC"
    ).all(campaignId) as BastionRow[];

    const compendiumFacilities = readCompendiumFacilities(db);

    const bastions = rows
      .map((row) => parseBastionRow(row, compendiumFacilities, playerRows))
      .filter((bastion) => {
        if (role === "dm") return true;
        if (!bastion.active) return false;
        return bastion.assignedPlayerIds.some((id) => currentUserPlayerIds.includes(id));
      });

    res.json({
      ok: true,
      role,
      currentUserPlayerIds,
      bastions,
    });
  });

  app.post("/api/campaigns/:campaignId/bastions", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const body = parseBody(BastionCreateSchema, req);
    const assignedPlayerIds = unique(body.assignedPlayerIds ?? []);
    const assignedCharacterIds = unique(body.assignedCharacterIds ?? []);

    const compendiumFacilities = readCompendiumFacilities(db);
    if (compendiumFacilities.length === 0) {
      return res.status(400).json({ ok: false, message: "No Bastions compendium data imported." });
    }

    let validated;
    try {
      validated = normalizeAndValidateFacilities({
        db,
        campaignId,
        facilities: body.facilities ?? [],
        compendiumFacilities,
        assignedPlayerIds,
      });
    } catch (error) {
      return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Invalid facilities." });
    }

    const id = uid();
    const t = now();
    db.prepare(
      "INSERT INTO bastions (id, campaign_id, name, active, walled, defenders_armed, defenders_unarmed, assigned_player_ids_json, assigned_character_ids_json, notes, maintain_order, facilities_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      campaignId,
      body.name.trim(),
      body.active ? 1 : 0,
      body.walled ? 1 : 0,
      Math.max(0, Math.floor(body.defendersArmed ?? 0)),
      Math.max(0, Math.floor(body.defendersUnarmed ?? 0)),
      JSON.stringify(assignedPlayerIds),
      JSON.stringify(assignedCharacterIds),
      body.notes ?? "",
      body.maintainOrder ? 1 : 0,
      JSON.stringify(validated.facilities),
      t,
      t,
    );

    ctx.broadcast("bastions:changed", { campaignId });
    res.json({ ok: true, id });
  });

  app.put("/api/campaigns/:campaignId/bastions/:bastionId", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const bastionId = requireParam(req, res, "bastionId");
    if (!campaignId || !bastionId) return;

    const row = db.prepare(
      "SELECT id, campaign_id, name, active, walled, defenders_armed, defenders_unarmed, assigned_player_ids_json, assigned_character_ids_json, notes, maintain_order, facilities_json, created_at, updated_at FROM bastions WHERE id = ? AND campaign_id = ?"
    ).get(bastionId, campaignId) as BastionRow | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Bastion not found." });

    const body = parseBody(BastionUpdateSchema, req);
    const assignedPlayerIds = unique(body.assignedPlayerIds ?? parseJson<string[]>(row.assigned_player_ids_json, []));
    const assignedCharacterIds = unique(body.assignedCharacterIds ?? parseJson<string[]>(row.assigned_character_ids_json, []));

    const compendiumFacilities = readCompendiumFacilities(db);

    let validated;
    try {
      validated = normalizeAndValidateFacilities({
        db,
        campaignId,
        facilities: body.facilities ?? parseFacilityState(parseJson<unknown[]>(row.facilities_json, [])),
        compendiumFacilities,
        assignedPlayerIds,
      });
    } catch (error) {
      return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Invalid facilities." });
    }

    const t = now();
    db.prepare(
      "UPDATE bastions SET name = ?, active = ?, walled = ?, defenders_armed = ?, defenders_unarmed = ?, assigned_player_ids_json = ?, assigned_character_ids_json = ?, notes = ?, maintain_order = ?, facilities_json = ?, updated_at = ? WHERE id = ?"
    ).run(
      body.name?.trim() || row.name,
      body.active === undefined ? row.active : (body.active ? 1 : 0),
      body.walled === undefined ? row.walled : (body.walled ? 1 : 0),
      body.defendersArmed === undefined ? row.defenders_armed : Math.max(0, Math.floor(body.defendersArmed)),
      body.defendersUnarmed === undefined ? row.defenders_unarmed : Math.max(0, Math.floor(body.defendersUnarmed)),
      JSON.stringify(assignedPlayerIds),
      JSON.stringify(assignedCharacterIds),
      body.notes === undefined ? row.notes : body.notes,
      body.maintainOrder === undefined ? row.maintain_order : (body.maintainOrder ? 1 : 0),
      JSON.stringify(validated.facilities),
      t,
      bastionId,
    );

    ctx.broadcast("bastions:changed", { campaignId });
    res.json({ ok: true });
  });

  app.patch("/api/campaigns/:campaignId/bastions/:bastionId/player", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const bastionId = requireParam(req, res, "bastionId");
    if (!campaignId || !bastionId) return;

    const user = req.user!;
    const role = user.isAdmin ? "dm" : roleForCampaign(db, campaignId, user.userId);
    if (!role) return res.status(403).json({ ok: false, message: "Forbidden" });

    const row = db.prepare(
      "SELECT id, campaign_id, name, active, walled, defenders_armed, defenders_unarmed, assigned_player_ids_json, assigned_character_ids_json, notes, maintain_order, facilities_json, created_at, updated_at FROM bastions WHERE id = ? AND campaign_id = ?"
    ).get(bastionId, campaignId) as BastionRow | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Bastion not found." });

    const assignedPlayerIds = unique(parseJson<string[]>(row.assigned_player_ids_json, []));
    const currentUserPlayerIds = readCampaignPlayerRows(db, campaignId).filter((entry) => entry.user_id === user.userId).map((entry) => entry.id);

    if (role !== "dm") {
      if (row.active !== 1) return res.status(403).json({ ok: false, message: "Bastion is inactive." });
      if (!assignedPlayerIds.some((entry) => currentUserPlayerIds.includes(entry))) {
        return res.status(403).json({ ok: false, message: "Not assigned to this Bastion." });
      }
    }

    const body = parseBody(BastionPlayerUpdateSchema, req);
    const existingFacilities = parseFacilityState(parseJson<unknown[]>(row.facilities_json, []));
    const existingDmExtras = existingFacilities.filter((facility) => facility.source === "dm_extra");
    const incomingDmExtras = body.facilities.filter((facility) => facility.source === "dm_extra");

    if (role !== "dm") {
      const sameCount = existingDmExtras.length === incomingDmExtras.length;
      const existingKeys = [...existingDmExtras].map((entry) => `${entry.id}:${entry.facilityKey}`).sort();
      const incomingKeys = [...incomingDmExtras].map((entry) => `${entry.id ?? ""}:${entry.facilityKey}`).sort();
      if (!sameCount || existingKeys.join("|") !== incomingKeys.join("|")) {
        return res.status(403).json({ ok: false, message: "DM-granted facilities cannot be removed by players." });
      }

      const existingForeignPlayerFacilities = existingFacilities
        .filter((facility) => facility.source === "player" && facility.ownerPlayerId && !currentUserPlayerIds.includes(facility.ownerPlayerId))
        .map((facility) => `${facility.id}|${facility.facilityKey}|${facility.ownerPlayerId}|${facility.order ?? ""}|${facility.notes}`)
        .sort();
      const incomingForeignPlayerFacilities = body.facilities
        .filter((facility) => facility.source === "player" && facility.ownerPlayerId && !currentUserPlayerIds.includes(facility.ownerPlayerId))
        .map((facility) => `${facility.id ?? ""}|${facility.facilityKey}|${facility.ownerPlayerId}|${facility.order ?? ""}|${facility.notes ?? ""}`)
        .sort();
      if (existingForeignPlayerFacilities.join("||") !== incomingForeignPlayerFacilities.join("||")) {
        return res.status(403).json({ ok: false, message: "You can only edit your own player facilities." });
      }

    }

    const compendiumFacilities = readCompendiumFacilities(db);

    let validated;
    try {
      validated = normalizeAndValidateFacilities({
        db,
        campaignId,
        facilities: body.facilities,
        compendiumFacilities,
        assignedPlayerIds,
      });
    } catch (error) {
      return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : "Invalid facilities." });
    }

    const t = now();
    db.prepare(
      "UPDATE bastions SET facilities_json = ?, maintain_order = ?, notes = ?, updated_at = ? WHERE id = ?"
    ).run(
      JSON.stringify(validated.facilities),
      body.maintainOrder === undefined ? row.maintain_order : (body.maintainOrder ? 1 : 0),
      body.notes === undefined ? row.notes : body.notes,
      t,
      bastionId,
    );

    ctx.broadcast("bastions:changed", { campaignId });
    res.json({ ok: true });
  });

  app.delete("/api/campaigns/:campaignId/bastions/:bastionId", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const bastionId = requireParam(req, res, "bastionId");
    if (!campaignId || !bastionId) return;

    db.prepare("DELETE FROM bastions WHERE id = ? AND campaign_id = ?").run(bastionId, campaignId);
    ctx.broadcast("bastions:changed", { campaignId });
    res.json({ ok: true });
  });
}
