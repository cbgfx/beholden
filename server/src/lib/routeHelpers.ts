import type { Request, Response } from "express";
import type { Db } from "./db.js";

/**
 * Extracts a required route parameter by name.
 * Sends a 400 response and returns null if the param is missing or empty.
 * Usage:
 *   const campaignId = requireParam(req, res, "campaignId");
 *   if (!campaignId) return;
 */
export function requireParam(req: Request, res: Response, key: string): string | null {
  const raw = req.params[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) {
    res.status(400).json({ ok: false, message: `${key} required` });
    return null;
  }
  return v;
}

export function requireCampaignExists(db: Db, campaignId: string, res: Response): boolean {
  const exists = db.prepare("SELECT 1 FROM campaigns WHERE id = ?").get(campaignId);
  if (exists) return true;
  res.status(404).json({ ok: false, message: "Campaign not found" });
  return false;
}
