import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../server/context.js";
import { requireAnyDm } from "../middleware/auth.js";
import {
  binderOwnerOrAdmin,
  binderReaderOrAdmin,
  ownsBinder,
} from "../middleware/binderAuth.js";
import { dmOrAdmin } from "../middleware/campaignAuth.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { exportBinderDocument, importBinderDocument } from "../services/binders/nativeBinder.js";

const optionalText = (max: number) => z.string().max(max).nullable().optional().transform((value) => {
  if (value === undefined || value === null) return value;
  return value.trim() === "" ? null : value;
});

const BinderCreateBody = z.object({
  name: z.string().trim().min(1).max(160),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  description: optionalText(200_000),
  currentDateText: z.string().trim().min(1).max(100),
  currentDateSort: z.number().int(),
}).strict();

const BinderPatchBody = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  description: optionalText(200_000),
  currentDateText: optionalText(100),
  currentDateSort: z.number().int().nullable().optional(),
}).strict().refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one Binder field is required" },
);

const CampaignBinderBody = z.object({
  binderId: z.string().trim().min(1).nullable(),
  currentDateText: optionalText(100),
  currentDateSort: z.number().int().nullable().optional(),
}).strict();

type BinderRow = {
  id: string;
  owner_user_id: string;
  name: string;
  name_key: string;
  color: string;
  description: string | null;
  current_date_text: string | null;
  current_date_sort: number | null;
  created_at: number;
  updated_at: number;
  campaign_count?: number;
  record_count?: number;
};

function binderDto(row: BinderRow) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    color: row.color,
    description: row.description,
    currentDate: {
      text: row.current_date_text,
      sort: row.current_date_sort,
    },
    campaignCount: row.campaign_count ?? 0,
    recordCount: row.record_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BINDER_SELECT = `
  SELECT b.id, b.owner_user_id, b.name, b.name_key, b.color, b.description,
         b.current_date_text, b.current_date_sort, b.created_at, b.updated_at,
         (SELECT COUNT(*) FROM campaigns c WHERE c.binder_id = b.id) AS campaign_count,
         (SELECT COUNT(*) FROM binder_records r WHERE r.binder_id = b.id) AS record_count
  FROM binders b
`;

export function registerBinderRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const ownerOnly = binderOwnerOrAdmin(db);
  const reader = binderReaderOrAdmin(db);
  const anyDm = requireAnyDm(db);

  app.get("/api/binders", anyDm, (req, res) => {
    const rows = req.user!.isAdmin
      ? db.prepare(`${BINDER_SELECT} ORDER BY b.updated_at DESC`).all()
      : db.prepare(`
          ${BINDER_SELECT}
          WHERE b.owner_user_id = ?
             OR EXISTS (
               SELECT 1
               FROM campaigns c
               JOIN campaign_membership cm ON cm.campaign_id = c.id
               WHERE c.binder_id = b.id
                 AND cm.user_id = ?
                 AND cm.role = 'dm'
             )
          ORDER BY b.updated_at DESC
        `).all(req.user!.userId, req.user!.userId);
    res.json((rows as BinderRow[]).map(binderDto));
  });

  app.post("/api/binders/import", anyDm, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "Binder JSON file is required" });
    try {
      const raw = JSON.parse(req.file.buffer.toString("utf8")) as unknown;
      const result = importBinderDocument(db, raw, req.user!.userId, ctx.helpers);
      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof SyntaxError
        ? "The selected file is not valid JSON"
        : error instanceof z.ZodError
          ? `Invalid Binder export: ${error.issues[0]?.message ?? "schema validation failed"}`
          : error instanceof Error ? error.message : "Binder import failed";
      res.status(400).json({ ok: false, message });
    }
  });

  app.post("/api/binders", anyDm, (req, res) => {
    const body = parseBody(BinderCreateBody, req);
    const id = ctx.helpers.uid();
    const t = ctx.helpers.now();
    db.prepare(`
      INSERT INTO binders (
        id, owner_user_id, name, name_key, color, description,
        current_date_text, current_date_sort, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user!.userId,
      body.name,
      ctx.helpers.normalizeKey(body.name),
      body.color ?? "#38b6ff",
      body.description ?? null,
      body.currentDateText ?? null,
      body.currentDateSort ?? null,
      t,
      t,
    );
    const row = db.prepare(`${BINDER_SELECT} WHERE b.id = ?`).get(id) as BinderRow;
    res.status(201).json(binderDto(row));
  });

  app.get("/api/binders/:binderId", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const row = db.prepare(`${BINDER_SELECT} WHERE b.id = ?`).get(binderId) as BinderRow | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Binder not found" });
    res.json(binderDto(row));
  });

  app.get("/api/binders/:binderId/export", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const document = exportBinderDocument(db, binderId);
    if (!document) return res.status(404).json({ ok: false, message: "Binder not found" });
    res.setHeader("Content-Disposition", `attachment; filename=binder_${binderId}.json`);
    res.json(document);
  });

  app.patch("/api/binders/:binderId", ownerOnly, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const body = parseBody(BinderPatchBody, req);
    const existing = db.prepare("SELECT * FROM binders WHERE id = ?").get(binderId) as BinderRow | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Binder not found" });
    const name = body.name ?? existing.name;
    const color = body.color ?? existing.color;
    const description = body.description ?? existing.description;
    const currentDateText = body.currentDateText !== undefined
      ? body.currentDateText
      : existing.current_date_text;
    const currentDateSort = body.currentDateSort !== undefined
      ? body.currentDateSort
      : existing.current_date_sort;
    const t = ctx.helpers.now();
    db.prepare(`
      UPDATE binders
      SET name = ?, name_key = ?, color = ?, description = ?,
          current_date_text = ?, current_date_sort = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name,
      ctx.helpers.normalizeKey(name),
      color,
      description,
      currentDateText,
      currentDateSort,
      t,
      binderId,
    );
    const row = db.prepare(`${BINDER_SELECT} WHERE b.id = ?`).get(binderId) as BinderRow;
    res.json(binderDto(row));
  });

  app.delete("/api/binders/:binderId", ownerOnly, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const campaigns = db.prepare("SELECT id FROM campaigns WHERE binder_id = ?").all(binderId) as Array<{ id: string }>;
    const result = db.prepare("DELETE FROM binders WHERE id = ?").run(binderId);
    if (result.changes === 0) return res.status(404).json({ ok: false, message: "Binder not found" });
    for (const campaign of campaigns) {
      ctx.broadcast("campaigns:changed", { campaignId: campaign.id });
    }
    res.json({ ok: true, detachedCampaigns: campaigns.length });
  });

  app.put("/api/campaigns/:campaignId/binder", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const body = parseBody(CampaignBinderBody, req);
    const campaign = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!campaign) return res.status(404).json({ ok: false, message: "Campaign not found" });

    if (body.binderId) {
      const binder = db.prepare("SELECT id FROM binders WHERE id = ?").get(body.binderId);
      if (!binder) return res.status(404).json({ ok: false, message: "Binder not found" });
      if (!req.user!.isAdmin && !ownsBinder(db, req.user!.userId, body.binderId)) {
        return res.status(404).json({ ok: false, message: "Binder not found" });
      }
    }

    const t = ctx.helpers.now();
    db.prepare(`
      UPDATE campaigns
      SET binder_id = ?,
          current_date_text = ?,
          current_date_sort = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      body.binderId,
      body.currentDateText ?? null,
      body.currentDateSort ?? null,
      t,
      campaignId,
    );
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({
      ok: true,
      campaignId,
      binderId: body.binderId,
      currentDate: {
        text: body.currentDateText ?? null,
        sort: body.currentDateSort ?? null,
      },
      updatedAt: t,
    });
  });
}
