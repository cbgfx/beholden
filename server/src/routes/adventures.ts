import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerAdventureRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now, bySortThenUpdatedDesc, nextSort } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/adventures", (req, res) => {
    const { campaignId } = req.params;
    const rows = Object.values(userData.adventures)
      .filter((a) => a.campaignId === campaignId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.post("/api/campaigns/:campaignId/adventures", (req, res) => {
    const { campaignId } = req.params;
    const name = (req.body?.name ?? "").toString().trim() || "New Adventure";
    const id = uid();
    const t = now();
    userData.adventures[id] = {
      id,
      campaignId,
      name,
      status: "active",
      sort: nextSort(Object.values(userData.adventures).filter((a) => a.campaignId === campaignId)),
      createdAt: t,
      updatedAt: t,
    };
    ctx.scheduleSave();
    ctx.broadcast("adventures:changed", { campaignId });
    res.json(userData.adventures[id]);
  });

  app.put("/api/adventures/:adventureId", (req, res) => {
    const { adventureId } = req.params;
    const a = userData.adventures[adventureId];
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const name = (req.body?.name ?? "").toString().trim() || a.name;
    const t = now();
    userData.adventures[adventureId] = { ...a, name, updatedAt: t };
    ctx.scheduleSave();
    ctx.broadcast("adventures:changed", { adventureId });
    res.json(userData.adventures[adventureId]);
  });

  app.delete("/api/adventures/:adventureId", (req, res) => {
    const { adventureId } = req.params;
    const a = userData.adventures[adventureId];
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });

    const encIds = Object.values(userData.encounters)
      .filter((e) => e.adventureId === adventureId)
      .map((e) => e.id);
    for (const id of encIds) {
      delete userData.encounters[id];
      delete userData.combats[id];
    }

    for (const n of Object.values(userData.notes)) {
      if (n.adventureId === adventureId) delete userData.notes[n.id];
    }

    delete userData.adventures[adventureId];

    ctx.scheduleSave();
    ctx.broadcast("adventures:changed", { adventureId });
    res.json({ ok: true });
  });
}
