import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import fs from "node:fs";

const CampaignUpsertBody = z.object({
  name: z.string().trim().optional(),
});

export function registerCampaignRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { now, uid, bySortThenUpdatedDesc } = ctx.helpers;

  app.get("/api/campaigns", (_req, res) => {
    const rows = Object.values(userData.campaigns).sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.post("/api/campaigns", (req, res) => {
    const body = parseBody(CampaignUpsertBody.passthrough(), req);
    const name = (body.name ?? "").toString().trim() || "New Campaign";
    const id = uid();
    const t = now();
    userData.campaigns[id] = { id, name, color: null, createdAt: t, updatedAt: t };
    ctx.helpers.seedDefaultConditions(id);
    ctx.scheduleSave();
    ctx.broadcast("campaigns:changed", { campaignId: id });
    res.json(userData.campaigns[id]);
  });

  app.put("/api/campaigns/:campaignId", (req, res) => {
    const { campaignId } = req.params;
    const c = userData.campaigns[campaignId];
    if (!c) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const body = parseBody(CampaignUpsertBody.passthrough(), req);
    const name = (body.name ?? "").toString().trim() || c.name;
    const t = now();
    userData.campaigns[campaignId] = { ...c, name, updatedAt: t };
    ctx.scheduleSave();
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json(userData.campaigns[campaignId]);
  });

  app.delete("/api/campaigns/:campaignId", (req, res) => {
    const { campaignId } = req.params;
    const c = userData.campaigns[campaignId];
    if (!c) return res.status(404).json({ ok: false, message: "Campaign not found" });

    const advIds = Object.values(userData.adventures)
      .filter((a) => a.campaignId === campaignId)
      .map((a) => a.id);
    const encIds = Object.values(userData.encounters)
      .filter((e) => e.campaignId === campaignId)
      .map((e) => e.id);

    for (const id of advIds) delete userData.adventures[id];
    for (const id of encIds) {
      delete userData.encounters[id];
      delete userData.combats[id];
    }
    for (const n of Object.values(userData.notes)) if (n.campaignId === campaignId) delete userData.notes[n.id];
    for (const p of Object.values(userData.players)) if (p.campaignId === campaignId) delete userData.players[p.id];
    for (const i of Object.values(userData.inpcs)) if (i.campaignId === campaignId) delete userData.inpcs[i.id];
    for (const cond of Object.values(userData.conditions)) if (cond.campaignId === campaignId) delete userData.conditions[cond.id];

    delete userData.campaigns[campaignId];

    // Campaigns are persisted per-campaign. Removing from memory updates the index on next save,
    // but the campaign JSON file must be explicitly deleted.
    const fp = ctx.helpers.campaignFilePath(campaignId);
    for (const suffix of ["", ".tmp", ".bak"]) {
      try {
        const p = fp + suffix;
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // best-effort: keep API delete working even if FS cleanup fails
      }
    }

    ctx.scheduleSave();
    ctx.broadcast("campaigns:changed", { campaignId });
    res.json({ ok: true });
  });

  // Full rest: heal players + clear player combatant conditions/temp hp
  app.post("/api/campaigns/:campaignId/fullRest", (req, res) => {
    const { campaignId } = req.params;
    const campaign = userData.campaigns[campaignId];
    if (!campaign) return res.status(404).json({ ok: false, message: "Campaign not found" });

    const t = now();

    const players = Object.values(userData.players).filter((p: any) => p.campaignId === campaignId);
    for (const p of players) {
      userData.players[p.id] = {
        ...p,
        hpCurrent: p.hpMax,
        // A full rest clears player-wide combat state.
        overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
        conditions: [],
        updatedAt: t
      };
    }

    const encounters = Object.values(userData.encounters).filter((e) => e.campaignId === campaignId);
    const updatedEncounterIds: string[] = [];
    for (const enc of encounters) {
      const combat = userData.combats[enc.id];
      if (!combat) continue;

      let changed = false;
      const nextCombatants = (combat.combatants ?? []).map((c: any) => {
        if (c.baseType !== "player") return c;
        const p = userData.players[c.baseId];
        if (!p) return c;

        changed = true;
        return {
          ...c,
          hpCurrent: p.hpMax,
          hpMax: p.hpMax,
          conditions: [],
          overrides: {
            ...(c.overrides ?? {}),
            tempHp: 0,
            acBonus: 0,
            hpMaxOverride: null,
          },
          updatedAt: t,
        };
      });

      if (changed) {
        userData.combats[enc.id] = { ...combat, combatants: nextCombatants, updatedAt: t };
        updatedEncounterIds.push(enc.id);
      }
    }

    ctx.scheduleSave();
    ctx.broadcast("players:changed", { campaignId });
    for (const encounterId of updatedEncounterIds) {
      ctx.broadcast("encounter:combatantsChanged", { encounterId });
    }

    res.json({ ok: true, playersUpdated: players.length, encountersUpdated: updatedEncounterIds.length });
  });
}
