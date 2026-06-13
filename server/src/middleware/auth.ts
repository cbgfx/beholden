// server/src/middleware/auth.ts
// Express middleware for JWT authentication and admin authorization.

import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwtAuth.js";
import type { Db } from "../lib/db.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
  req.user = payload;
  next();
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
