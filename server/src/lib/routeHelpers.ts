import type { Request, Response } from "express";

/**
 * Extracts a required route parameter by name.
 * Sends a 400 response and returns null if the param is missing or empty.
 * Usage:
 *   const campaignId = requireParam(req, res, "campaignId");
 *   if (!campaignId) return;
 */
export function requireParam(req: Request, res: Response, key: string): string | null {
  const v = req.params[key];
  if (!v) {
    res.status(400).json({ ok: false, message: `${key} required` });
    return null;
  }
  return v;
}
