// server/src/routes/players.ts
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import type { StoredConditionInstance, StoredPlayerOverrides, StoredDeathSaves } from "../server/userData.js";
import { requireParam } from "../lib/routeHelpers.js";

export function registerPlayerRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/players", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    res.json(Object.values(userData.players).filter((p) => p.campaignId === campaignId));
  });

  app.post("/api/campaigns/:campaignId/players", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const p = req.body ?? {};
    const id = uid();
    const t = now();
    userData.players[id] = {
      id,
      campaignId,
      playerName: String(p.playerName ?? "").trim() || "Player",
      characterName: String(p.characterName ?? "").trim() || "Character",
      level: Number(p.level ?? 1),
      class: String(p.class ?? "").trim() || "Class",
      species: String(p.species ?? "").trim() || "Species",
      hpMax: Number(p.hpMax ?? 10),
      hpCurrent: Number(p.hpCurrent ?? p.hpMax ?? 10),
      ac: Number(p.ac ?? 10),
      overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
      conditions: [],
      deathSaves: { success: 0, fail: 0 },
      str: Number(p.str ?? 10),
      dex: Number(p.dex ?? 10),
      con: Number(p.con ?? 10),
      int: Number(p.int ?? 10),
      wis: Number(p.wis ?? 10),
      cha: Number(p.cha ?? 10),
      color: p.color ?? "green",
      createdAt: t,
      updatedAt: t,
    };
    ctx.scheduleSave();
    ctx.broadcast("players:changed", { campaignId });
    res.json(userData.players[id]);
  });

  app.put("/api/players/:playerId", (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existing = userData.players[playerId];
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });
    const p = req.body ?? {};
    const t = now();

    // Parse deathSaves safely from unknown request body.
    const deathSaves: StoredDeathSaves = (() => {
      const base = existing.deathSaves ?? { success: 0, fail: 0 };
      if (p.deathSaves == null || typeof p.deathSaves !== "object") return base;
      const ds = p.deathSaves as Record<string, unknown>;
      return {
        success: Math.max(0, Math.min(3, Number(ds["success"] ?? base.success) || 0)),
        fail: Math.max(0, Math.min(3, Number(ds["fail"] ?? base.fail) || 0)),
      };
    })();

// Parse conditions safely from unknown request body.
    const conditions: StoredConditionInstance[] = (() => {
      if (!Array.isArray(p.conditions)) return existing.conditions ?? [];
      return (p.conditions as unknown[]).map((c) => {
        const ci = c as Record<string, unknown>;
        return {
          key: String(ci.key ?? ""),
          casterId: ci.casterId != null ? String(ci.casterId) : null,
        };
      });
    })();

    // Parse overrides safely from unknown request body.
    const overrides: StoredPlayerOverrides = (() => {
      const base = existing.overrides ?? { tempHp: 0, acBonus: 0, hpMaxOverride: null };
      if (p.overrides == null || typeof p.overrides !== "object") return base;
      const o = p.overrides as Record<string, unknown>;
      return {
        tempHp: Number(o.tempHp ?? base.tempHp) || 0,
        acBonus: Number(o.acBonus ?? base.acBonus) || 0,
        hpMaxOverride: o.hpMaxOverride != null ? Number(o.hpMaxOverride) : base.hpMaxOverride,
      };
    })();

    userData.players[playerId] = {
      ...existing,
      playerName: p.playerName != null ? String(p.playerName).trim() : existing.playerName,
      characterName: p.characterName != null ? String(p.characterName).trim() : existing.characterName,
      level: p.level != null ? Number(p.level) : existing.level,
      class: p.class != null ? String(p.class).trim() : existing.class,
      species: p.species != null ? String(p.species).trim() : existing.species,
      hpMax: p.hpMax != null ? Number(p.hpMax) : existing.hpMax,
      hpCurrent: p.hpCurrent != null ? Number(p.hpCurrent) : existing.hpCurrent,
      ac: p.ac != null ? Number(p.ac) : existing.ac,
      overrides,
      conditions,
      deathSaves,
      str: p.str != null ? Number(p.str) : existing.str ?? 10,
      dex: p.dex != null ? Number(p.dex) : existing.dex ?? 10,
      con: p.con != null ? Number(p.con) : existing.con ?? 10,
      int: p.int != null ? Number(p.int) : existing.int ?? 10,
      wis: p.wis != null ? Number(p.wis) : existing.wis ?? 10,
      cha: p.cha != null ? Number(p.cha) : existing.cha ?? 10,
      updatedAt: t,
    };
    ctx.scheduleSave();
    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    res.json(userData.players[playerId]);
  });

  app.delete("/api/players/:playerId", (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existing = userData.players[playerId];
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    for (const [encounterId, combat] of Object.entries(userData.combats)) {
      const before = combat.combatants.length;
      const next = combat.combatants.filter(
        (c) => !(c.baseType === "player" && c.baseId === playerId)
      );
      if (next.length !== before) {
        userData.combats[encounterId] = { ...combat, combatants: next, updatedAt: now() };
        ctx.broadcast("encounter:combatantsChanged", { encounterId });
      }
    }

    delete userData.players[playerId];
    ctx.scheduleSave();
    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    res.json({ ok: true });
  });
}
