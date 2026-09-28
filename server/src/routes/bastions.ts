import type { Express, Request, Response } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseJson } from "../lib/db.js";
import { errorMessage } from "../lib/errors.js";
import { parseBody } from "../lib/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import { defaultFacilitySize } from "@beholden/shared/domain/bastionFacilities";
import {
  BastionCreateSchema,
  BastionFieldsSchema,
  BastionMaintainSchema,
  BastionOperationSchema,
  FacilityAddSchema,
  FacilityEditSchema,
  FacilitySizeSchema,
} from "./bastions/schemas.js";
import {
  BASTION_SELECT,
  normalizeAndValidateFacilities,
  parseBastionRow,
  parseFacilityState,
  readBastionCatalog,
  readCampaignPlayerRows,
  replaceBastionAssignments,
  roleForCampaign,
  unique,
  validateFacilityOrder,
  validateFacilitySize,
  validateNewFacility,
  withFacilitySizes,
  type BastionCatalog,
} from "./bastions/helpers.js";
import { FACILITY_ID_PREFIX } from "./bastions/types.js";
import type { BastionFacilityState, BastionRow } from "./bastions/types.js";
import { grantOwnerlessFacilities } from "../services/bastions/ownerlessFacilities.js";

/**
 * The timestamp for a write. Never equal to the previous one, even when two writes land in the same
 * millisecond: `updated_at` doubles as the row's version, which clients use to ignore a refresh that
 * is older than what they already show.
 */
function nextUpdatedAt(now: number, row: BastionRow): number {
  return Math.max(now, row.updated_at + 1);
}

export function registerBastionRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const emitBastionChange = (args: {
    campaignId: string;
    action: "upsert" | "delete" | "refresh";
    bastionId?: string;
    /** Passed straight through so the client that wrote can recognise and skip its own echo. */
    originClientId?: string;
  }) => {
    ctx.broadcast("bastions:delta", {
      campaignId: args.campaignId,
      action: args.action,
      ...(args.bastionId ? { bastionId: args.bastionId } : {}),
      ...(args.originClientId ? { originClientId: args.originClientId } : {}),
    });
  };

  /**
   * Reads a bastion back in the same shape the GET routes return. Writes respond with it so the
   * client can take the saved state directly instead of re-fetching to see what the server stored.
   */
  const readSavedBastion = (campaignId: string, bastionId: string, catalog: BastionCatalog = readBastionCatalog(db)) => {
    const saved = db.prepare(
      `SELECT ${BASTION_SELECT} FROM bastions b WHERE b.id = ? AND b.campaign_id = ?`
    ).get(bastionId, campaignId) as BastionRow | undefined;
    return saved ? parseBastionRow(saved, catalog, readCampaignPlayerRows(db, campaignId)) : null;
  };

  // MARK: - GET /api/me/characters/:characterId/bastions
  app.get("/api/me/characters/:characterId/bastions", requireAuth, (req, res) => {
    const characterId = requireParam(req, res, "characterId");
    if (!characterId) return;

    const user = req.user!;
    const owned = db
      .prepare("SELECT id FROM user_characters WHERE id = ? AND user_id = ?")
      .get(characterId, user.userId) as { id: string } | undefined;
    if (!owned) return res.status(404).json({ ok: false, message: "Character not found." });

    const assignments = db
      .prepare("SELECT id AS playerId, campaign_id AS campaignId FROM player_rows WHERE character_id = ?")
      .all(characterId) as Array<{ playerId: string; campaignId: string }>;
    const catalog = readBastionCatalog(db);
    const bastions = assignments.flatMap((assignment) => {
      const playerRows = readCampaignPlayerRows(db, assignment.campaignId);
      const rows = db.prepare(
        `SELECT ${BASTION_SELECT} FROM bastions b WHERE b.campaign_id = ? ORDER BY b.updated_at DESC, b.created_at DESC`
      ).all(assignment.campaignId) as BastionRow[];

      return rows
        .map((row) => parseBastionRow(row, catalog, playerRows))
        .filter((bastion) => (
          bastion.active &&
          (
            bastion.assignedPlayerIds.includes(assignment.playerId) ||
            bastion.assignedCharacterIds.includes(characterId) ||
            bastion.assignedPlayers.some((player) => player.id === assignment.playerId || player.characterId === characterId)
          )
        ));
    });

    const seen = new Set<string>();
    res.json({
      ok: true,
      bastions: bastions.filter((bastion) => {
        if (seen.has(bastion.id)) return false;
        seen.add(bastion.id);
        return true;
      }),
    });
  });

  // MARK: - GET /api/campaigns/:campaignId/bastions
  app.get("/api/campaigns/:campaignId/bastions", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const user = req.user!;
    const role = user.isAdmin ? "dm" : roleForCampaign(db, campaignId, user.userId);
    if (!role) return res.status(403).json({ ok: false, message: "Forbidden" });

    const playerRows = readCampaignPlayerRows(db, campaignId);
    const currentUserPlayerIds = playerRows.filter((row) => row.user_id === user.userId).map((row) => row.id);
    const currentUserCharacterIds = playerRows
      .filter((row) => row.user_id === user.userId && typeof row.character_id === "string" && row.character_id)
      .map((row) => row.character_id as string);

    const rows = db.prepare(
      `SELECT ${BASTION_SELECT} FROM bastions b WHERE b.campaign_id = ? ORDER BY b.updated_at DESC, b.created_at DESC`
    ).all(campaignId) as BastionRow[];

    const catalog = readBastionCatalog(db);

    const bastions = rows
      .map((row) => parseBastionRow(row, catalog, playerRows))
      .filter((bastion) => {
        if (role === "dm") return true;
        if (!bastion.active) return false;
        return (
          bastion.assignedPlayerIds.some((id) => currentUserPlayerIds.includes(id)) ||
          bastion.assignedCharacterIds.some((id) => currentUserCharacterIds.includes(id))
        );
      });

    res.json({
      ok: true,
      role,
      currentUserPlayerIds,
      bastions,
    });
  });

  // MARK: - GET /api/campaigns/:campaignId/bastions/:bastionId
  app.get("/api/campaigns/:campaignId/bastions/:bastionId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const bastionId = requireParam(req, res, "bastionId");
    if (!campaignId || !bastionId) return;

    const user = req.user!;
    const role = user.isAdmin ? "dm" : roleForCampaign(db, campaignId, user.userId);
    if (!role) return res.status(403).json({ ok: false, message: "Forbidden" });

    const playerRows = readCampaignPlayerRows(db, campaignId);
    const currentUserPlayerIds = playerRows.filter((row) => row.user_id === user.userId).map((row) => row.id);
    const currentUserCharacterIds = playerRows
      .filter((row) => row.user_id === user.userId && typeof row.character_id === "string" && row.character_id)
      .map((row) => row.character_id as string);
    const row = db.prepare(
      `SELECT ${BASTION_SELECT} FROM bastions b WHERE b.campaign_id = ? AND b.id = ?`
    ).get(campaignId, bastionId) as BastionRow | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Bastion not found." });

    const bastion = parseBastionRow(row, readBastionCatalog(db), playerRows);
    if (role !== "dm") {
      const canView = bastion.active && (
        bastion.assignedPlayerIds.some((id) => currentUserPlayerIds.includes(id)) ||
        bastion.assignedCharacterIds.some((id) => currentUserCharacterIds.includes(id))
      );
      if (!canView) return res.status(404).json({ ok: false, message: "Bastion not found." });
    }

    res.json({
      ok: true,
      role,
      currentUserPlayerIds,
      bastion,
    });
  });

  // MARK: - POST /api/campaigns/:campaignId/bastions
  app.post("/api/campaigns/:campaignId/bastions", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const body = parseBody(BastionCreateSchema, req);
    const assignedPlayerIds = unique(body.assignedPlayerIds ?? []);
    const assignedCharacterIds = unique(body.assignedCharacterIds ?? []);

    const catalog = readBastionCatalog(db);
    if (catalog.facilities.length === 0) {
      return res.status(400).json({ ok: false, message: "No Bastions compendium data imported." });
    }

    let validated;
    try {
      validated = normalizeAndValidateFacilities({
        db,
        campaignId,
        facilities: body.facilities ?? [],
        catalog,
        assignedPlayerIds,
      });
    } catch (error) {
      return res.status(400).json({ ok: false, message: errorMessage(error, "Invalid facilities.") });
    }

    const id = uid();
    const t = now();
    db.transaction(() => {
      db.prepare(
        "INSERT INTO bastions (id, campaign_id, name, active, walled, defenders_armed, defenders_unarmed, notes, maintain_order, facilities_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        id,
        campaignId,
        body.name.trim(),
        body.active ? 1 : 0,
        body.walled ? 1 : 0,
        Math.max(0, Math.floor(body.defendersArmed ?? 0)),
        Math.max(0, Math.floor(body.defendersUnarmed ?? 0)),
        body.notes ?? "",
        body.maintainOrder ? 1 : 0,
        JSON.stringify(validated.facilities),
        t,
        t,
      );
      replaceBastionAssignments(db, id, assignedPlayerIds, assignedCharacterIds);
    })();

    emitBastionChange({ campaignId, action: "upsert", bastionId: id, ...(body.clientId ? { originClientId: body.clientId } : {}) });
    res.json({ ok: true, id, bastion: readSavedBastion(campaignId, id, catalog) });
  });

  // MARK: - Operations
  // Small writes that each change one thing on the current row.
  // Each one reads the row, applies its change, writes, broadcasts, and responds with the saved
  // bastion. better-sqlite3 is synchronous, so the read and the write can't interleave with another
  // request.

  type Operation = {
    campaignId: string;
    bastionId: string;
    row: BastionRow;
    role: "dm" | "player";
    /** This campaign's player rows that belong to the requesting user. */
    currentUserPlayerIds: string[];
    assignedPlayerIds: string[];
    /** The compendium data this request works against. */
    catalog: BastionCatalog;
    /** Stored facilities, with ownerless ones converted to Granted and missing sizes filled in. */
    facilities: BastionFacilityState[];
  };

  /** Bastion columns an operation may set. Column names come only from this type, never the request. */
  type BastionColumn = "name" | "active" | "walled" | "defenders_armed" | "defenders_unarmed" | "notes" | "maintain_order";

  /**
   * Loads the bastion an operation targets and works out who is asking. Responds and returns null
   * when the bastion doesn't exist, or when a player may not act on it at all.
   */
  const beginOperation = (req: Request, res: Response): Operation | null => {
    const campaignId = requireParam(req, res, "campaignId");
    // requireParam has already responded if the first one is missing.
    const bastionId = campaignId ? requireParam(req, res, "bastionId") : null;
    if (!campaignId || !bastionId) return null;

    const user = req.user!;
    const role = user.isAdmin ? "dm" : roleForCampaign(db, campaignId, user.userId);
    if (!role) {
      res.status(403).json({ ok: false, message: "Forbidden" });
      return null;
    }

    const row = db.prepare(
      `SELECT ${BASTION_SELECT} FROM bastions b WHERE b.id = ? AND b.campaign_id = ?`
    ).get(bastionId, campaignId) as BastionRow | undefined;
    if (!row) {
      res.status(404).json({ ok: false, message: "Bastion not found." });
      return null;
    }

    const assignedPlayerIds = unique(parseJson<string[]>(row.assigned_player_ids_json, []));
    const currentUserPlayerIds = readCampaignPlayerRows(db, campaignId)
      .filter((entry) => entry.user_id === user.userId)
      .map((entry) => entry.id);
    if (role !== "dm") {
      if (row.active !== 1) {
        res.status(403).json({ ok: false, message: "Bastion is inactive." });
        return null;
      }
      if (!assignedPlayerIds.some((id) => currentUserPlayerIds.includes(id))) {
        res.status(403).json({ ok: false, message: "Not assigned to this Bastion." });
        return null;
      }
    }

    const catalog = readBastionCatalog(db);
    const facilities = withFacilitySizes(
      grantOwnerlessFacilities(parseFacilityState(parseJson<unknown[]>(row.facilities_json, [])), assignedPlayerIds).facilities,
      catalog.facilities,
    );
    return { campaignId, bastionId, row, role, currentUserPlayerIds, assignedPlayerIds, catalog, facilities };
  };

  /** The DM may change any facility; a player only their own player facilities. */
  const mayChangeFacility = (op: Operation, facility: BastionFacilityState): boolean =>
    op.role === "dm" ||
    (facility.source === "player" && facility.ownerPlayerId !== null && op.currentUserPlayerIds.includes(facility.ownerPlayerId));

  /**
   * Writes an operation's result, broadcasts it, and responds with the saved bastion. Facilities are
   * always written, which also persists the repairs beginOperation applied (Granted, sizes).
   * `beforeWrite` runs in the same transaction, for operations that touch other tables.
   */
  const commitOperation = (
    res: Response,
    op: Operation,
    clientId: string | undefined,
    changes: {
      columns?: Partial<Record<BastionColumn, string | number>>;
      facilities?: BastionFacilityState[];
      beforeWrite?: () => void;
    } = {},
    extraResponse: Record<string, unknown> = {},
  ) => {
    const columns = Object.entries(changes.columns ?? {}) as Array<[BastionColumn, string | number]>;
    const setClauses = [...columns.map(([column]) => `${column} = ?`), "facilities_json = ?", "updated_at = ?"];
    db.transaction(() => {
      changes.beforeWrite?.();
      db.prepare(`UPDATE bastions SET ${setClauses.join(", ")} WHERE id = ?`).run(
        ...columns.map(([, value]) => value),
        JSON.stringify(changes.facilities ?? op.facilities),
        nextUpdatedAt(now(), op.row),
        op.bastionId,
      );
    })();
    emitBastionChange({ campaignId: op.campaignId, action: "upsert", bastionId: op.bastionId, ...(clientId ? { originClientId: clientId } : {}) });
    res.json({ ok: true, ...extraResponse, bastion: readSavedBastion(op.campaignId, op.bastionId, op.catalog) });
  };

  // MARK: - PATCH /api/campaigns/:campaignId/bastions/:bastionId
  // Bastion-wide details. DM only: players change their own facilities, not the bastion.
  app.patch("/api/campaigns/:campaignId/bastions/:bastionId", dmOrAdmin(db), (req, res) => {
    const body = parseBody(BastionFieldsSchema, req);
    const op = beginOperation(req, res);
    if (!op) return;

    const columns: Partial<Record<BastionColumn, string | number>> = {};
    if (body.name !== undefined) columns.name = body.name;
    if (body.active !== undefined) columns.active = body.active ? 1 : 0;
    if (body.walled !== undefined) columns.walled = body.walled ? 1 : 0;
    if (body.defendersArmed !== undefined) columns.defenders_armed = body.defendersArmed;
    if (body.defendersUnarmed !== undefined) columns.defenders_unarmed = body.defendersUnarmed;
    if (body.notes !== undefined) columns.notes = body.notes;
    commitOperation(res, op, body.clientId, { columns });
  });

  // MARK: - PUT /api/campaigns/:campaignId/bastions/:bastionId/maintain
  // The bastion-wide Maintain toggle. DM only; players set Maintain as a facility's order instead.
  app.put("/api/campaigns/:campaignId/bastions/:bastionId/maintain", dmOrAdmin(db), (req, res) => {
    const body = parseBody(BastionMaintainSchema, req);
    const op = beginOperation(req, res);
    if (!op) return;

    // Turning it on makes Maintain the order for every player facility, as the DM toggle always has.
    const facilities = body.enabled
      ? op.facilities.map((facility) => (facility.source === "player" ? { ...facility, order: "Maintain" } : facility))
      : op.facilities;
    commitOperation(res, op, body.clientId, { columns: { maintain_order: body.enabled ? 1 : 0 }, facilities });
  });

  // MARK: - PUT /api/campaigns/:campaignId/bastions/:bastionId/players/:playerId
  app.put("/api/campaigns/:campaignId/bastions/:bastionId/players/:playerId", dmOrAdmin(db), (req, res) => {
    // No body is needed; one may still carry a clientId.
    const body = BastionOperationSchema.parse(req.body ?? {});
    const op = beginOperation(req, res);
    if (!op) return;
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;

    const player = db.prepare("SELECT id FROM player_rows WHERE id = ? AND campaign_id = ?").get(playerId, op.campaignId);
    if (!player) return res.status(404).json({ ok: false, message: "Player not found in this campaign." });

    commitOperation(res, op, body.clientId, {
      beforeWrite: () => {
        db.prepare("INSERT OR IGNORE INTO bastion_players (bastion_id, player_id) VALUES (?, ?)").run(op.bastionId, playerId);
      },
    });
  });

  // MARK: - DELETE /api/campaigns/:campaignId/bastions/:bastionId/players/:playerId
  app.delete("/api/campaigns/:campaignId/bastions/:bastionId/players/:playerId", dmOrAdmin(db), (req, res) => {
    const body = BastionOperationSchema.parse(req.body ?? {});
    const op = beginOperation(req, res);
    if (!op) return;
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;

    // Their facilities stay on the bastion as Granted, for the DM to keep or remove.
    const remaining = op.assignedPlayerIds.filter((id) => id !== playerId);
    const facilities = grantOwnerlessFacilities(op.facilities, remaining).facilities;
    commitOperation(res, op, body.clientId, {
      facilities,
      beforeWrite: () => {
        db.prepare("DELETE FROM bastion_players WHERE bastion_id = ? AND player_id = ?").run(op.bastionId, playerId);
      },
    });
  });

  // MARK: - POST /api/campaigns/:campaignId/bastions/:bastionId/facilities
  app.post("/api/campaigns/:campaignId/bastions/:bastionId/facilities", memberOrAdmin(db), (req, res) => {
    const body = parseBody(FacilityAddSchema, req);
    const op = beginOperation(req, res);
    if (!op) return;

    let ownerPlayerId = body.source === "player" ? body.ownerPlayerId ?? null : null;
    if (op.role !== "dm") {
      if (body.source !== "player") {
        return res.status(403).json({ ok: false, message: "Only the DM can grant facilities." });
      }
      // A player with a single character on this bastion needn't name the owner.
      const ownAssigned = op.currentUserPlayerIds.filter((id) => op.assignedPlayerIds.includes(id));
      if (!ownerPlayerId && ownAssigned.length === 1) ownerPlayerId = ownAssigned[0] ?? null;
      if (!ownerPlayerId || !ownAssigned.includes(ownerPlayerId)) {
        return res.status(403).json({ ok: false, message: "You can only add facilities for your own character." });
      }
    }

    const facilityKey = body.facilityKey.toLowerCase();
    const definition = op.catalog.facilities.find((entry) => entry.key === facilityKey);
    const facility: BastionFacilityState = {
      id: `${FACILITY_ID_PREFIX}:${uid()}`,
      facilityKey,
      source: body.source,
      ownerPlayerId,
      order: null,
      notes: "",
      // Basic facilities start Cramped, special ones at their catalogue size.
      size: definition ? defaultFacilitySize(definition) : null,
    };
    const problem = validateNewFacility({
      facility,
      existing: op.facilities,
      catalog: op.catalog,
      playerRows: readCampaignPlayerRows(db, op.campaignId),
      assignedPlayerIds: op.assignedPlayerIds,
    });
    if (problem) return res.status(400).json({ ok: false, message: problem });

    // The new id comes back too, so the client can select the facility it just added.
    commitOperation(res, op, body.clientId, { facilities: [...op.facilities, facility] }, { facilityId: facility.id });
  });

  // MARK: - PATCH /api/campaigns/:campaignId/bastions/:bastionId/facilities/:facilityId
  app.patch("/api/campaigns/:campaignId/bastions/:bastionId/facilities/:facilityId", memberOrAdmin(db), (req, res) => {
    const body = parseBody(FacilityEditSchema, req);
    const op = beginOperation(req, res);
    if (!op) return;
    const facilityId = requireParam(req, res, "facilityId");
    if (!facilityId) return;

    const facility = op.facilities.find((entry) => entry.id === facilityId);
    if (!facility) return res.status(404).json({ ok: false, message: "Facility not found." });
    if (!mayChangeFacility(op, facility)) {
      return res.status(403).json({ ok: false, message: "You can only change your own facilities." });
    }

    const order = body.order === undefined ? facility.order : (body.order || null);
    // Only a new order is checked, so editing notes never trips over an order stored long ago.
    if (body.order !== undefined) {
      const problem = validateFacilityOrder(facility, order, op.catalog.facilities);
      if (problem) return res.status(400).json({ ok: false, message: problem });
    }

    const updated: BastionFacilityState = { ...facility, order, notes: body.notes ?? facility.notes };
    commitOperation(res, op, body.clientId, {
      facilities: op.facilities.map((entry) => (entry.id === facility.id ? updated : entry)),
    });
  });

  // MARK: - PUT /api/campaigns/:campaignId/bastions/:bastionId/facilities/:facilityId/size
  // The DM's upgrade pill. It sets the size directly (the client works out the next step), so one
  // operation upgrades, downgrades and resets. Gold and time are handled at the table, not here.
  app.put("/api/campaigns/:campaignId/bastions/:bastionId/facilities/:facilityId/size", dmOrAdmin(db), (req, res) => {
    const body = parseBody(FacilitySizeSchema, req);
    const op = beginOperation(req, res);
    if (!op) return;
    const facilityId = requireParam(req, res, "facilityId");
    if (!facilityId) return;

    const facility = op.facilities.find((entry) => entry.id === facilityId);
    if (!facility) return res.status(404).json({ ok: false, message: "Facility not found." });
    const problem = validateFacilitySize(facility, body.size, op.catalog.facilities);
    if (problem) return res.status(400).json({ ok: false, message: problem });

    commitOperation(res, op, body.clientId, {
      facilities: op.facilities.map((entry) => (entry.id === facility.id ? { ...facility, size: body.size } : entry)),
    });
  });

  // MARK: - DELETE /api/campaigns/:campaignId/bastions/:bastionId/facilities/:facilityId
  app.delete("/api/campaigns/:campaignId/bastions/:bastionId/facilities/:facilityId", memberOrAdmin(db), (req, res) => {
    const body = BastionOperationSchema.parse(req.body ?? {});
    const op = beginOperation(req, res);
    if (!op) return;
    const facilityId = requireParam(req, res, "facilityId");
    if (!facilityId) return;

    const facility = op.facilities.find((entry) => entry.id === facilityId);
    if (!facility) return res.status(404).json({ ok: false, message: "Facility not found." });
    if (!mayChangeFacility(op, facility)) {
      return res.status(403).json({ ok: false, message: "You can only remove your own facilities." });
    }

    commitOperation(res, op, body.clientId, {
      facilities: op.facilities.filter((entry) => entry.id !== facility.id),
    });
  });

  // MARK: - DELETE /api/campaigns/:campaignId/bastions/:bastionId
  app.delete("/api/campaigns/:campaignId/bastions/:bastionId", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const bastionId = requireParam(req, res, "bastionId");
    if (!campaignId || !bastionId) return;

    db.prepare("DELETE FROM bastions WHERE id = ? AND campaign_id = ?").run(bastionId, campaignId);
    emitBastionChange({ campaignId, action: "delete", bastionId });
    res.json({ ok: true });
  });
}
