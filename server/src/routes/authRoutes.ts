// server/src/routes/authRoutes.ts
// POST /api/auth/login  — exchange credentials for JWT
// GET  /api/auth/me     — return current user from token

import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { verifyPassword, signToken } from "../lib/jwtAuth.js";
import { requireAuth } from "../middleware/auth.js";

const LoginBody = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  function hasDmAccess(userId: string): boolean {
    const row = db
      .prepare("SELECT id FROM campaign_membership WHERE user_id = ? AND role = 'dm' LIMIT 1")
      .get(userId);
    return Boolean(row);
  }

  app.post("/api/auth/login", (req, res) => {
    const body = parseBody(LoginBody, req);
    const row = db
      .prepare("SELECT id, username, passhash, name, is_admin FROM users WHERE username = ?")
      .get(body.username) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(body.password, row.passhash as string)) {
      return res.status(401).json({ ok: false, message: "Invalid username or password" });
    }

    const token = signToken({
      userId: row.id as string,
      username: row.username as string,
      isAdmin: Boolean(row.is_admin),
    });

    const isAdmin = Boolean(row.is_admin);
    res.json({
      token,
      user: {
        id: row.id,
        username: row.username,
        name: row.name,
        isAdmin,
        hasDmAccess: isAdmin || hasDmAccess(row.id as string),
      },
    });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const row = db
      .prepare("SELECT id, username, name, is_admin FROM users WHERE id = ?")
      .get(req.user!.userId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "User not found" });
    const isAdmin = Boolean(row.is_admin);
    res.json({
      id: row.id,
      username: row.username,
      name: row.name,
      isAdmin,
      hasDmAccess: isAdmin || hasDmAccess(row.id as string),
    });
  });
}
