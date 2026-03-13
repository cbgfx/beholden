import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { StoredEncounter } from "../server/userData.js";
import { requireParam } from "../lib/routeHelpers.js";

const EncounterCreateBody = z.object({
  name: z.string().trim().optional(),
});

const EncounterUpdateBody = z.object({
  name: z.string().trim().optional(),
  status: z.string().optional(),
  combat: z.unknown().optional(),
});

export function registerEncounterRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now, bySortThenUpdatedDesc } = ctx.helpers;

  app.get("/api/adventures/:adventureId/encounters", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const rows = Object.values(userData.encounters)
      .filter((e) => e.adventureId === adventureId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.post("/api/adventures/:adventureId/encounters", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const adv = userData.adventures[adventureId];
    if (!adv)
      return res
        .status(404)
        .json({ ok: false, message: "Adventure not found" });
    const body = parseBody(EncounterCreateBody, req);
    const name = body.name || "New Encounter";
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
    ctx.broadcast("encounters:changed", {
      campaignId: adv.campaignId,
      adventureId,
    });
    res.json(userData.encounters[id]);
  });

  // NOTE: "Loose" encounters (campaign-level encounters without an adventure) are intentionally removed.

  app.put("/api/encounters/:encounterId", (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const e = userData.encounters[encounterId];
    if (!e)
      return res
        .status(404)
        .json({ ok: false, message: "Encounter not found" });
    const body = parseBody(EncounterUpdateBody, req);
    const t = now();

const next: StoredEncounter = { ...e, updatedAt: t };
if (body.name !== undefined) next.name = body.name || e.name;
if (body.status !== undefined) next.status = body.status;
if (body.combat !== undefined) next.combat = body.combat as NonNullable<StoredEncounter["combat"]>;
userData.encounters[encounterId] = next;
    ctx.scheduleSave();
    ctx.broadcast("encounters:changed", {
      campaignId: e.campaignId,
      adventureId: e.adventureId,
    });
    res.json(userData.encounters[encounterId]);
  });

  app.delete("/api/encounters/:encounterId", (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const e = userData.encounters[encounterId];
    if (!e)
      return res
        .status(404)
        .json({ ok: false, message: "Encounter not found" });
    delete userData.encounters[encounterId];
    delete userData.combats[encounterId];
    ctx.scheduleSave();
    ctx.broadcast("encounters:changed", { encounterId });
    res.json({ ok: true });
  });
}
