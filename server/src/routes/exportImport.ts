// server/src/routes/exportImport.ts
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { requireAdmin } from "../middleware/auth.js";
import { memberOrAdmin } from "../middleware/campaignAuth.js";
import {
  rowToCampaign,
  rowToAdventure,
  rowToEncounter,
  rowToCampaignCharacter,
  rowToINpc,
  rowToNote,
  rowToPartyInventoryItem,
  rowToTreasure,
  rowToCondition,
  rowToEncounterActor,
  ADVENTURE_COLS,
  ENCOUNTER_COLS,
  CAMPAIGN_CHARACTER_COLS,
  INPC_COLS,
  NOTE_COLS,
  PARTY_INVENTORY_COLS,
  TREASURE_COLS,
  CONDITION_COLS,
  ENCOUNTER_ACTOR_COLS,
} from "../lib/db.js";
import { importCampaignDocument } from "./exportImportHelpers.js";

export function registerExportImportRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  app.get("/api/campaigns/:campaignId/export", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const campaignRow = db
      .prepare("SELECT id, name, color, image_url, created_at, updated_at FROM campaigns WHERE id = ?")
      .get(campaignId) as Record<string, unknown> | undefined;
    if (!campaignRow) return res.status(404).json({ ok: false, message: "Campaign not found" });

    const campaign = rowToCampaign(campaignRow);
    const adventures = Object.fromEntries(
      (db.prepare(`SELECT ${ADVENTURE_COLS} FROM adventures WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToAdventure)
        .map((adventure) => [adventure.id, adventure]),
    );
    const encounters = Object.fromEntries(
      (db.prepare(`SELECT ${ENCOUNTER_COLS} FROM encounters WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToEncounter)
        .map((encounter) => [encounter.id, encounter]),
    );
    const players = Object.fromEntries(
      (db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToCampaignCharacter)
        .map((player) => [player.id, player]),
    );
    const inpcs = Object.fromEntries(
      (db.prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToINpc)
        .map((npc) => [npc.id, npc]),
    );
    const notes = Object.fromEntries(
      (db.prepare(`SELECT ${NOTE_COLS} FROM notes WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToNote)
        .map((note) => [note.id, note]),
    );
    const treasure = Object.fromEntries(
      (db.prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToTreasure)
        .map((entry) => [entry.id, entry]),
    );
    const partyInventory = Object.fromEntries(
      (db.prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToPartyInventoryItem)
        .map((item) => [item.id, item]),
    );
    const conditions = Object.fromEntries(
      (db.prepare(`SELECT ${CONDITION_COLS} FROM conditions WHERE campaign_id = ?`).all(campaignId) as Record<string, unknown>[])
        .map(rowToCondition)
        .map((condition) => [condition.id, condition]),
    );

    const combatantsByEncounter = new Map<string, ReturnType<typeof rowToEncounterActor>[]>();
    for (const row of db.prepare(
      `SELECT ${ENCOUNTER_ACTOR_COLS}
       FROM combatants
       WHERE encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?)
       ORDER BY encounter_id, COALESCE(sort, 9999), created_at`
    ).all(campaignId) as Record<string, unknown>[]) {
      const encounterId = row.encounter_id as string;
      if (!combatantsByEncounter.has(encounterId)) combatantsByEncounter.set(encounterId, []);
      combatantsByEncounter.get(encounterId)!.push(rowToEncounterActor(row));
    }

    const combats: Record<string, unknown> = {};
    for (const encounterId of Object.keys(encounters)) {
      const encounter = encounters[encounterId] as { combat?: { round?: number; activeCombatantId?: string | null }; createdAt?: number; updatedAt?: number } | undefined;
      if (!encounter) continue;
      combats[encounterId] = {
        encounterId,
        round: encounter.combat?.round ?? 1,
        activeIndex: 0,
        activeCombatantId: encounter.combat?.activeCombatantId ?? null,
        combatants: combatantsByEncounter.get(encounterId) ?? [],
        createdAt: encounter.createdAt,
        updatedAt: encounter.updatedAt,
      };
    }

    const body = {
      version: 1,
      campaign,
      adventures,
      encounters,
      players,
      inpcs,
      notes,
      partyInventory,
      treasure,
      conditions,
      combats,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=campaign_${campaignId}.json`);
    res.send(JSON.stringify(body, null, 2));
  });

  app.post("/api/campaigns/import", requireAdmin, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });

    let doc: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(req.file.buffer.toString("utf-8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return res.status(400).json({ ok: false, message: "Invalid campaign JSON" });
      }
      doc = parsed as Record<string, unknown>;
    } catch {
      return res.status(400).json({ ok: false, message: "Invalid JSON" });
    }

    let campaignId: string;
    try {
      campaignId = importCampaignDocument(db, doc, ctx.helpers.uid);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      return res.status(400).json({ ok: false, message });
    }

    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true, campaignId });
  });

  app.get("/api/user/export", requireAdmin, (_req, res) => {
    const campaigns = (
      db.prepare("SELECT id, name, color, image_url, created_at, updated_at FROM campaigns").all() as Record<string, unknown>[]
    ).map(rowToCampaign);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=userData.json");
    res.send(JSON.stringify({ campaigns }, null, 2));
  });
}
