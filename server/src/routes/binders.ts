import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../server/context.js";
import { requireAnyDm } from "../middleware/auth.js";
import {
  binderOwnerOrAdmin,
  binderEditorOrAdmin,
  binderReaderOrAdmin,
  ownsBinder,
} from "../middleware/binderAuth.js";
import { dmOrAdmin } from "../middleware/campaignAuth.js";
import { requireCampaignExists, requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { exportBinderDocument, importBinderDocument, previewBinderDocument } from "../services/binders/nativeBinder.js";
import * as archiverModule from "archiver";
import { unzipSync } from "fflate";
import { EntityNameSchema } from "../lib/schemas.js";
import { errorMessage } from "../lib/errors.js";

const createArchive = ((archiverModule as unknown as { default?: unknown }).default ?? archiverModule) as unknown as (
  format: "zip",
  options?: { zlib?: { level: number } },
) => import("archiver").Archiver;

function parseBinderUpload(file: Express.Multer.File) {
  const isZip = file.mimetype === "application/zip" || file.originalname.toLowerCase().endsWith(".zip");
  if (!isZip) return { raw: JSON.parse(file.buffer.toString("utf8")) as unknown, images: new Map<string, Uint8Array>() };
  const entries = unzipSync(new Uint8Array(file.buffer));
  const binderJson = entries["binder.json"];
  if (!binderJson) throw new Error("Binder ZIP does not contain binder.json");
  return { raw: JSON.parse(Buffer.from(binderJson).toString("utf8")) as unknown, images: new Map(Object.entries(entries).filter(([name]) => name.startsWith("images/"))) };
}

function restoreBinderImages(ctx: ServerContext, binderId: string, recordIdMap: Record<string, string>, images: Map<string, Uint8Array>) {
  const now = ctx.helpers.now();
  for (const [archivePath, bytes] of images) {
    const match = /^images\/(mortals|deities)\/([^/.]+)(\.[a-z0-9]+)$/i.exec(archivePath);
    if (!match) continue;
    const newId = recordIdMap[match[2]!];
    if (!newId) continue;
    const kind = match[1]!;
    const extension = match[3]!.toLowerCase();
    const directoryName = kind === "mortals" ? "binder-mortal-images" : "binder-deity-images";
    const directory = ctx.path.join(ctx.paths.dataDir, directoryName);
    ctx.fs.mkdirSync(directory, { recursive: true });
    const filename = `${newId}-${now}${extension}`;
    ctx.fs.writeFileSync(ctx.path.join(directory, filename), bytes);
    const url = `/${directoryName}/${filename}`;
    const table = kind === "mortals" ? "mortals" : "deities";
    ctx.db.prepare(`UPDATE ${table} SET image_url=?, image_updated_at=?, updated_at=? WHERE id=? AND id IN (SELECT id FROM binder_records WHERE binder_id=?)`).run(url, now, now, newId, binderId);
  }
}

const optionalText = (max: number) => z.string().max(max).nullable().optional().transform((value) => {
  if (value === undefined || value === null) return value;
  return value.trim() === "" ? null : value;
});

const BinderCreateBody = z.object({
  name: EntityNameSchema,
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  description: optionalText(200_000),
  currentDateText: z.string().trim().min(1).max(100),
  currentDateSort: z.number().int(),
}).strict();

const BinderPatchBody = z.object({
  name: EntityNameSchema.optional(),
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

const BinderMemberBody = z.object({
  username: z.string().trim().min(1).max(64),
  role: z.enum(["collaborator", "viewer"]),
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

function binderDto(row: BinderRow, db?: ServerContext["db"], userId?: string, isAdmin = false) {
  const membership = db && userId
    ? db.prepare("SELECT role FROM binder_memberships WHERE binder_id=? AND user_id=?").get(row.id, userId) as { role: "collaborator" | "viewer" } | undefined
    : undefined;
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
    accessRole: isAdmin || row.owner_user_id === userId ? "owner" : membership?.role ?? "viewer",
  };
}

const BINDER_SELECT = `
  SELECT b.id, b.owner_user_id, b.name, b.name_key, b.color, b.description,
         b.current_date_text, b.current_date_sort, b.created_at, b.updated_at,
         (SELECT COUNT(*) FROM campaigns c WHERE c.binder_id = b.id) AS campaign_count,
         (SELECT COUNT(*) FROM binder_records r WHERE r.binder_id = b.id) AS record_count
  FROM binders b
`;

function recordRoute(binderId: string, type: string, id: string): string {
  const sections: Record<string, string> = {
    mortal: "mortals", deity: "deities", race: "races", position: "positions",
    domain: "domains", organization: "organizations", continent: "continents",
    country: "countries", location: "locations", poi: "points-of-interest",
    item: "items", event: "events",
  };
  return `/binder/${binderId}/${sections[type] ?? type}/${id}`;
}

export function registerBinderRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const ownerOnly = binderOwnerOrAdmin(db);
  const editor = binderEditorOrAdmin(db);
  const reader = binderReaderOrAdmin(db);
  const anyDm = requireAnyDm(db);

  app.get("/api/binders", anyDm, (req, res) => {
    const rows = req.user!.isAdmin
      ? db.prepare(`${BINDER_SELECT} ORDER BY b.updated_at DESC`).all()
      : db.prepare(`
          ${BINDER_SELECT}
          WHERE b.owner_user_id = ?
             OR EXISTS (SELECT 1 FROM binder_memberships bm WHERE bm.binder_id=b.id AND bm.user_id=?)
             OR EXISTS (
               SELECT 1
               FROM campaigns c
               JOIN campaign_membership cm ON cm.campaign_id = c.id
               WHERE c.binder_id = b.id
                 AND cm.user_id = ?
                 AND cm.role = 'dm'
             )
          ORDER BY b.updated_at DESC
        `).all(req.user!.userId, req.user!.userId, req.user!.userId);
    res.json((rows as BinderRow[]).map((row) => binderDto(row, db, req.user!.userId, req.user!.isAdmin)));
  });

  app.post("/api/binders/import", anyDm, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "Binder JSON or ZIP file is required" });
    try {
      const upload = parseBinderUpload(req.file);
      const result = importBinderDocument(db, upload.raw, req.user!.userId, ctx.helpers);
      restoreBinderImages(ctx, result.binderId, result.recordIdMap, upload.images);
      res.status(201).json({ binderId: result.binderId, name: result.name, recordCount: result.recordCount });
    } catch (error) {
      const message = error instanceof SyntaxError
        ? "The selected file is not valid JSON"
        : error instanceof z.ZodError
          ? `Invalid Binder export: ${error.issues[0]?.message ?? "schema validation failed"}`
          : errorMessage(error, "Binder import failed");
      res.status(400).json({ ok: false, message });
    }
  });

  app.post("/api/binders/import/preview", anyDm, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "Binder JSON or ZIP file is required" });
    try {
      const upload = parseBinderUpload(req.file);
      const preview = previewBinderDocument(db, upload.raw);
      res.json({ ...preview, imageCount: upload.images.size });
    } catch (error) {
      const message = error instanceof SyntaxError ? "The selected file is not valid JSON"
        : error instanceof z.ZodError ? `Invalid Binder export: ${error.issues[0]?.message ?? "schema validation failed"}`
        : errorMessage(error, "Binder preview failed");
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
    res.status(201).json(binderDto(row, db, req.user!.userId, req.user!.isAdmin));
  });

  app.get("/api/binders/:binderId", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const row = db.prepare(`${BINDER_SELECT} WHERE b.id = ?`).get(binderId) as BinderRow | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Binder not found" });
    res.json(binderDto(row, db, req.user!.userId, req.user!.isAdmin));
  });

  app.get("/api/binders/:binderId/dashboard", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const binder = db.prepare("SELECT current_date_sort FROM binders WHERE id=?").get(binderId) as { current_date_sort: number | null } | undefined;
    if (!binder) return res.status(404).json({ ok: false, message: "Binder not found" });
    const counts = db.prepare(`SELECT record_type AS type, COUNT(*) AS count FROM binder_records WHERE binder_id=? GROUP BY record_type ORDER BY record_type`).all(binderId);
    const recent = (db.prepare(`SELECT id,name,record_type AS type,updated_at AS updatedAt FROM binder_records WHERE binder_id=? ORDER BY updated_at DESC,id LIMIT 8`).all(binderId) as Array<any>)
      .map((row) => ({ ...row, route: recordRoute(binderId, row.type, row.id) }));
    const nearbyEvents = (db.prepare(`
      SELECT br.id,br.name,be.date_text AS dateText,be.date_sort AS dateSort,
             ABS(be.date_sort-?) AS distance
      FROM binder_events be JOIN binder_records br ON br.id=be.id
      WHERE br.binder_id=? AND be.date_sort IS NOT NULL
      ORDER BY distance,be.date_sort LIMIT 6
    `).all(binder.current_date_sort ?? 0, binderId) as Array<any>)
      .map((row) => ({ ...row, route: recordRoute(binderId, "event", row.id) }));
    const incomplete = (db.prepare(`
      SELECT br.id,br.name,br.record_type AS type
      FROM binder_records br WHERE br.binder_id=? AND (
        (br.record_type='mortal' AND COALESCE((SELECT description FROM mortals WHERE id=br.id),'')='') OR
        (br.record_type='deity' AND COALESCE((SELECT description FROM deities WHERE id=br.id),'')='') OR
        (br.record_type='organization' AND COALESCE((SELECT description FROM binder_organizations WHERE id=br.id),'')='') OR
        (br.record_type='item' AND COALESCE((SELECT description FROM binder_items WHERE id=br.id),'')='') OR
        (br.record_type='event' AND COALESCE((SELECT description FROM binder_events WHERE id=br.id),'')='')
      ) ORDER BY br.updated_at DESC LIMIT 8
    `).all(binderId) as Array<any>).map((row) => ({ ...row, route: recordRoute(binderId, row.type, row.id) }));
    const unlinkedNpcCount = Number(db.prepare(`
      SELECT COUNT(*) FROM binder_npcs npc JOIN binder_records br ON br.id=npc.mortal_id
      WHERE br.binder_id=? AND NOT EXISTS (SELECT 1 FROM inpcs i WHERE i.binder_mortal_id=npc.mortal_id)
    `).pluck().get(binderId) ?? 0);
    const undatedEventCount = Number(db.prepare(`SELECT COUNT(*) FROM binder_events be JOIN binder_records br ON br.id=be.id WHERE br.binder_id=? AND be.date_sort IS NULL`).pluck().get(binderId) ?? 0);
    res.json({ counts, recent, nearbyEvents, incomplete, unlinkedNpcCount, undatedEventCount });
  });

  app.get("/api/binders/:binderId/health", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    type IssueRow = { id: string; name: string; type: string; detail: string };
    const queries: Array<{ code: string; severity: "warning" | "info"; title: string; sql: string }> = [
      { code: "broken_mentions", severity: "warning", title: "Broken mentions", sql: `SELECT br.id,br.name,br.record_type type,'Mention target is missing' detail FROM binder_record_mentions m JOIN binder_records br ON br.id=m.source_record_id WHERE br.binder_id=? AND m.target_record_id IS NULL` },
      { code: "duplicate_names", severity: "info", title: "Duplicate names", sql: `SELECT MIN(id) id,name,record_type type,COUNT(*)||' records share this name' detail FROM binder_records WHERE binder_id=? GROUP BY record_type,name_key HAVING COUNT(*)>1` },
      { code: "npc_mechanics", severity: "warning", title: "NPCs without mechanics", sql: `SELECT br.id,br.name,br.record_type type,'No Compendium statblock is linked' detail FROM binder_npcs npc JOIN binder_records br ON br.id=npc.mortal_id WHERE br.binder_id=? AND npc.monster_id IS NULL` },
      { code: "unplaced_mortals", severity: "info", title: "Unplaced Mortals", sql: `SELECT br.id,br.name,br.record_type type,'No location is assigned' detail FROM mortals m JOIN binder_records br ON br.id=m.id WHERE br.binder_id=? AND m.residence_record_id IS NULL` },
      { code: "unplaced_pois", severity: "info", title: "Unplaced Points of Interest", sql: `SELECT br.id,br.name,br.record_type type,'No parent place is assigned' detail FROM binder_points_of_interest p JOIN binder_records br ON br.id=p.id WHERE br.binder_id=? AND p.location_id IS NULL AND p.country_id IS NULL AND p.parent_poi_id IS NULL` },
      { code: "event_dates", severity: "warning", title: "Invalid Event ranges", sql: `SELECT br.id,br.name,br.record_type type,'End date precedes start date' detail FROM binder_events e JOIN binder_records br ON br.id=e.id WHERE br.binder_id=? AND e.date_sort IS NOT NULL AND e.end_date_sort IS NOT NULL AND e.end_date_sort<e.date_sort` },
    ];
    const groups = queries.map((query) => {
      const rows = db.prepare(query.sql).all(binderId) as IssueRow[];
      return { code: query.code, severity: query.severity, title: query.title, issues: rows.map((row) => ({ ...row, route: recordRoute(binderId, row.type, row.id) })) };
    });
    const issueCount = groups.reduce((sum, group) => sum + group.issues.length, 0);
    res.json({ healthy: issueCount === 0, issueCount, groups });
  });

  app.get("/api/binders/:binderId/export", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const document = exportBinderDocument(db, binderId);
    if (!document) return res.status(404).json({ ok: false, message: "Binder not found" });
    if (req.query.images !== "1") {
      res.setHeader("Content-Disposition", `attachment; filename=binder_${binderId}.json`);
      return res.json(document);
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=binder_${binderId}.zip`);
    const archive = createArchive("zip", { zlib: { level: 9 } });
    archive.on("error", (error: Error) => { if (!res.headersSent) res.status(500); res.end(error.message); });
    archive.pipe(res);
    archive.append(JSON.stringify(document, null, 2), { name: "binder.json" });
    const imageRows = db.prepare(`
      SELECT br.id, br.record_type, COALESCE(m.image_url,d.image_url) image_url
      FROM binder_records br
      LEFT JOIN mortals m ON m.id=br.id LEFT JOIN deities d ON d.id=br.id
      WHERE br.binder_id=? AND COALESCE(m.image_url,d.image_url) IS NOT NULL
    `).all(binderId) as Array<{ id: string; record_type: string; image_url: string }>;
    for (const row of imageRows) {
      const relative = row.image_url.replace(/^\/+/, "");
      const absolute = ctx.path.resolve(ctx.paths.dataDir, relative.replace(/^binder-(?:mortal|deity)-images[\\/]/, (value) => value));
      if (!absolute.startsWith(ctx.path.resolve(ctx.paths.dataDir)) || !ctx.fs.existsSync(absolute)) continue;
      const extension = ctx.path.extname(absolute) || ".webp";
      archive.file(absolute, { name: `images/${row.record_type === "mortal" ? "mortals" : "deities"}/${row.id}${extension}` });
    }
    void archive.finalize();
  });

  app.patch("/api/binders/:binderId", editor, (req, res) => {
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
    res.json(binderDto(row, db, req.user!.userId, req.user!.isAdmin));
  });

  app.get("/api/binders/:binderId/members", ownerOnly, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const owner = db.prepare(`SELECT u.id,u.username,u.name FROM binders b JOIN users u ON u.id=b.owner_user_id WHERE b.id=?`).get(binderId) as Record<string, unknown>;
    const members = db.prepare(`
      SELECT u.id,u.username,u.name,bm.role,bm.created_at,bm.updated_at
      FROM binder_memberships bm JOIN users u ON u.id=bm.user_id
      WHERE bm.binder_id=? ORDER BY u.name COLLATE NOCASE
    `).all(binderId) as Array<Record<string, unknown>>;
    res.json([{ ...owner, role: "owner" }, ...members.map((row) => ({
      id: row.id, username: row.username, name: row.name, role: row.role,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }))]);
  });

  app.put("/api/binders/:binderId/members", ownerOnly, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const body = parseBody(BinderMemberBody, req);
    const user = db.prepare("SELECT id,username,name FROM users WHERE LOWER(username)=LOWER(?)").get(body.username) as { id: string; username: string; name: string } | undefined;
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });
    const binder = db.prepare("SELECT owner_user_id FROM binders WHERE id=?").get(binderId) as { owner_user_id: string };
    if (user.id === binder.owner_user_id) return res.status(400).json({ ok: false, message: "The owner already has full access" });
    const t = ctx.helpers.now();
    db.prepare(`INSERT INTO binder_memberships (binder_id,user_id,role,created_at,updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(binder_id,user_id) DO UPDATE SET role=excluded.role,updated_at=excluded.updated_at`)
      .run(binderId, user.id, body.role, t, t);
    res.json({ ...user, role: body.role, updatedAt: t });
  });

  app.delete("/api/binders/:binderId/members/:userId", ownerOnly, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const userId = requireParam(req, res, "userId");
    if (!binderId || !userId) return;
    db.prepare("DELETE FROM binder_memberships WHERE binder_id=? AND user_id=?").run(binderId, userId);
    res.json({ ok: true });
  });

  app.delete("/api/binders/:binderId", ownerOnly, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const campaigns = db.prepare("SELECT id FROM campaigns WHERE binder_id = ?").all(binderId) as Array<{ id: string }>;
    const result = db.transaction(() => {
      // These hierarchy links intentionally use RESTRICT for ordinary record
      // deletion. When deleting the entire Binder, however, every linked place
      // is going away together. Clear the internal hierarchy first so SQLite's
      // cascade order cannot trip over a child that still references its parent.
      db.prepare(`
        UPDATE binder_points_of_interest
        SET location_id = NULL, country_id = NULL, parent_poi_id = NULL
        WHERE id IN (SELECT id FROM binder_records WHERE binder_id = ?)
      `).run(binderId);
      db.prepare(`
        UPDATE binder_locations
        SET country_id = NULL, continent_id = NULL
        WHERE id IN (SELECT id FROM binder_records WHERE binder_id = ?)
      `).run(binderId);
      db.prepare(`
        UPDATE binder_countries
        SET continent_id = NULL
        WHERE id IN (SELECT id FROM binder_records WHERE binder_id = ?)
      `).run(binderId);
      return db.prepare("DELETE FROM binders WHERE id = ?").run(binderId);
    })();
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
    if (!requireCampaignExists(db, campaignId, res)) return;

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
