// server/src/middleware/campaignAuth.ts
// Campaign-scoped authorization middleware.
// Requires requireAuth to have already run (req.user must be set).

import type { Request, Response, NextFunction } from "express";
import type { Db } from "../lib/db.js";

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

function paramValue(req: Request, key: string): string | null {
  const raw = req.params[key];
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

/**
 * Resolve the campaign_id for the current request by inspecting route params.
 * Handles direct campaignId params and indirect lookups via adventureId,
 * encounterId, playerId, inpcId, noteId, treasureId.
 */
function resolveCampaignId(db: Db, req: Request): string | null {
  const campaignId = paramValue(req, "campaignId");
  if (campaignId) return campaignId;

  const adventureId = paramValue(req, "adventureId");
  if (adventureId) {
    const r = db.prepare("SELECT campaign_id FROM adventures WHERE id = ?")
      .get(adventureId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  const encounterId = paramValue(req, "encounterId");
  if (encounterId) {
    const r = db.prepare("SELECT campaign_id FROM encounters WHERE id = ?")
      .get(encounterId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  const playerId = paramValue(req, "playerId");
  if (playerId) {
    const r = db.prepare("SELECT campaign_id FROM players WHERE id = ?")
      .get(playerId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  const inpcId = paramValue(req, "inpcId");
  if (inpcId) {
    const r = db.prepare("SELECT campaign_id FROM inpcs WHERE id = ?")
      .get(inpcId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  const noteId = paramValue(req, "noteId");
  if (noteId) {
    const r = db.prepare("SELECT campaign_id FROM notes WHERE id = ?")
      .get(noteId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  const treasureId = paramValue(req, "treasureId");
  if (treasureId) {
    const r = db.prepare("SELECT campaign_id FROM treasure WHERE id = ?")
      .get(treasureId) as Record<string, unknown> | undefined;
    return (r?.campaign_id as string) ?? null;
  }

  const combatantId = paramValue(req, "combatantId");
  if (combatantId) {
    const r = db.prepare(
      "SELECT e.campaign_id FROM combatants c JOIN encounters e ON e.id = c.encounter_id WHERE c.id = ?"
    ).get(combatantId) as Record<string, unknown> | undefined;
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
