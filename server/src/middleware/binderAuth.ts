import type { NextFunction, Request, Response } from "express";
import type { Db } from "../lib/db.js";

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

function binderParam(req: Request): string | null {
  const raw = req.params.binderId;
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export function ownsBinder(db: Db, userId: string, binderId: string): boolean {
  return Boolean(
    db.prepare("SELECT 1 FROM binders WHERE id = ? AND owner_user_id = ?").get(binderId, userId),
  );
}

/**
 * A Binder is readable by its owner and by DMs on any attached Campaign.
 * Player membership never grants DM Binder access.
 */
export function canAccessBinder(db: Db, userId: string, binderId: string): boolean {
  return Boolean(db.prepare(`
    SELECT 1
    FROM binders b
    WHERE b.id = ?
      AND (
        b.owner_user_id = ?
        OR EXISTS (
          SELECT 1
          FROM campaigns c
          JOIN campaign_membership cm ON cm.campaign_id = c.id
          WHERE c.binder_id = b.id
            AND cm.user_id = ?
            AND cm.role = 'dm'
        )
      )
  `).get(binderId, userId, userId));
}

/** Initial Binder authorization: global admin or the Binder's explicit owner. */
export function binderOwnerOrAdmin(db: Db): Middleware {
  return (req, res, next) => {
    const user = req.user!;
    if (user.isAdmin) return next();
    const binderId = binderParam(req);
    if (!binderId || !ownsBinder(db, user.userId, binderId)) {
      return res.status(404).json({ ok: false, message: "Binder not found" });
    }
    next();
  };
}

/** Global admin, Binder owner, or DM on an attached Campaign. */
export function binderReaderOrAdmin(db: Db): Middleware {
  return (req, res, next) => {
    const user = req.user!;
    if (user.isAdmin) return next();
    const binderId = binderParam(req);
    if (!binderId || !canAccessBinder(db, user.userId, binderId)) {
      return res.status(404).json({ ok: false, message: "Binder not found" });
    }
    next();
  };
}
