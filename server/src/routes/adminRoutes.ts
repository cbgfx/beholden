// server/src/routes/adminRoutes.ts
// Admin-only user management: GET/POST/PUT/DELETE /api/admin/users

import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { hashPassword } from "../lib/jwtAuth.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { rowToUser } from "../lib/db.js";

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

  app.get("/api/admin/users", requireAuth, requireAdmin, (_req, res) => {
    const rows = db
      .prepare("SELECT id, username, name, is_admin, created_at, updated_at FROM users ORDER BY name ASC")
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
    const row = db
      .prepare("SELECT id, username, name, is_admin, created_at, updated_at FROM users WHERE id = ?")
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

    const updated = db
      .prepare("SELECT id, username, name, is_admin, created_at, updated_at FROM users WHERE id = ?")
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
    const { campaignId } = req.params;
    const body = parseBody(MembershipBody, req);

    const campaign = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!campaign) return res.status(404).json({ ok: false, message: "Campaign not found" });

    const user = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(body.userId) as { id: string; is_admin: number } | undefined;
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });
    if (user.is_admin) return res.status(400).json({ ok: false, message: "Admins have access to all campaigns — no membership needed" });

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
