import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import {
  StoredCombatant,
  StoredCombatantOverrides,
} from "../server/userData.js";

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
        // Player-scoped conditions & death saves persist across encounters.
        conditions: Array.isArray(p.conditions) ? p.conditions : (c.conditions ?? []),
        deathSaves: p.deathSaves ?? c.deathSaves,
        overrides: p.overrides ?? { tempHp: 0, acBonus: 0, hpMaxOverride: null },
      };
    });

    res.json(merged);
  });

  // Persisted combat state (round + active combatant)
  app.get("/api/encounters/:encounterId/combatState", (req, res) => {
    const { encounterId } = req.params;
    const combat = ctx.helpers.ensureCombat(encounterId);

    // Mirror state onto the encounter record (when present) so navigation survives
    // any combat cache resets and is visible in campaign JSON.
    // NOTE: We persist activeCombatantId directly (not an index) because initiative order
    // is view-derived and the server can't safely infer it.
    const enc = userData.encounters[encounterId];
    const roundFromEncounter = Number(enc?.combat?.round);

    const round =
      Number.isFinite(roundFromEncounter) && roundFromEncounter >= 1
        ? roundFromEncounter
        : Number(combat.round ?? 1) || 1;
    const activeCombatantId = (enc?.combat?.activeCombatantId ??
      combat.activeCombatantId ??
      null) as string | null;

    res.json({
      round,
      activeCombatantId,
    });
  });

  app.put("/api/encounters/:encounterId/combatState", (req, res) => {
    const { encounterId } = req.params;
    const combat = ctx.helpers.ensureCombat(encounterId);
    const enc = userData.encounters[encounterId] as any;
    const round = Number(req.body?.round);
    const activeCombatantId =
      req.body?.activeCombatantId != null
        ? String(req.body.activeCombatantId)
        : null;

    if (Number.isFinite(round) && round >= 1) combat.round = round;
    combat.activeCombatantId = activeCombatantId;

    if (activeCombatantId) {
      const idx = (combat.combatants ?? []).findIndex(
        (c) => c.id === activeCombatantId,
      );
      if (idx >= 0) combat.activeIndex = idx;
    }

    // Also persist onto encounter JSON.
    if (enc) {
      const safeRound =
        Number.isFinite(round) && round >= 1
          ? round
          : Number(combat.round ?? 1) || 1;
      enc.combat = { round: safeRound, activeCombatantId };
      enc.updatedAt = now();
    }

    combat.updatedAt = now();
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatStateChanged", { encounterId });
    res.json({
      ok: true,
      round: combat.round,
      activeCombatantId: combat.activeCombatantId,
    });
  });

  app.post("/api/encounters/:encounterId/combatants/addPlayers", (req, res) => {
    const { encounterId } = req.params;
    const encounter = userData.encounters[encounterId];
    if (!encounter)
      return res
        .status(404)
        .json({ ok: false, message: "Encounter not found" });
    const combat = ctx.helpers.ensureCombat(encounterId);
    const existingPlayerIds = new Set(
      (combat.combatants ?? [])
        .filter((c) => c.baseType === "player")
        .map((c) => c.baseId),
    );
   const players = Object.values(userData.players).filter(
      (p) => p.campaignId === encounter.campaignId,
    );
    const t = now();
    let added = 0;
    for (const p of players) {
      if (existingPlayerIds.has(p.id)) continue;
      combat.combatants.push(
        ctx.helpers.createPlayerCombatant({ encounterId, player: p, t }),
      );
      added++;
    }
    combat.updatedAt = t;
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatantsChanged", { encounterId });
    res.json({ ok: true, added });
  });

  app.post("/api/encounters/:encounterId/combatants/addPlayer", (req, res) => {
    const { encounterId } = req.params;
    const encounter = userData.encounters[encounterId];
    if (!encounter)
      return res
        .status(404)
        .json({ ok: false, message: "Encounter not found" });

    const playerId = String(req.body?.playerId ?? "").trim();
    const p = userData.players[playerId];
    if (!p)
      return res.status(404).json({ ok: false, message: "Player not found" });
    if (p.campaignId !== encounter.campaignId)
      return res
        .status(400)
        .json({ ok: false, message: "Player not in campaign" });

    const combat = ctx.helpers.ensureCombat(encounterId);
    const already = (combat.combatants ?? []).some(
      (c) => c.baseType === "player" && c.baseId === playerId,
    );
    if (already) return res.json({ ok: true, added: 0, already: true });

    const t = now();
    combat.combatants.push(
      ctx.helpers.createPlayerCombatant({ encounterId, player: p, t }),
    );
    combat.updatedAt = t;
    ctx.scheduleSave();
    ctx.broadcast("encounter:combatantsChanged", { encounterId });
    res.json({ ok: true, added: 1 });
  });

  app.post("/api/encounters/:encounterId/combatants/addMonster", (req, res) => {
    const { encounterId } = req.params;
    const encounter = userData.encounters[encounterId];
    if (!encounter)
      return res
        .status(404)
        .json({ ok: false, message: "Encounter not found" });

    const monsterId = String(req.body?.monsterId ?? "");
    const qty = Math.min(Math.max(Number(req.body?.qty ?? 1), 1), 20);
    const friendly = Boolean(req.body?.friendly ?? false);

    const labelBaseRaw = req.body?.labelBase;
    const labelBase = labelBaseRaw != null ? String(labelBaseRaw).trim() : "";
    const acOverrideRaw = req.body?.ac != null ? Number(req.body.ac) : NaN;
    const acOverride = Number.isFinite(acOverrideRaw) ? acOverrideRaw : null;
    const acDetails =
      req.body?.acDetails != null
        ? String(req.body.acDetails)
        : req.body?.acDetail != null
          ? String(req.body.acDetail)
          : null;
    const hpMaxOverrideRaw =
      req.body?.hpMax != null ? Number(req.body.hpMax) : NaN;
    const hpMaxOverride = Number.isFinite(hpMaxOverrideRaw)
      ? hpMaxOverrideRaw
      : null;
    const hpDetails =
      req.body?.hpDetails != null
        ? String(req.body.hpDetails)
        : req.body?.hpDetail != null
          ? String(req.body.hpDetail)
          : null;
    const attackOverrides =
      req.body?.attackOverrides && typeof req.body.attackOverrides === "object"
        ? req.body.attackOverrides
        : null;

    const m = compendium.state.monsters.find((x: any) => x.id === monsterId);
    if (!m)
      return res
        .status(404)
        .json({ ok: false, message: "Monster not found in compendium" });

    const leadingNumber = (v: unknown): number | null => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v === "string") {
        const m = v.match(/\d+/);
        return m ? Number(m[0]) : null;
      }
      if (typeof v === "object") {
        const obj = v as any;
        const candidates = [
          obj.value,
          obj.ac,
          obj.armorClass,
          obj.average,
          obj.hp,
          obj.max,
        ];
        for (const c of candidates) {
          const n = leadingNumber(c);
          if (n != null) return n;
        }
      }
      return null;
    };

    const mHp = m?.hp as any;
    const mAc = m?.ac as any;
    const defaultAc = leadingNumber(mAc);
    const defaultHp = leadingNumber(mHp?.average ?? mHp);
    const defaultAcDetails = mAc?.note ?? mAc?.type ?? null;
    const defaultHpDetails = mHp?.formula ?? mHp?.roll ?? null;

    const combat = ctx.helpers.ensureCombat(encounterId);
    const t = now();

    const baseName = m.name;
    const effectiveLabelBase = labelBase || baseName;
    let n: number = ctx.helpers.nextLabelNumber(
      encounterId,
      effectiveLabelBase,
    );

    const created: StoredCombatant[] = [];
    for (let i = 0; i < qty; i++) {
      const label =
        qty === 1 ? effectiveLabelBase : `${effectiveLabelBase} ${n++}`;
      const hpMax =
        hpMaxOverride != null && Number.isFinite(hpMaxOverride)
          ? hpMaxOverride
          : (defaultHp ?? null);
      const ac =
        acOverride != null && Number.isFinite(acOverride)
          ? acOverride
          : (defaultAc ?? null);

      const c = {
        id: uid(),
        encounterId,
        baseType: "monster" as const,
        baseId: monsterId,
        name: baseName,
        label,
        initiative: null,
        friendly,
        color: friendly ? "lightgreen" : "red",
        overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
        hpCurrent: hpMax,
        hpMax,
        hpDetails:
          hpDetails != null
            ? hpDetails
            : defaultHpDetails != null
              ? String(defaultHpDetails)
              : null,
        ac,
        acDetails:
          acDetails != null
            ? acDetails
            : defaultAcDetails != null
              ? String(defaultAcDetails)
              : null,
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
    if (!encounter)
      return res
        .status(404)
        .json({ ok: false, message: "Encounter not found" });

    const inpcId = String(req.body?.inpcId ?? "").trim();
    const i = userData.inpcs[inpcId];
    if (!i)
      return res.status(404).json({ ok: false, message: "iNPC not found" });

    const combat = ctx.helpers.ensureCombat(encounterId);
    const t = now();

    const c = {
      id: uid(),
      encounterId,
      baseType: "inpc" as const,
      baseId: inpcId,
      name: i.name,
      label: i.label || i.name,
      initiative: null,
      friendly: Boolean(i.friendly),
      color: Boolean(i.friendly) ? "lightgreen" : "red",
      overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
      hpCurrent: Number(i.hpCurrent ?? i.hpMax ?? 1),
      hpMax: Number(i.hpMax ?? 1),
      hpDetails: i.hpDetails ?? null,
      ac: Number(i.ac ?? 10),
      acDetails: i.acDetails ?? null,
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

  app.put(
    "/api/encounters/:encounterId/combatants/:combatantId",
    (req, res) => {
      const { encounterId, combatantId } = req.params;
      const combat = ctx.helpers.ensureCombat(encounterId);
      const idx = (combat.combatants ?? []).findIndex(
        (c) => c.id === combatantId,
      );
      if (idx < 0)
        return res.status(404).json({ ok: false, message: "Not found" });

      const existing = combat.combatants[idx]!;
      const t = now();

      // Parse death saves safely from unknown request body.
      let deathSaves = existing.deathSaves;
      if (req.body?.deathSaves != null && typeof req.body.deathSaves === "object") {
        const ds = req.body.deathSaves as Record<string, unknown>;
        const success = Number(ds.success);
        const fail = Number(ds.fail);
        deathSaves = {
          success: Number.isFinite(success) ? Math.max(0, Math.floor(success)) : (existing.deathSaves?.success ?? 0),
          fail: Number.isFinite(fail) ? Math.max(0, Math.floor(fail)) : (existing.deathSaves?.fail ?? 0),
        };
      }
      const next = {
        ...existing,
        label:
          req.body?.label != null ? String(req.body.label) : existing.label,
        initiative:
          req.body?.initiative !== undefined
            ? req.body.initiative == null
              ? null
              : Number(req.body.initiative)
            : (existing.initiative ?? null),
        friendly:
          req.body?.friendly != null
            ? Boolean(req.body.friendly)
            : existing.friendly,
        color:
          req.body?.color != null ? String(req.body.color) : existing.color,
        hpCurrent:
          req.body?.hpCurrent != null
            ? Number(req.body.hpCurrent)
            : existing.hpCurrent,
        hpMax:
          req.body?.hpMax != null ? Number(req.body.hpMax) : existing.hpMax,
        hpDetails:
          req.body?.hpDetails != null
            ? String(req.body.hpDetails)
            : req.body?.hpDetail != null
              ? String(req.body.hpDetail)
              : existing.hpDetails,
        ac: req.body?.ac != null ? Number(req.body.ac) : existing.ac,
        acDetails:
          req.body?.acDetails != null
            ? String(req.body.acDetails)
            : req.body?.acDetail != null
              ? String(req.body.acDetail)
              : existing.acDetails,
        attackOverrides:
         req.body?.attackOverrides !== undefined
           ? (req.body.attackOverrides ?? null)
           : existing.attackOverrides,
        overrides:
          req.body?.overrides != null
            ? (req.body.overrides as StoredCombatantOverrides)
            : existing.overrides,
        conditions: Array.isArray(req.body?.conditions)
          ? req.body.conditions
          : (existing.conditions ?? []),
        deathSaves,
        usedReaction: req.body?.usedReaction !== undefined
          ? Boolean(req.body.usedReaction)
          : (existing.usedReaction ?? false),
        usedLegendaryActions: req.body?.usedLegendaryActions !== undefined
          ? Math.max(0, Number(req.body.usedLegendaryActions) || 0)
          : (existing.usedLegendaryActions ?? 0),
        usedSpellSlots: req.body?.usedSpellSlots !== undefined
          ? (req.body.usedSpellSlots as Record<string, number>)
          : (existing.usedSpellSlots ?? {}),
        updatedAt: t,
      };

      combat.combatants[idx] = next as StoredCombatant;

      if (next.baseType === "player") {
        const p = userData.players[next.baseId];
        if (p) {
          if (next.hpCurrent != null) p.hpCurrent = Number(next.hpCurrent);
          // Only sync overrides if the client explicitly sent them.
          if (req.body?.overrides != null) p.overrides = next.overrides;
          // Sync player-scoped fields.
          if (Array.isArray(next.conditions)) p.conditions = next.conditions;
          if (next.deathSaves) p.deathSaves = next.deathSaves;
          p.updatedAt = t;
          ctx.broadcast("players:changed", { campaignId: p.campaignId });
        }
      }

      combat.updatedAt = t;
      ctx.scheduleSave();
      ctx.broadcast("encounter:combatantsChanged", { encounterId });
      res.json(next);
    },
  );

  app.delete(
    "/api/encounters/:encounterId/combatants/:combatantId",
    (req, res) => {
      const { encounterId, combatantId } = req.params;
      const combat = ctx.helpers.ensureCombat(encounterId);
      const idx = combat.combatants.findIndex((x) => x.id === combatantId);
      if (idx < 0)
        return res.status(404).json({ error: "Combatant not found" });

      combat.combatants.splice(idx, 1);
      combat.updatedAt = now();
      ctx.scheduleSave();
      ctx.broadcast("encounter:combatantsChanged", { encounterId });
      res.json({ ok: true });
    },
  );
}
