import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import type { StoredEncounterActor } from "../server/userData.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { rowToEncounter, rowToEncounterActor, nextSortFor, ENCOUNTER_COLS } from "../lib/db.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import { ensureCombat, insertCombatant, loadCombatants, buildEncounterActorLive } from "../services/combat.js";

const EncounterCreateBody = z.object({
  name: z.string().trim().optional(),
});

const EncounterUpdateBody = z.object({
  name: z.string().trim().optional(),
  status: z.string().optional(),
  combat: z.object({
    round: z.number().int().min(1).optional(),
    activeCombatantId: z.string().nullable().optional(),
  }).optional(),
});

export function registerEncounterRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const emitEncounterChange = (args: {
    campaignId: string;
    adventureId: string;
    action: "upsert" | "delete" | "refresh";
    encounterId?: string;
  }) => {
    ctx.broadcast("encounters:delta", {
      campaignId: args.campaignId,
      adventureId: args.adventureId,
      action: args.action,
      ...(args.encounterId ? { encounterId: args.encounterId } : {}),
    });
  };

  app.get("/api/adventures/:adventureId/encounters", memberOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const rows = db
      .prepare(
        `SELECT ${ENCOUNTER_COLS} FROM encounters WHERE adventure_id = ? ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(adventureId) as Record<string, unknown>[];
    res.json(rows.map(rowToEncounter));
  });

  app.get("/api/adventures/:adventureId/encounters/combatantsSummary", memberOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;

    const idsRaw = String(req.query.ids ?? "").trim();
    const encounterIds = idsRaw
      ? Array.from(new Set(idsRaw.split(",").map((id) => id.trim()).filter(Boolean)))
      : [];

    const params: unknown[] = [adventureId];
    const parts: string[] = [
      `SELECT c.encounter_id, c.base_type, c.base_id, c.live_json
       FROM combatants c
       JOIN encounters e ON e.id = c.encounter_id
       WHERE e.adventure_id = ?
         AND c.base_type IN ('monster', 'inpc')`,
    ];
    if (encounterIds.length > 0) {
      parts.push(`AND c.encounter_id IN (${encounterIds.map(() => "?").join(",")})`);
      params.push(...encounterIds);
    }
    parts.push("ORDER BY c.encounter_id ASC, COALESCE(c.sort, 9999) ASC, c.created_at ASC");

    const rows = db.prepare(parts.join("\n")).all(...params) as Array<{
      encounter_id: string;
      base_type: "monster" | "inpc";
      base_id: string;
      live_json: string;
    }>;

    const summaryRows = rows.map((row) => {
      let friendly = false;
      try {
        const parsed = JSON.parse(row.live_json ?? "{}") as { friendly?: unknown };
        friendly = parsed?.friendly === true || parsed?.friendly === 1;
      } catch {
        friendly = false;
      }
      return {
        encounterId: row.encounter_id,
        baseType: row.base_type,
        baseId: row.base_id,
        friendly,
      };
    });

    res.json({ rows: summaryRows });
  });

  app.get("/api/encounters/:encounterId", memberOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const row = db
      .prepare(`SELECT ${ENCOUNTER_COLS} FROM encounters WHERE id = ?`)
      .get(encounterId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Encounter not found" });
    res.json(rowToEncounter(row));
  });

  app.post("/api/adventures/:adventureId/encounters", dmOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const advRow = db
      .prepare("SELECT campaign_id FROM adventures WHERE id = ?")
      .get(adventureId) as { campaign_id: string } | undefined;
    if (!advRow)
      return res.status(404).json({ ok: false, message: "Adventure not found" });

    const body = parseBody(EncounterCreateBody, req);
    const name = body.name || "New Encounter";
    const id = uid();
    const t = now();
    const sort = nextSortFor(db, "encounters", "adventure_id", adventureId);
    db.prepare(
      "INSERT INTO encounters (id, campaign_id, adventure_id, name, status, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, advRow.campaign_id, adventureId, name, "Open", sort, t, t);
    ensureCombat(db, id);
    emitEncounterChange({
      campaignId: advRow.campaign_id,
      adventureId,
      action: "upsert",
      encounterId: id,
    });
    const row = db
      .prepare(`SELECT ${ENCOUNTER_COLS} FROM encounters WHERE id = ?`)
      .get(id) as Record<string, unknown>;
    res.json(rowToEncounter(row));
  });

  app.put("/api/encounters/:encounterId", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare(`SELECT ${ENCOUNTER_COLS} FROM encounters WHERE id = ?`)
      .get(encounterId) as Record<string, unknown> | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });

    const e = rowToEncounter(encRow);
    const body = parseBody(EncounterUpdateBody, req);
    const t = now();

    const name = body.name !== undefined ? (body.name || e.name) : e.name;
    const status = body.status !== undefined ? body.status : e.status;

    // combat field stores round/activeCombatantId on the encounter row
    let combatRound: number | null = (encRow.combat_round as number | null) ?? null;
    let combatActiveCombatantId: string | null =
      (encRow.combat_active_combatant_id as string | null) ?? null;
    if (body.combat != null) {
      if (body.combat.round != null) combatRound = body.combat.round;
      if (body.combat.activeCombatantId !== undefined)
        combatActiveCombatantId = body.combat.activeCombatantId ?? null;
    }

    db.prepare(
      "UPDATE encounters SET name=?, status=?, combat_round=?, combat_active_combatant_id=?, updated_at=? WHERE id=?"
    ).run(name, status, combatRound, combatActiveCombatantId, t, encounterId);

    emitEncounterChange({
      campaignId: e.campaignId,
      adventureId: e.adventureId,
      action: "upsert",
      encounterId,
    });
    const updated = db
      .prepare(`SELECT ${ENCOUNTER_COLS} FROM encounters WHERE id = ?`)
      .get(encounterId) as Record<string, unknown>;
    res.json(rowToEncounter(updated));
  });

  app.delete("/api/encounters/:encounterId", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare("SELECT campaign_id, adventure_id FROM encounters WHERE id = ?")
      .get(encounterId) as { campaign_id: string; adventure_id: string } | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });
    // FK CASCADE: encounter → combats, combatants
    db.prepare("DELETE FROM encounters WHERE id = ?").run(encounterId);
    emitEncounterChange({
      campaignId: encRow.campaign_id,
      adventureId: encRow.adventure_id,
      action: "delete",
      encounterId,
    });
    res.json({ ok: true });
  });

  // Duplicate an encounter — copies the roster with fresh HP/initiative/conditions.
  app.post("/api/encounters/:encounterId/duplicate", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare(`SELECT ${ENCOUNTER_COLS} FROM encounters WHERE id = ?`)
      .get(encounterId) as Record<string, unknown> | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });
    const enc = rowToEncounter(encRow);

    const t = now();
    const newId = uid();
    const sort = nextSortFor(db, "encounters", "adventure_id", enc.adventureId);

    const origCombatants = loadCombatants(db, encounterId);

    db.transaction(() => {
      db.prepare(
        "INSERT INTO encounters (id, campaign_id, adventure_id, name, status, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        newId,
        enc.campaignId,
        enc.adventureId,
        `${enc.name} (copy)`,
        "Open",
        sort,
        t,
        t
      );

      ensureCombat(db, newId);

      for (const c of origCombatants) {
        const fresh: StoredEncounterActor = {
          ...c,
          id: uid(),
          encounterId: newId,
          ...buildEncounterActorLive(c, {
            initiative: null,
            hpCurrent: c.hpMax,
            overrides: { ...DEFAULT_OVERRIDES },
            conditions: [],
            deathSaves: { ...DEFAULT_DEATH_SAVES },
            usedReaction: false,
            usedLegendaryActions: 0,
            usedSpellSlots: {},
          }),
          createdAt: t,
          updatedAt: t,
        };
        insertCombatant(db, fresh);
      }
    })();

    emitEncounterChange({
      campaignId: enc.campaignId,
      adventureId: enc.adventureId,
      action: "upsert",
      encounterId: newId,
    });
    const newRow = db
      .prepare(`SELECT ${ENCOUNTER_COLS} FROM encounters WHERE id = ?`)
      .get(newId) as Record<string, unknown>;
    res.json(rowToEncounter(newRow));
  });
}
