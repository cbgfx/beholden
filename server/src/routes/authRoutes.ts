// server/src/routes/authRoutes.ts
// Login, session management, and the current account profile.

import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../lib/validate.js";
import { hashPassword, hashPasswordAsync, verifyPasswordAsync } from "../lib/jwtAuth.js";
import { requireAuth } from "../middleware/auth.js";
import { syncOwnedPlayerName } from "../services/characters.js";
import { registerWorkspacePreferences } from "./workspacePreferences.js";
import { clearSessionCookie, createSession, revokeSession, revokeUserSessions, rotateSessionCsrf, setSessionCookie } from "../lib/sessionAuth.js";
import { recordAuthAudit } from "../lib/authAudit.js";

const LoginBody = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const UpdateProfileBody = z.object({
  name:        z.string().trim().min(1).optional(),
  username:    z.string().trim().min(1).optional(),
  newPassword: z.string().min(4).optional(),
  currentPassword: z.string().optional(),
  textScale: z.number().min(0.85).max(1.3).optional(),
});

export function registerAuthRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  registerWorkspacePreferences(app, ctx);

  function hasDmAccess(userId: string): boolean {
    const row = db
      .prepare("SELECT id FROM campaign_membership WHERE user_id = ? AND role = 'dm' LIMIT 1")
      .get(userId);
    return Boolean(row);
  }

  app.post("/api/auth/login", async (req, res) => {
    const body = parseBody(LoginBody, req);
    const row = db
      .prepare("SELECT id, username, passhash, name, is_admin, text_scale FROM users WHERE LOWER(username) = LOWER(?)")
      .get(body.username) as Record<string, unknown> | undefined;

    const passwordMatches = await verifyPasswordAsync(body.password, row ? row.passhash as string : DUMMY_PASSWORD_HASH);
    if (!row || !passwordMatches) {
      recordAuthAudit(db, req, "login_failed", { username: body.username.toLowerCase() });
      return res.status(401).json({ ok: false, message: "Invalid username or password" });
    }

    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(Date.now(), row.id);
    const session = createSession(db, row.id as string);
    setSessionCookie(req, res, session.token);
    recordAuthAudit(db, req, "login_succeeded", { userId: row.id as string, username: row.username as string });

    const isAdmin = Boolean(row.is_admin);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      csrfToken: session.csrfToken,
      user: {
        id: row.id,
        username: row.username,
        name: row.name,
        isAdmin,
        hasDmAccess: isAdmin || hasDmAccess(row.id as string),
        textScale: Number(row.text_scale ?? 1),
      },
    });
  });

  app.post("/api/auth/migrate", requireAuth, (req, res) => {
    const session = createSession(db, req.user!.userId);
    setSessionCookie(req, res, session.token);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, csrfToken: session.csrfToken });
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    if (req.authSessionId) revokeSession(db, req.authSessionId);
    recordAuthAudit(db, req, "logout", { userId: req.user!.userId, username: req.user!.username });
    clearSessionCookie(req, res);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  });

  app.get("/api/auth/sessions", requireAuth, (req, res) => {
    const rows = db.prepare(`SELECT id,created_at,last_seen_at,expires_at FROM auth_sessions
      WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY last_seen_at DESC`)
      .all(req.user!.userId, ctx.helpers.now()) as Array<Record<string, unknown>>;
    res.setHeader("Cache-Control", "no-store");
    res.json(rows.map((row) => ({
      id: row.id, createdAt: row.created_at, lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at, current: row.id === req.authSessionId,
    })));
  });

  app.delete("/api/auth/sessions/:sessionId", requireAuth, (req, res) => {
    const sessionId = String(req.params.sessionId ?? "");
    const owned = db.prepare("SELECT id FROM auth_sessions WHERE id=? AND user_id=? AND revoked_at IS NULL")
      .get(sessionId, req.user!.userId);
    if (!owned) return res.status(404).json({ ok: false, message: "Session not found" });
    revokeSession(db, sessionId, ctx.helpers.now());
    recordAuthAudit(db, req, "session_revoked", { userId: req.user!.userId, username: req.user!.username, detail: { current: sessionId === req.authSessionId } });
    if (sessionId === req.authSessionId) clearSessionCookie(req, res);
    res.json({ ok: true, current: sessionId === req.authSessionId });
  });

  app.post("/api/auth/sessions/revoke-others", requireAuth, (req, res) => {
    revokeUserSessions(db, req.user!.userId, ctx.helpers.now(), req.authSessionId);
    recordAuthAudit(db, req, "other_sessions_revoked", { userId: req.user!.userId, username: req.user!.username });
    res.json({ ok: true });
  });

  app.put("/api/me/profile", requireAuth, async (req, res) => {
    const body = parseBody(UpdateProfileBody, req);
    const userId = req.user!.userId;

    const row = db
      .prepare("SELECT id, username, name, passhash, is_admin FROM users WHERE id = ?")
      .get(userId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "User not found" });

    // Credential changes require proof of the current password.
    if (body.username !== undefined || body.newPassword !== undefined) {
      if (!body.currentPassword || !await verifyPasswordAsync(body.currentPassword, row.passhash as string)) {
        return res.status(401).json({ ok: false, message: "Current password is incorrect" });
      }
    }

    if (body.username && body.username !== row.username) {
      const conflict = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?").get(body.username, userId);
      if (conflict) return res.status(409).json({ ok: false, message: "Username already taken" });
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined)        { setClauses.push("name = ?");     values.push(body.name); }
    if (body.username !== undefined)    { setClauses.push("username = ?"); values.push(body.username.toLowerCase()); }
    if (body.newPassword !== undefined) { setClauses.push("passhash = ?"); values.push(await hashPasswordAsync(body.newPassword)); }
    if (body.textScale !== undefined) { setClauses.push("text_scale = ?"); values.push(body.textScale); }

    if (setClauses.length === 0) return res.json({ ok: true });

    const updatedAt = ctx.helpers.now();
    setClauses.push("updated_at = ?");
    values.push(updatedAt, userId);
    const syncedPlayers = db.transaction(() => {
      db.prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
      return body.name !== undefined ? syncOwnedPlayerName(db, userId, body.name, updatedAt) : [];
    })();
    for (const player of syncedPlayers) {
        ctx.broadcast("players:delta", {
          campaignId: player.campaign_id,
          action: "upsert",
          playerId: player.id,
          characterId: player.character_id,
        });
    }

    const updated = db
      .prepare("SELECT id, username, name, passhash, is_admin, text_scale FROM users WHERE id = ?")
      .get(userId) as Record<string, unknown>;

    if (body.username !== undefined && body.username.toLowerCase() !== row.username) {
      recordAuthAudit(db, req, "username_changed", { userId, username: body.username.toLowerCase() });
    }
    if (body.newPassword !== undefined) {
      recordAuthAudit(db, req, "password_changed", { userId, username: updated.username as string });
    }

    const isAdmin = Boolean(updated.is_admin);
    let replacementSession: ReturnType<typeof createSession> | null = null;
    if (body.newPassword !== undefined && req.authSessionId) {
      revokeUserSessions(db, userId, updatedAt);
      replacementSession = createSession(db, userId, updatedAt);
      setSessionCookie(req, res, replacementSession.token);
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      ...(replacementSession ? { csrfToken: replacementSession.csrfToken } : {}),
      user: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        isAdmin,
        hasDmAccess: isAdmin || hasDmAccess(userId),
        textScale: Number(updated.text_scale ?? 1),
      },
    });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const row = db
      .prepare("SELECT id, username, name, is_admin, text_scale FROM users WHERE id = ?")
      .get(req.user!.userId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "User not found" });
    const isAdmin = Boolean(row.is_admin);
    const csrfToken = req.authSessionId ? rotateSessionCsrf(db, req.authSessionId) : undefined;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      id: row.id,
      username: row.username,
      name: row.name,
      isAdmin,
      hasDmAccess: isAdmin || hasDmAccess(row.id as string),
      textScale: Number(row.text_scale ?? 1),
      ...(csrfToken ? { csrfToken } : {}),
    });
  });
}

// Equalizes the expensive password check for known and unknown usernames.
const DUMMY_PASSWORD_HASH = hashPassword("beholden-invalid-account-password");
