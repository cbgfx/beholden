import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerCombatRoutes(app: Express, ctx: ServerContext) {
  const { userData, compendium } = ctx;
  const { now, uid } = ctx.helpers;

  // Encounter combatants (merged view)
  app.get("/api/encounters/:encounterId/combatants", (req, res) => {
    const { encounterId } = req.params;
    const combat = ctx.helpers.ensureCombat(encounterId);

    const merged = (combat.combatants ?? []).map((c) => {
      if (c.baseType !== "player") return c;
      const p = userData.players[c.baseId];
      if (!p) return c;
      return {
        ...c,
        name: p.characterName,
        playerName: p.playerName,
        label: c.label ?? p.characterName,
        hpCurrent: p.hpCurrent,
        hpMax: p.hpMax,
        ac: p.ac,
        overrides: p.overrides ?? c.overrides,
        conditions: Array.isArray(p.conditions) ? p.conditions : c.conditions ?? [],
      };
    });

    res.json(merged);
  });

  // Persisted combat state (round + active combatant)
  app.get("/api/encounters/:encounterId/combatState", (req, res) => {
    const { encounterId } = req.params;
    const combat = ctx.helpers.ensureCombat(encounterId);
    res.json({
      round: Number(combat.round ?? 1) || 1,
      activeCombatantId: combat.activeCombatantId ?? null,
    });
  });

  app.put("/api/encounters/:encounterId/combatState", (req, res) => {
    const { encounterId } = req.params;
    const combat = ctx.helpers.ensureCombat(encounterId);
    const round = Number(req.body?.round);
    const activeCombatantId = req.body?.activeCombatantId != null ? String(req.body.activeCombatantId) : null;

    if (Number.isFinite(round) && round >= 1) combat.round = round;
    combat.activeCombatantId = activeCombatantId;

    if (activeCombatantId) {
      const idx = (combat.combatants ?? []).findIndex((c) => c.id === activeCombatantId);
      if (idx >= 0) combat.activeIndex = idx;
    }

    combat.updatedAt = now();
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatStateChanged", { encounterId });
    res.json({ ok: true, round: combat.round, activeCombatantId: combat.activeCombatantId });
  });

  app.post("/api/encounters/:encounterId/combatants/addPlayers", (req, res) => {
    const { encounterId } = req.params;
    const encounter = userData.encounters[encounterId];
    if (!encounter) return res.status(404).json({ ok: false, message: "Encounter not found" });
    const combat = ctx.helpers.ensureCombat(encounterId);
    const existingPlayerIds = new Set((combat.combatants ?? []).filter((c) => c.baseType === "player").map((c) => c.baseId));
    const players = Object.values(userData.players).filter((p) => p.campaignId === encounter.campaignId);
    const t = now();
    let added = 0;
    for (const p of players) {
      if (existingPlayerIds.has(p.id)) continue;
      combat.combatants.push(ctx.helpers.createPlayerCombatant({ encounterId, player: p, t }));
      added++;
    }
    combat.updatedAt = t;
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatantsChanged", { encounterId });
    res.json({ ok: true, added });
  });

  app.post("/api/encounters/:encounterId/combatants/addMonster", (req, res) => {
    const { encounterId } = req.params;
    const encounter = userData.encounters[encounterId];
    if (!encounter) return res.status(404).json({ ok: false, message: "Encounter not found" });

    const monsterId = String(req.body?.monsterId ?? "");
    const qty = Math.min(Math.max(Number(req.body?.qty ?? 1), 1), 20);
    const friendly = Boolean(req.body?.friendly ?? false);

    const labelBaseRaw = req.body?.labelBase;
    const labelBase = labelBaseRaw != null ? String(labelBaseRaw).trim() : "";
    const acOverrideRaw = req.body?.ac != null ? Number(req.body.ac) : NaN;
    const acOverride = Number.isFinite(acOverrideRaw) ? acOverrideRaw : null;
    const acDetail = req.body?.acDetail != null ? String(req.body.acDetail) : null;
    const hpMaxOverrideRaw = req.body?.hpMax != null ? Number(req.body.hpMax) : NaN;
    const hpMaxOverride = Number.isFinite(hpMaxOverrideRaw) ? hpMaxOverrideRaw : null;
    const hpDetail = req.body?.hpDetail != null ? String(req.body.hpDetail) : null;
    const attackOverrides =
      req.body?.attackOverrides && typeof req.body.attackOverrides === "object" ? req.body.attackOverrides : null;

    const m = compendium.state.monsters.find((x) => x.id === monsterId);
    if (!m) return res.status(404).json({ ok: false, message: "Monster not found in compendium" });

    const leadingNumber = (v) => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v === "string") {
        const m = v.match(/\d+/);
        return m ? Number(m[0]) : null;
      }
      if (typeof v === "object") {
        const candidates = [v.value, v.ac, v.armorClass, v.average, v.hp, v.max];
        for (const c of candidates) {
          const n = leadingNumber(c);
          if (n != null) return n;
        }
      }
      return null;
    };

    const defaultAc = leadingNumber(m?.ac);
    const defaultHp = leadingNumber(m?.hp?.average ?? m?.hp);
    const defaultAcDetail = m?.ac?.note ?? m?.ac?.type ?? null;
    const defaultHpDetail = m?.hp?.formula ?? m?.hp?.roll ?? null;

    const combat = ctx.helpers.ensureCombat(encounterId);
    const t = now();

    const baseName = m.name;
    const effectiveLabelBase = labelBase || baseName;
    let n = ctx.helpers.nextLabelNumber(encounterId, effectiveLabelBase);

    const created: any[] = [];
    for (let i = 0; i < qty; i++) {
      const label = qty === 1 ? effectiveLabelBase : `${effectiveLabelBase} ${n++}`;
      const hpMax = hpMaxOverride != null && Number.isFinite(hpMaxOverride) ? hpMaxOverride : defaultHp ?? null;
      const ac = acOverride != null && Number.isFinite(acOverride) ? acOverride : defaultAc ?? null;

      const c = {
        id: uid(),
        encounterId,
        baseType: "monster",
        baseId: monsterId,
        name: baseName,
        label,
        initiative: null,
        friendly,
        color: friendly ? "lightgreen" : "red",
        overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
        hpCurrent: hpMax,
        hpMax,
        hpDetail: hpDetail != null ? hpDetail : defaultHpDetail != null ? String(defaultHpDetail) : null,
        ac,
        acDetail: acDetail != null ? acDetail : defaultAcDetail != null ? String(defaultAcDetail) : null,
        attackOverrides: attackOverrides ?? null,
        conditions: [],
        createdAt: t,
        updatedAt: t,
      };
      combat.combatants.push(c);
      created.push(c);
    }

    combat.updatedAt = t;
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatantsChanged", { encounterId });
    res.json({ ok: true, created });
  });

  app.post("/api/encounters/:encounterId/combatants/addInpc", (req, res) => {
    const { encounterId } = req.params;
    const encounter = userData.encounters[encounterId];
    if (!encounter) return res.status(404).json({ ok: false, message: "Encounter not found" });

    const inpcId = String(req.body?.inpcId ?? "").trim();
    const i = userData.inpcs[inpcId];
    if (!i) return res.status(404).json({ ok: false, message: "iNPC not found" });

    const combat = ctx.helpers.ensureCombat(encounterId);
    const t = now();

    const c = {
      id: uid(),
      encounterId,
      baseType: "inpc",
      baseId: inpcId,
      name: i.name,
      label: i.label || i.name,
      initiative: null,
      friendly: Boolean(i.friendly),
      color: Boolean(i.friendly) ? "lightgreen" : "red",
      overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
      hpCurrent: Number(i.hpCurrent ?? i.hpMax ?? 1),
      hpMax: Number(i.hpMax ?? 1),
      hpDetail: i.hpDetails ?? null,
      ac: Number(i.ac ?? 10),
      acDetail: i.acDetails ?? null,
      attackOverrides: null,
      conditions: [],
      createdAt: t,
      updatedAt: t,
    };

    combat.combatants.push(c);
    combat.updatedAt = t;
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatantsChanged", { encounterId });
    res.json({ ok: true, created: c });
  });

  app.put("/api/encounters/:encounterId/combatants/:combatantId", (req, res) => {
    const { encounterId, combatantId } = req.params;
    const combat = ctx.helpers.ensureCombat(encounterId);
    const idx = (combat.combatants ?? []).findIndex((c) => c.id === combatantId);
    if (idx < 0) return res.status(404).json({ ok: false, message: "Not found" });

    const existing = combat.combatants[idx];
    const t = now();
    const next = {
      ...existing,
      label: req.body?.label != null ? String(req.body.label) : existing.label,
      initiative:
        req.body?.initiative !== undefined
          ? req.body.initiative == null
            ? null
            : Number(req.body.initiative)
          : existing.initiative ?? null,
      friendly: req.body?.friendly != null ? Boolean(req.body.friendly) : existing.friendly,
      color: req.body?.color != null ? String(req.body.color) : existing.color,
      hpCurrent: req.body?.hpCurrent != null ? Number(req.body.hpCurrent) : existing.hpCurrent,
      hpMax: req.body?.hpMax != null ? Number(req.body.hpMax) : existing.hpMax,
      hpDetail: req.body?.hpDetail != null ? String(req.body.hpDetail) : existing.hpDetail,
      ac: req.body?.ac != null ? Number(req.body.ac) : existing.ac,
      acDetail: req.body?.acDetail != null ? String(req.body.acDetail) : existing.acDetail,
      overrides: req.body?.overrides != null ? req.body.overrides : existing.overrides,
      conditions: Array.isArray(req.body?.conditions) ? req.body.conditions : existing.conditions ?? [],
      updatedAt: t,
    };
    combat.combatants[idx] = next;

    if (next.baseType === "player") {
      const p = userData.players[next.baseId];
      if (p) {
        if (next.hpCurrent != null) p.hpCurrent = Number(next.hpCurrent);
        p.overrides = next.overrides ?? p.overrides ?? null;
        p.conditions = Array.isArray(next.conditions) ? next.conditions : p.conditions ?? [];
        p.updatedAt = t;
        ctx.broadcast("players:changed", { campaignId: p.campaignId });
      }
    }

    combat.updatedAt = t;
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatantsChanged", { encounterId });
    res.json(next);
  });

  app.delete("/api/encounters/:encounterId/combatants/:combatantId", (req, res) => {
    const { encounterId, combatantId } = req.params;
    const combat = ctx.helpers.ensureCombat(encounterId);
    const idx = (combat.combatants ?? []).findIndex((x) => x.id === combatantId);
    if (idx < 0) return res.status(404).json({ error: "Combatant not found" });

    combat.combatants.splice(idx, 1);
    combat.updatedAt = now();
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatantsChanged", { encounterId });
    res.json({ ok: true });
  });
}
