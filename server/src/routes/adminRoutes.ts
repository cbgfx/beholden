// server/src/routes/adminRoutes.ts
// Admin-only user management: GET/POST/PUT/DELETE /api/admin/users

import { z } from "zod";
import type { Express } from "express";
import { ZipArchive } from "archiver";
import { unzipSync } from "fflate";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { hashPassword } from "../lib/jwtAuth.js";
import { syncOwnedPlayerName } from "../services/characters.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { rowToUser } from "../lib/db.js";
import { importDatabaseFile } from "../services/databaseTransfer.js";
import { existingImageDirectories, isDatabaseZipUpload, selectImageEntries, writeImageEntries } from "../services/databaseImageArchive.js";
import { requireCampaignExists } from "../lib/routeHelpers.js";

const CreateUserBody = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(4),
  name: z.string().trim().min(1).max(128),
  isAdmin: z.boolean().optional().default(false),
});

const UpdateUserBody = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  username: z.string().trim().min(1).max(64).optional(),
  password: z.string().min(4).optional(),
  isAdmin: z.boolean().optional(),
});

const MembershipBody = z.object({
  userId: z.string().min(1),
  role: z.enum(["dm", "player"]),
});

export function registerAdminRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now, uid } = ctx.helpers;

  // Streams a consistent snapshot of the live database (safe under WAL mode), bundled as a zip
  // together with every on-disk image directory, so a restore never leaves broken image links.
  app.get("/api/admin/database/export", requireAuth, requireAdmin, (_req, res, next) => {
    const tmpFile = ctx.path.join(ctx.os.tmpdir(), `beholden-export-${uid()}.db`);
    db.backup(tmpFile)
      .then(() => {
        const stamp = new Date(now()).toISOString().slice(0, 10);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename=beholden-${stamp}.zip`);
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const cleanup = () => ctx.fs.unlink(tmpFile, () => {});
        archive.on("error", (error: Error) => {
          cleanup();
          if (!res.headersSent) res.status(500);
          res.end(error.message);
        });
        archive.on("end", cleanup);
        archive.pipe(res);
        archive.file(tmpFile, { name: "beholden.db" });
        for (const { name, absolutePath } of existingImageDirectories(ctx.paths.dataDir)) {
          archive.directory(absolutePath, name);
        }
        void archive.finalize();
      })
      .catch((cause) => {
        ctx.fs.unlink(tmpFile, () => {});
        next(cause as Error);
      });
  });

  // Replaces every row in the live database with an uploaded snapshot, in place, and (for a zip
  // upload) restores the bundled images alongside it. A pre-import backup of the database is
  // written automatically; see services/databaseTransfer.ts. A plain .db upload (an older export,
  // before images were bundled) is still accepted, unchanged.
  app.post("/api/admin/database/import", requireAuth, requireAdmin, ctx.dbImportUpload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });
    const uploadedPath = req.file.path;
    let dbPathToImport = uploadedPath;
    let extractedDbPath: string | null = null;
    try {
      if (isDatabaseZipUpload({ mimetype: req.file.mimetype, originalname: req.file.originalname })) {
        const entries = unzipSync(ctx.fs.readFileSync(uploadedPath));
        const dbEntry = entries["beholden.db"];
        if (!dbEntry) return res.status(400).json({ ok: false, message: "Uploaded zip does not contain beholden.db" });
        extractedDbPath = ctx.path.join(ctx.os.tmpdir(), `beholden-import-${uid()}.db`);
        ctx.fs.writeFileSync(extractedDbPath, dbEntry);
        dbPathToImport = extractedDbPath;
        writeImageEntries(ctx.paths.dataDir, selectImageEntries(entries));
      }
      const result = importDatabaseFile(ctx, dbPathToImport);
      ctx.broadcast("database:imported", { at: now() });
      res.json({ ok: true, ...result });
    } catch (cause) {
      const status = typeof (cause as { status?: unknown })?.status === "number" ? (cause as { status: number }).status : 500;
      res.status(status).json({ ok: false, message: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      ctx.fs.unlink(uploadedPath, () => {});
      if (extractedDbPath) ctx.fs.unlink(extractedDbPath, () => {});
    }
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare("SELECT id, username, name, is_admin, last_login_at, created_at, updated_at FROM users ORDER BY name ASC")
      .all() as Record<string, unknown>[];
    res.json(rows.map(rowToUser));
  });

  app.post("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
    const body = parseBody(CreateUserBody, req);
    body.username = body.username.toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(body.username);
    if (existing) {
      return res.status(409).json({ ok: false, message: "Username already taken" });
    }
    const id = uid();
    const t = now();
    const passhash = hashPassword(body.password);
    db.prepare(
      "INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, body.username, passhash, body.name, body.isAdmin ? 1 : 0, t, t);
    res.status(201).json({ id, username: body.username, name: body.name, isAdmin: body.isAdmin, createdAt: t, updatedAt: t });
  });

  app.put("/api/admin/users/:userId", requireAuth, requireAdmin, (req, res) => {
    const { userId } = req.params;
    if (typeof userId !== "string") {
      return res.status(400).json({ ok: false, message: "Invalid user ID" });
    }
    const row = db
      .prepare("SELECT id, username, name, is_admin, last_login_at, created_at, updated_at FROM users WHERE id = ?")
      .get(userId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "User not found" });

    const body = parseBody(UpdateUserBody, req);

    if (body.username && body.username !== row.username) {
      const conflict = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?").get(body.username, userId);
      if (conflict) return res.status(409).json({ ok: false, message: "Username already taken" });
    }

    const t = now();
    const setClauses: string[] = ["updated_at = ?"];
    const values: unknown[] = [t];

    if (body.name !== undefined)     { setClauses.push("name = ?");     values.push(body.name); }
    if (body.username !== undefined) { setClauses.push("username = ?"); values.push(body.username.toLowerCase()); }
    if (body.isAdmin !== undefined)  { setClauses.push("is_admin = ?"); values.push(body.isAdmin ? 1 : 0); }
    if (body.password !== undefined) { setClauses.push("passhash = ?"); values.push(hashPassword(body.password)); }

    values.push(userId);
    db.prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
    if (body.name !== undefined) {
      for (const player of syncOwnedPlayerName(db, userId, body.name, t)) {
        ctx.broadcast("players:delta", {
          campaignId: player.campaign_id,
          action: "upsert",
          playerId: player.id,
          characterId: player.character_id,
        });
      }
    }

    const updated = db
      .prepare("SELECT id, username, name, is_admin, last_login_at, created_at, updated_at FROM users WHERE id = ?")
      .get(userId) as Record<string, unknown>;
    res.json(rowToUser(updated));
  });

  app.delete("/api/admin/users/:userId", requireAuth, requireAdmin, (req, res) => {
    const { userId } = req.params;
    const target = db
      .prepare("SELECT id, is_admin FROM users WHERE id = ?")
      .get(userId) as { id: string; is_admin: number } | undefined;
    if (!target) return res.status(404).json({ ok: false, message: "User not found" });

    // Prevent deleting the last admin.
    if (target.is_admin) {
      const adminCount = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get() as { n: number }).n;
      if (adminCount <= 1) {
        return res.status(409).json({ ok: false, message: "Cannot delete the last admin user" });
      }
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Campaign memberships
  // ---------------------------------------------------------------------------

  // List members of a campaign (includes user details).
  app.get("/api/admin/campaigns/:campaignId/members", requireAuth, requireAdmin, (req, res) => {
    const { campaignId } = req.params;
    const rows = db.prepare(`
      SELECT cm.id, cm.role, cm.created_at, cm.updated_at,
             u.id AS user_id, u.username, u.name, u.is_admin
      FROM campaign_membership cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.campaign_id = ?
      ORDER BY cm.role ASC, u.name ASC
    `).all(campaignId) as Record<string, unknown>[];

    res.json(rows.map((r) => ({
      id: r.id,
      role: r.role,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: {
        id: r.user_id,
        username: r.username,
        name: r.name,
        isAdmin: Boolean(r.is_admin),
      },
    })));
  });

  // Add a user to a campaign.
  app.post("/api/admin/campaigns/:campaignId/members", requireAuth, requireAdmin, (req, res) => {
    const campaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
    if (!campaignId) return res.status(400).json({ ok: false, message: "Missing route parameter: campaignId" });
    const body = parseBody(MembershipBody, req);

    if (!requireCampaignExists(db, campaignId, res)) return;

    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(body.userId) as { id: string } | undefined;
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });

    const existing = db.prepare("SELECT id FROM campaign_membership WHERE campaign_id = ? AND user_id = ?").get(campaignId, body.userId);
    if (existing) return res.status(409).json({ ok: false, message: "User is already a member of this campaign" });

    const id = uid();
    const t = now();
    db.prepare(
      "INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, campaignId, body.userId, body.role, t, t);

    res.status(201).json({ id, campaignId, userId: body.userId, role: body.role, createdAt: t, updatedAt: t });
  });

  // Change a member's role.
  app.put("/api/admin/campaigns/:campaignId/members/:membershipId", requireAuth, requireAdmin, (req, res) => {
    const { membershipId } = req.params;
    const body = parseBody(MembershipBody.pick({ role: true }), req);
    const t = now();
    const result = db.prepare("UPDATE campaign_membership SET role = ?, updated_at = ? WHERE id = ?").run(body.role, t, membershipId);
    if (result.changes === 0) return res.status(404).json({ ok: false, message: "Membership not found" });
    res.json({ ok: true });
  });

  // Remove a member from a campaign.
  app.delete("/api/admin/campaigns/:campaignId/members/:membershipId", requireAuth, requireAdmin, (req, res) => {
    const { membershipId } = req.params;
    const result = db.prepare("DELETE FROM campaign_membership WHERE id = ?").run(membershipId);
    if (result.changes === 0) return res.status(404).json({ ok: false, message: "Membership not found" });
    res.json({ ok: true });
  });
}
