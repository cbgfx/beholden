import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";

export function registerInpcRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now, parseLeadingInt } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/inpcs", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    res.json(
      Object.values(userData.inpcs).filter((i) => i.campaignId === campaignId),
    );
  });

  app.post("/api/campaigns/:campaignId/inpcs", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const b = req.body ?? {};
    const monsterId = String(b.monsterId ?? "").trim();
    const qty = Math.min(Math.max(Number(b.qty ?? 1), 1), 20);

    const m = ctx.compendium.state.monsters.find(
      (x: any) => x.id === monsterId,
    );
    if (!m)
      return res
        .status(404)
        .json({ ok: false, message: "Monster not found in compendium" });

    const mAc = m?.ac as any;
    const mHp = m?.hp as any;
    const defaultAcRaw = mAc ?? null;
    const defaultHpRaw = mHp?.average ?? mHp ?? null;

    const defaultAc = parseLeadingInt(defaultAcRaw);
    const defaultHp = parseLeadingInt(defaultHpRaw);

    const defaultAcDetail =
      (mAc?.note ??
        mAc?.type ??
        (defaultAcRaw != null
          ? String(defaultAcRaw)
              .replace(/^(-?\d+)\s*/, "")
              .trim()
          : null)) ||
      null;
    const defaultHpDetail =
      (mHp?.formula ??
        mHp?.roll ??
        (defaultHpRaw != null
          ? String(defaultHpRaw)
              .replace(/^(-?\d+)\s*/, "")
              .trim()
          : null)) ||
      null;

    const t = now();
    const created: any[] = [];

    for (let i = 0; i < qty; i++) {
      const id = uid();
      const name = String(b.name ?? "").trim() || m.name;
      const hpMax =
        b.hpMax != null && Number.isFinite(Number(b.hpMax))
          ? Number(b.hpMax)
          : defaultHp != null
            ? defaultHp
            : 1;
      const ac =
        b.ac != null && Number.isFinite(Number(b.ac))
          ? Number(b.ac)
          : defaultAc != null
            ? defaultAc
            : 10;

      userData.inpcs[id] = {
        id,
        campaignId,
        monsterId,
        name,
        label: b.label != null ? String(b.label).trim() : null,
        friendly: b.friendly != null ? Boolean(b.friendly) : true,
        hpMax,
        hpCurrent: b.hpCurrent != null ? Number(b.hpCurrent) : hpMax,
        hpDetails:
          b.hpDetails != null
            ? String(b.hpDetails)
            : defaultHpDetail != null
              ? String(defaultHpDetail)
              : null,
        ac,
        acDetails:
          b.acDetails != null
            ? String(b.acDetails)
            : defaultAcDetail != null
              ? String(defaultAcDetail)
              : null,
        createdAt: t,
        updatedAt: t,
      };

      created.push(userData.inpcs[id]);
    }

    ctx.scheduleSave();
    ctx.broadcast("inpcs:changed", { campaignId });
    res.json(created.length === 1 ? created[0] : { ok: true, created });
  });

  app.put("/api/inpcs/:inpcId", (req, res) => {
    const inpcId = requireParam(req, res, "inpcId");
    if (!inpcId) return;
    const existing = userData.inpcs[inpcId];
    if (!existing)
      return res.status(404).json({ ok: false, message: "Not found" });
    const b = req.body ?? {};
    const t = now();
    userData.inpcs[inpcId] = {
      ...existing,
      name: b.name != null ? String(b.name).trim() : existing.name,
      label: b.label != null ? String(b.label).trim() : existing.label,
      friendly: b.friendly != null ? Boolean(b.friendly) : existing.friendly,
      hpMax: b.hpMax != null ? Number(b.hpMax) : existing.hpMax,
      hpCurrent: b.hpCurrent != null ? Number(b.hpCurrent) : existing.hpCurrent,
      hpDetails:
        b.hpDetails != null
          ? b.hpDetails === null
            ? null
            : String(b.hpDetails)
          : existing.hpDetails,
      ac: b.ac != null ? Number(b.ac) : existing.ac,
      acDetails:
        b.acDetails != null
          ? b.acDetails === null
            ? null
            : String(b.acDetails)
          : existing.acDetails,
      updatedAt: t,
    };
    ctx.scheduleSave();
    ctx.broadcast("inpcs:changed", { campaignId: existing.campaignId });
    res.json(userData.inpcs[inpcId]);
  });

  app.delete("/api/inpcs/:inpcId", (req, res) => {
    const inpcId = requireParam(req, res, "inpcId");
    if (!inpcId) return;
    const existing = userData.inpcs[inpcId];
    if (!existing)
      return res.status(404).json({ ok: false, message: "Not found" });

    for (const combat of Object.values(userData.combats)) {
combat.combatants = combat.combatants.filter((c) => !(c.baseType === "inpc" && c.baseId === inpcId));
    }
    delete userData.inpcs[inpcId];
    ctx.scheduleSave();
    ctx.broadcast("inpcs:changed", { campaignId: existing.campaignId });
    res.json({ ok: true });
  });
}
