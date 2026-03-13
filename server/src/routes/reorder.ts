import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";

export function registerReorderRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { now } = ctx.helpers;

  app.post("/api/campaigns/:campaignId/adventures/reorder", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    ids.forEach((id: string, i: number) => {
      const a = userData.adventures[id];
      if (a && a.campaignId === campaignId) {
        a.sort = i + 1;
        a.updatedAt = now();
      }
    });
    ctx.scheduleSave();
    ctx.broadcast("adventures:changed", { campaignId });
    res.json({ ok: true });
  });

  app.post("/api/adventures/:adventureId/encounters/reorder", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const a = userData.adventures[adventureId];
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    ids.forEach((id: string, i: number) => {
      const e = userData.encounters[id];
      if (e && e.adventureId === adventureId) {
        e.sort = i + 1;
        e.updatedAt = now();
      }
    });
    ctx.scheduleSave();
    ctx.broadcast("encounters:changed", { campaignId: a.campaignId });
    res.json({ ok: true });
  });

  app.post("/api/campaigns/:campaignId/notes/reorder", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    ids.forEach((id: string, i: number) => {
      const n = userData.notes[id];
      if (n && n.campaignId === campaignId && n.adventureId == null) {
        n.sort = i + 1;
        n.updatedAt = now();
      }
    });
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { campaignId });
    res.json({ ok: true });
  });

  app.post("/api/adventures/:adventureId/notes/reorder", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const a = userData.adventures[adventureId];
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    ids.forEach((id: string, i: number) => {
      const n = userData.notes[id];
      if (n && n.adventureId === adventureId) {
        n.sort = i + 1;
        n.updatedAt = now();
      }
    });
    ctx.scheduleSave();
    ctx.broadcast("notes:changed", { campaignId: a.campaignId });
    res.json({ ok: true });
  });
}
