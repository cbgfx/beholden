// server/src/middleware/campaignAuth.ts
// Campaign-scoped authorization middleware.
// Requires requireAuth to have already run (req.user must be set).

import type { Request, Response, NextFunction } from "express";
import type { Db } from "../lib/db.js";

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

/**
 * Resolve the campaign_id for the current request by inspecting route params.
 * Handles direct campaignId params and indirect lookups via adventureId,
 * encounterId, playerId, inpcId, noteId, treasureId.
 */
function resolveCampaignId(db: Db, req: Request): string | null {
  if (req.params.campaignId) return req.params.campaignId;

  if (req.params.adventureId) {
    const r = db.prepare("SELECT campaign_id FROM adventures WHERE id = ?")
      .get(req.params.adventureId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  if (req.params.encounterId) {
    const r = db.prepare("SELECT campaign_id FROM encounters WHERE id = ?")
      .get(req.params.encounterId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  if (req.params.playerId) {
    const r = db.prepare("SELECT campaign_id FROM players WHERE id = ?")
      .get(req.params.playerId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  if (req.params.inpcId) {
    const r = db.prepare("SELECT campaign_id FROM inpcs WHERE id = ?")
      .get(req.params.inpcId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  if (req.params.noteId) {
    const r = db.prepare("SELECT campaign_id FROM notes WHERE id = ?")
      .get(req.params.noteId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  if (req.params.treasureId) {
    const r = db.prepare("SELECT campaign_id FROM treasure WHERE id = ?")
      .get(req.params.treasureId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  if (req.params.combatantId) {
    const r = db.prepare(
      "SELECT e.campaign_id FROM combatants c JOIN encounters e ON e.id = c.encounter_id WHERE c.id = ?"
    ).get(req.params.combatantId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  return null;
}

function getMembership(db: Db, userId: string, campaignId: string): { role: string } | null {
  return db.prepare(
    "SELECT role FROM campaign_membership WHERE user_id = ? AND campaign_id = ?"
  ).get(userId, campaignId) as { role: string } | null;
}

/** Requires admin, or DM membership for the resolved campaign. */
export function dmOrAdmin(db: Db): Middleware {
  return (req, res, next) => {
    const user = req.user!;
    if (user.isAdmin) return next();

    const campaignId = resolveCampaignId(db, req);
    if (!campaignId) return res.status(403).json({ ok: false, message: "Forbidden" });

    const m = getMembership(db, user.userId, campaignId);
    if (!m || m.role !== "dm") {
      return res.status(403).json({ ok: false, message: "DM access required" });
    }
    next();
  };
}

/** Requires admin, or any membership (DM or player) for the resolved campaign. */
export function memberOrAdmin(db: Db): Middleware {
  return (req, res, next) => {
    const user = req.user!;
    if (user.isAdmin) return next();

    const campaignId = resolveCampaignId(db, req);
    if (!campaignId) return res.status(403).json({ ok: false, message: "Forbidden" });

    const m = getMembership(db, user.userId, campaignId);
    if (!m) return res.status(403).json({ ok: false, message: "Not a member of this campaign" });
    next();
  };
}
