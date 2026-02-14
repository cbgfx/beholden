import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerPlayerRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/players", (req, res) => {
    const { campaignId } = req.params;
    res.json(Object.values(userData.players).filter((p) => p.campaignId === campaignId));
  });

  app.post("/api/campaigns/:campaignId/players", (req, res) => {
    const { campaignId } = req.params;
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
      // Persisted combat state for the player across encounters.
      overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
      conditions: [],
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
    const { playerId } = req.params;
    const existing = userData.players[playerId];
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });
    const p = req.body ?? {};
    const t = now();
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
    const { playerId } = req.params;
    const existing = userData.players[playerId];
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    for (const [encounterId, combat] of Object.entries(userData.combats)) {
      if (!combat?.combatants) continue;
      const before = combat.combatants.length;
      const next = combat.combatants.filter(
        (c: any) =>
          !(c?.sourceType === "player" && c?.sourceId === playerId) &&
          !(c?.baseType === "player" && c?.baseId === playerId)
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
