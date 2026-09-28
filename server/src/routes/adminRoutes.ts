// server/src/routes/adminRoutes.ts
// Admin-only user management: GET/POST/PUT/DELETE /api/admin/users

import { z } from "zod";
import type { Express } from "express";
import { ZipArchive } from "archiver";
import { unzipSync } from "fflate";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../lib/validate.js";
import { hashPasswordAsync } from "../lib/jwtAuth.js";
import { syncOwnedPlayerName } from "../services/characters.js";
import { deleteCharacterWithPlayers, removeUserPlayersFromCampaign } from "../services/characterDeletion.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { rowToUser } from "../lib/db.js";
import { importDatabaseFile } from "../services/databaseTransfer.js";
import { existingImageDirectories, isDatabaseZipUpload, selectImageEntries, writeImageEntries } from "../services/databaseImageArchive.js";
import { requireCampaignExists } from "../lib/routeHelpers.js";
import { revokeUserSessions } from "../lib/sessionAuth.js";
import { recordAuthAudit } from "../lib/authAudit.js";

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

  // MARK: - GET /api/admin/database/export
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

  // MARK: - POST /api/admin/database/import
  app.post("/api/admin/database/import", requireAuth, requireAdmin, ctx.dbImportUpload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });
    const uploadedPath = req.file.path;
    let dbPathToImport = uploadedPath;
    let extractedDbPath: string | null = null;
    let images: ReturnType<typeof selectImageEntries> = [];
    try {
      if (isDatabaseZipUpload({ mimetype: req.file.mimetype, originalname: req.file.originalname })) {
        const entries = unzipSync(ctx.fs.readFileSync(uploadedPath));
        const dbEntry = entries["beholden.db"];
        if (!dbEntry) return res.status(400).json({ ok: false, message: "Uploaded zip does not contain beholden.db" });
        extractedDbPath = ctx.path.join(ctx.os.tmpdir(), `beholden-import-${uid()}.db`);
        ctx.fs.writeFileSync(extractedDbPath, dbEntry);
        dbPathToImport = extractedDbPath;
        images = selectImageEntries(entries);
      }
      const result = importDatabaseFile(ctx, dbPathToImport);
      // Images only once the database itself was accepted: a refused upload changes nothing.
      writeImageEntries(ctx.paths.dataDir, images);
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

  // MARK: - GET /api/admin/users
  app.get("/api/admin/users", requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare("SELECT id, username, name, is_admin, last_login_at, created_at, updated_at FROM users ORDER BY name ASC")
      .all() as Record<string, unknown>[];
    res.json(rows.map(rowToUser));
  });

  app.get("/api/admin/auth-audit", requireAuth, requireAdmin, (req, res) => {
    const requested = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(500, Math.trunc(requested))) : 100;
    const rows = db.prepare(`SELECT id,user_id,username,event,client_ip,detail_json,created_at
      FROM auth_audit_log ORDER BY created_at DESC LIMIT ?`).all(limit) as Array<Record<string, unknown>>;
    res.setHeader("Cache-Control", "no-store");
    res.json(rows.map((row) => ({
      id: row.id, userId: row.user_id, username: row.username, event: row.event,
      clientIp: row.client_ip, detail: row.detail_json ? JSON.parse(String(row.detail_json)) : null,
      createdAt: row.created_at,
    })));
  });

  // MARK: - POST /api/admin/users
  app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    const body = parseBody(CreateUserBody, req);
    body.username = body.username.toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)").get(body.username);
    if (existing) {
      return res.status(409).json({ ok: false, message: "Username already taken" });
    }
    const id = uid();
    const t = now();
    const passhash = await hashPasswordAsync(body.password);
    db.prepare(
      "INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, body.username, passhash, body.name, body.isAdmin ? 1 : 0, t, t);
    recordAuthAudit(db, req, "account_created", { userId: id, username: body.username, detail: { isAdmin: body.isAdmin } });
    res.status(201).json({ id, username: body.username, name: body.name, isAdmin: body.isAdmin, createdAt: t, updatedAt: t });
  });

  // MARK: - PUT /api/admin/users/:userId
  app.put("/api/admin/users/:userId", requireAuth, requireAdmin, async (req, res) => {
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
    if (body.isAdmin === false && row.is_admin) {
      const adminCount = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get() as { n: number }).n;
      if (adminCount <= 1) return res.status(409).json({ ok: false, message: "Cannot demote the last admin user" });
    }
    if (body.isAdmin !== undefined)  { setClauses.push("is_admin = ?"); values.push(body.isAdmin ? 1 : 0); }
    if (body.password !== undefined) { setClauses.push("passhash = ?"); values.push(await hashPasswordAsync(body.password)); }

    values.push(userId);
    db.prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
    if (body.password !== undefined) revokeUserSessions(db, userId, t);
    if (body.password !== undefined) recordAuthAudit(db, req, "password_reset", { userId, username: String(row.username) });
    if (body.isAdmin !== undefined && body.isAdmin !== Boolean(row.is_admin)) {
      recordAuthAudit(db, req, "privilege_changed", { userId, username: String(row.username), detail: { isAdmin: body.isAdmin } });
    }
    if (body.username !== undefined && body.username.toLowerCase() !== row.username) {
      recordAuthAudit(db, req, "username_changed", { userId, username: body.username.toLowerCase(), detail: { changedByAdmin: true } });
    }
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

  // MARK: - DELETE /api/admin/users/:userId
  app.delete("/api/admin/users/:userId", requireAuth, requireAdmin, (req, res) => {
    const { userId } = req.params;
    const target = db
      .prepare("SELECT id, username, is_admin FROM users WHERE id = ?")
      .get(userId) as { id: string; username: string; is_admin: number } | undefined;
    if (!target) return res.status(404).json({ ok: false, message: "User not found" });

    // Prevent deleting the last admin.
    if (target.is_admin) {
      const adminCount = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get() as { n: number }).n;
      if (adminCount <= 1) {
        return res.status(409).json({ ok: false, message: "Cannot delete the last admin user" });
      }
    }

    // Their characters go the same way a player deleting one would: out of every roster and every
    // fight, portraits included. The cascade alone would leave nameless players behind.
    const characterIds = (db.prepare("SELECT id FROM user_characters WHERE user_id = ?").all(userId) as Array<{ id: string }>)
      .map((row) => row.id);
    db.transaction(() => {
      for (const characterId of characterIds) deleteCharacterWithPlayers(ctx, characterId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    })();
    recordAuthAudit(db, req, "account_deleted", { username: target.username, detail: { userId } });
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Campaign memberships
  // ---------------------------------------------------------------------------

  // List members of a campaign (includes user details).

  // MARK: - GET /api/admin/campaigns/:campaignId/members
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

  // MARK: - POST /api/admin/campaigns/:campaignId/members
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

  // MARK: - PUT /api/admin/campaigns/:campaignId/members/:membershipId
  app.put("/api/admin/campaigns/:campaignId/members/:membershipId", requireAuth, requireAdmin, (req, res) => {
    const { campaignId, membershipId } = req.params;
    const body = parseBody(MembershipBody.pick({ role: true }), req);
    const t = now();
    const result = db.prepare("UPDATE campaign_membership SET role = ?, updated_at = ? WHERE id = ? AND campaign_id = ?").run(body.role, t, membershipId, campaignId);
    if (result.changes === 0) return res.status(404).json({ ok: false, message: "Membership not found" });
    res.json({ ok: true });
  });

  // Remove a member from a campaign.

  // MARK: - DELETE /api/admin/campaigns/:campaignId/members/:membershipId
  app.delete("/api/admin/campaigns/:campaignId/members/:membershipId", requireAuth, requireAdmin, (req, res) => {
    const { campaignId, membershipId } = req.params;
    const membership = db.prepare("SELECT user_id FROM campaign_membership WHERE id = ? AND campaign_id = ?")
      .get(membershipId, campaignId) as { user_id: string } | undefined;
    if (!membership) return res.status(404).json({ ok: false, message: "Membership not found" });
    // Leaving a campaign takes the user's players with them: off the roster and out of its fights.
    // Their characters stay on their account, just no longer assigned here.
    db.transaction(() => {
      removeUserPlayersFromCampaign(ctx, membership.user_id, String(campaignId));
      db.prepare("DELETE FROM campaign_membership WHERE id = ?").run(membershipId);
    })();
    res.json({ ok: true });
  });
}
