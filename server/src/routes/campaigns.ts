// server/src/routes/campaigns.ts
import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { requireCampaignExists, requireParam } from "../lib/routeHelpers.js";
import { rowToCampaign, rowToCampaignCharacter, CAMPAIGN_CHARACTER_COLS } from "../lib/db.js";
import { DEFAULT_OVERRIDES } from "../lib/defaults.js";
import { updateCampaignCharacterLive } from "../services/characters.js";
import { rowToEncounterActor } from "../lib/db.js";
import { ENCOUNTER_ACTOR_COLS } from "../lib/db.js";
import { buildEncounterActorLive, updateEncounterActor } from "../services/combat.js";
import { prepareUploadedImage, deleteImageFiles } from "../lib/imageHelpers.js";
import { absolutizePublicUrlForRequest } from "../lib/publicUrl.js";
import { withAbsoluteImageUrl } from "../lib/routeImageUrl.js";
import { requireAdmin } from "../middleware/auth.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";

const CampaignUpsertBody = z.object({
  name: z.string().trim().optional(),
  color: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});
const CampaignBinderContentBody = z.object({
  campaignStory: z.string().max(500_000).nullable().optional(),
  campaignNotes: z.string().max(500_000).nullable().optional(),
}).strict().refine((body) => Object.keys(body).length > 0, {
  message: "Campaign Story or Campaign Notes is required",
});

export function registerCampaignRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now, uid } = ctx.helpers;

  app.get("/api/campaigns", (req, res) => {
    const user = req.user!;
    const rows = user.isAdmin
      ? db.prepare(`
          SELECT c.id, c.name, c.color, c.image_url, c.image_updated_at, c.shared_notes, c.campaign_story, c.campaign_notes,
                 c.binder_id, c.current_date_text, c.current_date_sort, c.is_active, c.created_at, c.updated_at,
                 COUNT(p.id) AS player_count
          FROM campaigns c
          LEFT JOIN players p ON p.campaign_id = c.id
          GROUP BY c.id
          ORDER BY c.updated_at DESC
        `).all() as Record<string, unknown>[]
      : db.prepare(`
          SELECT c.id, c.name, c.color, c.image_url, c.image_updated_at, c.shared_notes, c.campaign_story, c.campaign_notes,
                 c.binder_id, c.current_date_text, c.current_date_sort, c.is_active, c.created_at, c.updated_at,
                 COUNT(p.id) AS player_count
          FROM campaigns c
          LEFT JOIN players p ON p.campaign_id = c.id
          WHERE c.id IN (SELECT campaign_id FROM campaign_membership WHERE user_id = ? AND role = 'dm')
          GROUP BY c.id
          ORDER BY c.updated_at DESC
        `).all(user.userId) as Record<string, unknown>[];

    res.json(rows.map((r) => withAbsoluteImageUrl(req, {
      ...rowToCampaign(r),
      playerCount: r.player_count as number,
    })));
  });

  // Player-facing: all campaigns the current user is a member of (any role).
  app.get("/api/me/campaigns", (req, res) => {
    const user = req.user!;
    const rows = db.prepare(`
        SELECT c.id, c.name, c.color, c.image_url, c.image_updated_at, c.shared_notes,
               c.binder_id, c.current_date_text, c.current_date_sort, c.is_active, c.created_at, c.updated_at,
               COUNT(p.id) AS player_count
        FROM campaigns c
        LEFT JOIN players p ON p.campaign_id = c.id
        WHERE c.is_active = 1
          AND EXISTS (
            SELECT 1
            FROM campaign_membership cm
            WHERE cm.campaign_id = c.id
              AND cm.user_id = ?
          )
        GROUP BY c.id
        ORDER BY c.updated_at DESC
      `).all(user.userId) as Record<string, unknown>[];
    res.json(rows.map((r) => withAbsoluteImageUrl(req, {
      ...rowToCampaign(r),
      playerCount: r.player_count as number,
    })));
  });

  app.post("/api/campaigns", requireAdmin, (req, res) => {
    const body = parseBody(CampaignUpsertBody, req);
    const name = (body.name ?? "").toString().trim() || "New Campaign";
    const color = body.color ?? "#f59e0b";
    const id = uid();
    const t = now();
    db.prepare(
      `INSERT INTO campaigns (id, name, color, image_url, shared_notes, created_at, updated_at) VALUES (?, ?, ?, NULL, '', ?, ?)`
    ).run(id, name, color, t, t);
    ctx.helpers.seedDefaultConditions(id);
    ctx.broadcast("campaigns:changed", { campaignId: id });
    res.json(withAbsoluteImageUrl(req, {
      id,
      name,
      color,
      imageUrl: null,
      sharedNotes: "",
      binderId: null,
      currentDate: { text: null, sort: null },
      isActive: true,
      createdAt: t,
      updatedAt: t,
    }));
  });

  app.put("/api/campaigns/:campaignId", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const row = db.prepare(`
      SELECT id, name, color, image_url, image_updated_at, shared_notes, campaign_story, campaign_notes,
             binder_id, current_date_text, current_date_sort, is_active, created_at, updated_at
      FROM campaigns WHERE id = ?
    `).get(campaignId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const body = parseBody(CampaignUpsertBody, req);
    const name = (body.name ?? "").toString().trim() || (row.name as string);
    const color = body.color !== undefined ? (body.color ?? null) : (row.color as string | null ?? null);
    const isActive = body.isActive ?? row.is_active !== 0;
    const t = now();
    db.prepare("UPDATE campaigns SET name = ?, color = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(name, color, isActive ? 1 : 0, t, campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json(withAbsoluteImageUrl(req, { ...rowToCampaign(row), name, color, isActive, updatedAt: t }));
  });

  app.patch("/api/campaigns/:campaignId/binder-content", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const body = parseBody(CampaignBinderContentBody, req);
    const existing = db.prepare("SELECT campaign_story, campaign_notes FROM campaigns WHERE id = ?").get(campaignId) as
      | { campaign_story: string | null; campaign_notes: string | null }
      | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const clean = (value: string | null | undefined, fallback: string | null) =>
      value === undefined ? fallback : value?.trim() || null;
    const campaignStory = clean(body.campaignStory, existing.campaign_story);
    const campaignNotes = clean(body.campaignNotes, existing.campaign_notes);
    const t = now();
    db.prepare("UPDATE campaigns SET campaign_story = ?, campaign_notes = ?, updated_at = ? WHERE id = ?")
      .run(campaignStory, campaignNotes, t, campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true, campaignId, campaignStory, campaignNotes, updatedAt: t });
  });

  app.delete("/api/campaigns/:campaignId", requireAdmin, (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    if (!requireCampaignExists(db, campaignId, res)) return;

    // FK CASCADE handles all related rows (adventures → encounters/combatants, players, inpcs, etc.)
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
    if (!requireCampaignExists(db, campaignId, res)) return;

    const t = now();
    const playerRows = db
      .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];

    // Build hp_max lookup from the already-loaded player rows to avoid N+1 in the combatant loop.
    const playerHpMaxById = new Map<string, number>(
      playerRows.map((r) => [r.id as string, r.hp_max as number])
    );

    // Reset all player combatants across every encounter in the campaign.
    const combatantRows = db.prepare(
      `SELECT ${ENCOUNTER_ACTOR_COLS}
       FROM combatants
       WHERE base_type = 'player'
         AND encounter_id IN (SELECT id FROM encounters WHERE campaign_id = ?)`
    ).all(campaignId) as Record<string, unknown>[];

    db.transaction(() => {
      for (const row of playerRows) {
        const player = rowToCampaignCharacter(row);
        updateCampaignCharacterLive(
          db,
          player.id,
          player,
          {
            hpCurrent: player.hpMax,
            overrides: { ...DEFAULT_OVERRIDES },
            conditions: [],
          },
          t,
        );
      }

      for (const row of combatantRows) {
        const combatant = rowToEncounterActor(row);
        updateEncounterActor(
          db,
          {
            ...combatant,
            ...buildEncounterActorLive(combatant, {
              hpCurrent: playerHpMaxById.get(combatant.baseId) ?? combatant.hpMax,
              overrides: { ...DEFAULT_OVERRIDES },
              conditions: [],
              usedReaction: false,
              usedLegendaryActions: 0,
              usedSpellSlots: {},
            }),
            updatedAt: t,
          },
          t,
        );
      }
    })();

    const playersResult = { changes: playerRows.length };

    const updatedEncounterIds = [...new Set(combatantRows.map((row) => row.encounter_id as string))];

    ctx.broadcast("players:delta", { campaignId, action: "refresh" });
    for (const encounterId of updatedEncounterIds) {
      ctx.broadcast("encounter:combatantsDelta", { encounterId, action: "refresh" });
    }

    res.json({ ok: true, playersUpdated: playersResult.changes, encountersUpdated: updatedEncounterIds.length });
  });

  // Touch — update updatedAt to track last-accessed ordering.
  app.post("/api/campaigns/:campaignId/touch", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    if (!requireCampaignExists(db, campaignId, res)) return;
    db.prepare("UPDATE campaigns SET updated_at = ? WHERE id = ?").run(now(), campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true });
  });

  // Upload campaign banner image — resized to a thumbnail (max 400px, WebP).
  app.post("/api/campaigns/:campaignId/image", dmOrAdmin(db), ctx.upload.single("image"), async (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    if (!requireCampaignExists(db, campaignId, res)) return;
    const prepared = await prepareUploadedImage(req.file);
    if (!prepared.ok) return res.status(400).json({ ok: false, message: prepared.message });
    const thumbnail = prepared.image;

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "campaign-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });

    // Remove any stale files from prior uploads (old formats included).
    deleteImageFiles(ctx, imagesDir, campaignId);

    const filename = `${campaignId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), thumbnail);

    const imageUrl = `/campaign-images/${filename}`;
    const t = now();
    db.prepare("UPDATE campaigns SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?").run(imageUrl, t, t, campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true, imageUrl: absolutizePublicUrlForRequest(req, imageUrl) });
  });

  // Update DM-created shared notes for a campaign.
  app.patch("/api/campaigns/:campaignId/sharedNotes", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    if (!requireCampaignExists(db, campaignId, res)) return;
    const sharedNotes: string = typeof req.body?.sharedNotes === "string" ? req.body.sharedNotes : "";
    const t = now();
    db.prepare("UPDATE campaigns SET shared_notes = ?, updated_at = ? WHERE id = ?").run(sharedNotes, t, campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    // Also notify player clients so web-player refreshes character data.
    ctx.broadcast("players:delta", { campaignId, action: "refresh" });
    res.json({ ok: true, sharedNotes });
  });

  // Remove campaign banner image.
  app.delete("/api/campaigns/:campaignId/image", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    if (!requireCampaignExists(db, campaignId, res)) return;

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "campaign-images");
    deleteImageFiles(ctx, imagesDir, campaignId);

    const t = now();
    db.prepare("UPDATE campaigns SET image_url = NULL, image_updated_at = ?, updated_at = ? WHERE id = ?").run(t, t, campaignId);
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true });
  });
}
