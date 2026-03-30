// server/src/routes/campaigns.ts
import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { rowToCampaign, rowToPlayer } from "../lib/db.js";
import { DEFAULT_OVERRIDES } from "../lib/defaults.js";
import { ACCEPTED_IMAGE_TYPES, resizeToWebP, deleteImageFiles } from "../lib/imageHelpers.js";
import { absolutizePublicUrl } from "../lib/publicUrl.js";
import { requireAdmin } from "../middleware/auth.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";

const CampaignUpsertBody = z.object({
  name: z.string().trim().optional(),
});

export function registerCampaignRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now, uid } = ctx.helpers;

  app.get("/api/campaigns", (req, res) => {
    const user = req.user!;
    const rows = user.isAdmin
      ? db.prepare(`
          SELECT c.id, c.name, c.color, c.image_url, c.shared_notes, c.created_at, c.updated_at,
                 COUNT(p.id) AS player_count
          FROM campaigns c
          LEFT JOIN players p ON p.campaign_id = c.id
          GROUP BY c.id
          ORDER BY c.updated_at DESC
        `).all() as Record<string, unknown>[]
      : db.prepare(`
          SELECT c.id, c.name, c.color, c.image_url, c.shared_notes, c.created_at, c.updated_at,
                 COUNT(p.id) AS player_count
          FROM campaigns c
          LEFT JOIN players p ON p.campaign_id = c.id
          WHERE c.id IN (SELECT campaign_id FROM campaign_membership WHERE user_id = ? AND role = 'dm')
          GROUP BY c.id
          ORDER BY c.updated_at DESC
        `).all(user.userId) as Record<string, unknown>[];

    res.json(rows.map((r) => ({
      ...rowToCampaign(r),
      playerCount: r.player_count as number,
    })));
  });

  // Player-facing: all campaigns the current user is a member of (any role).
  app.get("/api/me/campaigns", (req, res) => {
    const user = req.user!;
    const rows = db.prepare(`
        SELECT c.id, c.name, c.color, c.image_url, c.shared_notes, c.created_at, c.updated_at,
               COUNT(p.id) AS player_count
        FROM campaigns c
        LEFT JOIN players p ON p.campaign_id = c.id
        WHERE c.id IN (SELECT campaign_id FROM campaign_membership WHERE user_id = ?)
        GROUP BY c.id
        ORDER BY c.updated_at DESC
      `).all(user.userId) as Record<string, unknown>[];
    res.json(rows.map((r) => ({
      ...rowToCampaign(r),
      playerCount: r.player_count as number,
    })));
  });

  app.post("/api/campaigns", requireAdmin, (req, res) => {
    const body = parseBody(CampaignUpsertBody, req);
    const name = (body.name ?? "").toString().trim() || "New Campaign";
    const id = uid();
    const t = now();
    db.prepare(
      `INSERT INTO campaigns (id, name, color, image_url, created_at, updated_at) VALUES (?, ?, NULL, NULL, ?, ?)`
    ).run(id, name, t, t);
    ctx.helpers.seedDefaultConditions(id);
    ctx.broadcast("campaigns:changed", { campaignId: id });
    res.json({ id, name, color: null, imageUrl: null, sharedNotes: "", createdAt: t, updatedAt: t });
  });

  app.put("/api/campaigns/:campaignId", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const row = db.prepare("SELECT id, name, color, image_url, shared_notes, created_at, updated_at FROM campaigns WHERE id = ?").get(campaignId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const body = parseBody(CampaignUpsertBody, req);
    const name = (body.name ?? "").toString().trim() || (row.name as string);
    const t = now();
    db.prepare("UPDATE campaigns SET name = ?, updated_at = ? WHERE id = ?").run(name, t, campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ...rowToCampaign(row), name, updatedAt: t });
  });

  app.delete("/api/campaigns/:campaignId", requireAdmin, (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const row = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!row) return res.status(404).json({ ok: false, message: "Campaign not found" });

    // FK CASCADE handles all related rows (adventures → encounters → combats/combatants, players, inpcs, etc.)
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);

    // Best-effort removal of campaign image files.
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "campaign-images");
    deleteImageFiles(ctx, imagesDir, campaignId);

    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true });
  });

  // Full rest: heal all players + clear player combatant conditions/temp HP.
  app.post("/api/campaigns/:campaignId/fullRest", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const campaignRow = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!campaignRow) return res.status(404).json({ ok: false, message: "Campaign not found" });

    const t = now();
    const emptyOverrides = JSON.stringify(DEFAULT_OVERRIDES);

    // Reset all players to full HP, clear conditions + overrides.
    const playersResult = db.prepare(
      `UPDATE players SET hp_current = hp_max, overrides_json = ?, conditions_json = '[]', updated_at = ?
       WHERE campaign_id = ?`
    ).run(emptyOverrides, t, campaignId);

    // Reset all player combatants across every encounter in the campaign.
    db.prepare(
      `UPDATE combatants SET
         hp_current      = (SELECT p.hp_max FROM players p WHERE p.id = combatants.base_id),
         hp_max          = (SELECT p.hp_max FROM players p WHERE p.id = combatants.base_id),
         conditions_json = '[]',
         overrides_json  = ?,
         updated_at      = ?
       WHERE base_type = 'player'
         AND encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?)`
    ).run(emptyOverrides, t, campaignId);

    const updatedEncounterIds = (
      db.prepare(
        `SELECT DISTINCT encounter_id FROM combatants
         WHERE base_type = 'player'
           AND encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?)`
      ).all(campaignId) as { encounter_id: string }[]
    ).map((r) => r.encounter_id);

    ctx.broadcast("players:changed", { campaignId });
    for (const encounterId of updatedEncounterIds) {
      ctx.broadcast("encounter:combatantsChanged", { encounterId });
    }

    res.json({ ok: true, playersUpdated: playersResult.changes, encountersUpdated: updatedEncounterIds.length });
  });

  // Touch — update updatedAt to track last-accessed ordering.
  app.post("/api/campaigns/:campaignId/touch", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const row = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!row) return res.status(404).json({ ok: false });
    db.prepare("UPDATE campaigns SET updated_at = ? WHERE id = ?").run(now(), campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true });
  });

  // Upload campaign banner image — resized to a thumbnail (max 400px, WebP).
  app.post("/api/campaigns/:campaignId/image", dmOrAdmin(db), ctx.upload.single("image"), async (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const row = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId) as { id: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    if (!req.file) return res.status(400).json({ ok: false, message: "No file" });

    if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ ok: false, message: "Unsupported image type" });
    }

    let thumbnail: Buffer;
    try {
      thumbnail = await resizeToWebP(req.file.buffer);
    } catch {
      return res.status(400).json({ ok: false, message: "Could not process image" });
    }

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "campaign-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });

    // Remove any stale files from prior uploads (old formats included).
    deleteImageFiles(ctx, imagesDir, campaignId);

    const filename = `${campaignId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), thumbnail);

    const imageUrl = `/campaign-images/${filename}`;
    db.prepare("UPDATE campaigns SET image_url = ?, updated_at = ? WHERE id = ?").run(imageUrl, now(), campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true, imageUrl: absolutizePublicUrl(imageUrl) });
  });

  // Update DM-created shared notes for a campaign.
  app.patch("/api/campaigns/:campaignId/sharedNotes", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const row = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!row) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const sharedNotes: string = typeof req.body?.sharedNotes === "string" ? req.body.sharedNotes : "";
    const t = now();
    db.prepare("UPDATE campaigns SET shared_notes = ?, updated_at = ? WHERE id = ?").run(sharedNotes, t, campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    // Also notify player clients so web-player refreshes character data.
    ctx.broadcast("players:changed", { campaignId });
    res.json({ ok: true, sharedNotes });
  });

  // Remove campaign banner image.
  app.delete("/api/campaigns/:campaignId/image", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const row = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!row) return res.status(404).json({ ok: false });

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "campaign-images");
    deleteImageFiles(ctx, imagesDir, campaignId);

    db.prepare("UPDATE campaigns SET image_url = NULL, updated_at = ? WHERE id = ?").run(now(), campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true });
  });
}
