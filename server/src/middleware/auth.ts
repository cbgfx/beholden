// server/src/middleware/auth.ts
// Express middleware for cookie sessions and admin authorization.

import type { Request, Response, NextFunction } from "express";
import type { Db } from "../lib/db.js";
import { CSRF_HEADER, currentSessionUser, sessionCsrfMatches } from "../lib/sessionAuth.js";

/** Who is making a request, as established by their session. */
export interface AuthUser {
  userId: string;
  username: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      authSessionId?: string;
      authCsrfHash?: string;
    }
  }
}

/**
 * Per-route guard: passes once requireCurrentAccount (mounted on all of /api) has identified the
 * caller. It no longer reads a token itself - the Authorization: Bearer path it used to accept is
 * gone (see lib/passwords.ts for why), so a request is either on a session or not signed in.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.user) return next();
  return res.status(401).json({ ok: false, message: "Unauthorized" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ ok: false, message: "Forbidden" });
  }
  next();
}

/** Passes if the user is a global admin, or holds a DM role in any campaign. */
export function requireAnyDm(db: Db) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    if (user.isAdmin) return next();
    const row = db
      .prepare("SELECT id FROM campaign_membership WHERE user_id = ? AND role = 'dm' LIMIT 1")
      .get(user.userId);
    if (!row) return res.status(403).json({ ok: false, message: "DM access required" });
    next();
  };
}

/**
 * The /api gatekeeper: identifies the caller from their session cookie and, for anything that
 * changes state, requires the matching CSRF header. WebSockets authorize through the same session
 * lookup, so revoking a session or changing a password ends both at once.
 */
export function requireCurrentAccount(db: Db) {
  return (req: Request, res: Response, next: NextFunction) => {
    const sessionUser = currentSessionUser(db, req);
    if (!sessionUser) {
      res.status(401).json({ ok: false, message: "Session expired. Please sign in again." });
      return;
    }
    req.user = { userId: sessionUser.userId, username: sessionUser.username, isAdmin: sessionUser.isAdmin };
    req.authSessionId = sessionUser.sessionId;
    req.authCsrfHash = sessionUser.csrfHash;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !sessionCsrfMatches(sessionUser.csrfHash, req.headers[CSRF_HEADER])) {
      res.status(403).json({ ok: false, code: "invalid-csrf", message: "The session security token is missing or expired. Reload and try again." });
      return;
    }
    next();
  };
}
