import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerEncounterRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now, bySortThenUpdatedDesc } = ctx.helpers;

  app.get("/api/adventures/:adventureId/encounters", (req, res) => {
    const { adventureId } = req.params;
    const rows = Object.values(userData.encounters)
      .filter((e) => e.adventureId === adventureId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.post("/api/adventures/:adventureId/encounters", (req, res) => {
    const { adventureId } = req.params;
    const adv = userData.adventures[adventureId];
    if (!adv) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const name = (req.body?.name ?? "").toString().trim() || "New Encounter";
    const id = uid();
    const t = now();
    userData.encounters[id] = {
      id,
      campaignId: adv.campaignId,
      adventureId,
      name,
      status: "Open",
      createdAt: t,
      updatedAt: t,
    };
    ctx.helpers.ensureCombat(id);
    ctx.scheduleSave();
    ctx.broadcast("encounters:changed", { campaignId: adv.campaignId, adventureId });
    res.json(userData.encounters[id]);
  });

  // NOTE: "Loose" encounters (campaign-level encounters without an adventure) are intentionally removed.

  app.put("/api/encounters/:encounterId", (req, res) => {
    const { encounterId } = req.params;
    const e = userData.encounters[encounterId];
    if (!e) return res.status(404).json({ ok: false, message: "Encounter not found" });
    const t = now();
    userData.encounters[encounterId] = {
      ...e,
      name: req.body?.name != null ? String(req.body.name).trim() : e.name,
      status: req.body?.status != null ? String(req.body.status) : e.status,
      updatedAt: t,
    };
    ctx.scheduleSave();
    ctx.broadcast("encounters:changed", { campaignId: e.campaignId, adventureId: e.adventureId });
    res.json(userData.encounters[encounterId]);
  });

  app.delete("/api/encounters/:encounterId", (req, res) => {
    const { encounterId } = req.params;
    const e = userData.encounters[encounterId];
    if (!e) return res.status(404).json({ ok: false, message: "Encounter not found" });
    delete userData.encounters[encounterId];
    delete userData.combats[encounterId];
    ctx.scheduleSave();
    ctx.broadcast("encounters:changed", { encounterId });
    res.json({ ok: true });
  });
}
