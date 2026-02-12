import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerExportImportRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;

  // Export / Import Campaign
  app.get("/api/campaigns/:campaignId/export", (req, res) => {
    const { campaignId } = req.params;
    const c = userData.campaigns[campaignId];
    if (!c) return res.status(404).json({ ok: false, message: "Campaign not found" });

    const doc = ctx.helpers.loadCampaignFile?.(campaignId) || null;
    const fallback = { version: 1, campaign: c };
    const body = doc ?? fallback;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=campaign_${campaignId}.json`);
    res.send(JSON.stringify(body, null, 2));
  });

  app.post("/api/campaigns/import", ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });
    let doc: any = null;
    try {
      doc = JSON.parse(req.file.buffer.toString("utf-8"));
    } catch {
      return res.status(400).json({ ok: false, message: "Invalid JSON" });
    }

    const campaign = doc?.campaign;
    if (!campaign?.id) return res.status(400).json({ ok: false, message: "Missing campaign.id" });

    const campaignId = String(campaign.id);
    userData.campaigns[campaignId] = campaign;

    // Remove existing objects for this campaign to avoid orphans.
    for (const [id, a] of Object.entries(userData.adventures)) if (a?.campaignId === campaignId) delete userData.adventures[id];
    for (const [id, e] of Object.entries(userData.encounters))
      if (e?.campaignId === campaignId) {
        delete userData.encounters[id];
        delete userData.combats[id];
      }
    for (const [id, n] of Object.entries(userData.notes)) if (n?.campaignId === campaignId) delete userData.notes[id];
    for (const [id, t] of Object.entries(userData.treasure)) if (t?.campaignId === campaignId) delete userData.treasure[id];
    for (const [id, p] of Object.entries(userData.players)) if (p?.campaignId === campaignId) delete userData.players[id];
    for (const [id, i] of Object.entries(userData.inpcs)) if (i?.campaignId === campaignId) delete userData.inpcs[id];
    for (const [id, cnd] of Object.entries(userData.conditions)) if (cnd?.campaignId === campaignId) delete userData.conditions[id];

    const mergeMap = (target, incoming) => {
      for (const [k, v] of Object.entries(incoming ?? {})) target[k] = v;
    };

    mergeMap(userData.adventures, doc.adventures);
    mergeMap(userData.encounters, doc.encounters);
    mergeMap(userData.notes, doc.notes);
    mergeMap(userData.treasure, doc.treasure);
    mergeMap(userData.players, doc.players);
    mergeMap(userData.inpcs, doc.inpcs);
    mergeMap(userData.conditions, doc.conditions);
    mergeMap(userData.combats, doc.combats);

    ctx.helpers.seedDefaultConditions(campaignId);

    ctx.scheduleSave();
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true, campaignId });
  });

  // Legacy: export all data in one file (debug)
  app.get("/api/user/export", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=userData.json");
    res.send(JSON.stringify(userData, null, 2));
  });
}
