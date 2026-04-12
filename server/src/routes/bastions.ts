import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseJson } from "../lib/db.js";
import { parseBody } from "../shared/validate.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import { BastionCreateSchema, BastionPlayerUpdateSchema, BastionUpdateSchema } from "./bastions/schemas.js";
import { normalizeAndValidateFacilities, parseBastionRow, parseFacilityState, readCampaignPlayerRows, readCompendiumFacilities, roleForCampaign } from "./bastions/helpers.js";
import type { BastionRow } from "./bastions/types.js";

function unique(values: string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
}

export function registerBastionRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const emitBastionChange = (args: {
    campaignId: string;
    action: "upsert" | "delete" | "refresh";
    bastionId?: string;
  }) => {
    ctx.broadcast("bastions:delta", {
      campaignId: args.campaignId,
      action: args.action,
      ...(args.bastionId ? { bastionId: args.bastionId } : {}),
    });
  };

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

  app.get("/api/campaigns/:campaignId/bastions/:bastionId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const bastionId = requireParam(req, res, "bastionId");
    if (!campaignId || !bastionId) return;

    const user = req.user!;
    const role = user.isAdmin ? "dm" : roleForCampaign(db, campaignId, user.userId);
    if (!role) return res.status(403).json({ ok: false, message: "Forbidden" });

    const playerRows = readCampaignPlayerRows(db, campaignId);
    const currentUserPlayerIds = playerRows.filter((row) => row.user_id === user.userId).map((row) => row.id);
    const row = db.prepare(
      "SELECT id, campaign_id, name, active, walled, defenders_armed, defenders_unarmed, assigned_player_ids_json, assigned_character_ids_json, notes, maintain_order, facilities_json, created_at, updated_at FROM bastions WHERE campaign_id = ? AND id = ?"
    ).get(campaignId, bastionId) as BastionRow | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Bastion not found." });

    const compendiumFacilities = readCompendiumFacilities(db);
    const bastion = parseBastionRow(row, compendiumFacilities, playerRows);
    if (role !== "dm") {
      const canView = bastion.active && bastion.assignedPlayerIds.some((id) => currentUserPlayerIds.includes(id));
      if (!canView) return res.status(404).json({ ok: false, message: "Bastion not found." });
    }

    res.json({
      ok: true,
      role,
      currentUserPlayerIds,
      bastion,
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

    emitBastionChange({ campaignId, action: "upsert", bastionId: id });
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

    emitBastionChange({ campaignId, action: "upsert", bastionId });
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

    emitBastionChange({ campaignId, action: "upsert", bastionId });
    res.json({ ok: true });
  });

  app.delete("/api/campaigns/:campaignId/bastions/:bastionId", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const bastionId = requireParam(req, res, "bastionId");
    if (!campaignId || !bastionId) return;

    db.prepare("DELETE FROM bastions WHERE id = ? AND campaign_id = ?").run(bastionId, campaignId);
    emitBastionChange({ campaignId, action: "delete", bastionId });
    res.json({ ok: true });
  });
}
