import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import type { StoredAdventure, StoredEncounter, StoredNote, StoredCombat, StoredCombatant } from "../server/userData.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";

const AdventureCreateBody = z.object({
  name: z.string().trim().optional(),
});

const AdventureUpdateBody = z.object({
  name: z.string().trim().optional(),
});

// ── Import schemas ──────────────────────────────────────────────────────────

const CombatantImport = z.object({
  baseType: z.enum(["player", "monster", "inpc"]).default("monster"),
  baseId: z.string().default(""),
  name: z.string(),
  label: z.string(),
  initiative: z.number().nullable().default(null),
  friendly: z.boolean().default(false),
  color: z.string().default("#888888"),
  hpMax: z.number().nullable().default(null),
  hpCurrent: z.number().nullable().default(null),
  hpDetails: z.string().nullable().default(null),
  ac: z.number().nullable().default(null),
  acDetails: z.string().nullable().default(null),
  attackOverrides: z.unknown().nullable().default(null),
  conditions: z.array(z.any()).default([]),
  overrides: z.object({
    tempHp: z.number().default(0),
    acBonus: z.number().default(0),
    hpMaxOverride: z.number().nullable().default(null),
  }).default({ tempHp: 0, acBonus: 0, hpMaxOverride: null }),
  sort: z.number().optional(),
});

const EncounterImport = z.object({
  name: z.string(),
  status: z.string().default("Open"),
  sort: z.number().optional(),
  combatants: z.array(CombatantImport).default([]),
});

const NoteImport = z.object({
  title: z.string(),
  text: z.string(),
  sort: z.number().optional(),
});

const AdventureImportBody = z.object({
  version: z.literal(1),
  adventure: z.object({
    name: z.string(),
    status: z.string().default("active"),
    notes: z.array(NoteImport).default([]),
    encounters: z.array(EncounterImport).default([]),
  }),
});

// ───────────────────────────────────────────────────────────────────────────

export function registerAdventureRoutes(app: Express, ctx: ServerContext) {
  const { userData } = ctx;
  const { uid, now, bySortThenUpdatedDesc, nextSort } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/adventures", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = Object.values(userData.adventures)
      .filter((a) => a.campaignId === campaignId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.post("/api/campaigns/:campaignId/adventures", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const body = parseBody(AdventureCreateBody, req);
    const name = body.name || "New Adventure";
    const id = uid();
    const t = now();
    userData.adventures[id] = {
      id,
      campaignId,
      name,
      status: "active",
      sort: nextSort(Object.values(userData.adventures).filter((a) => a.campaignId === campaignId)),
      createdAt: t,
      updatedAt: t,
    };
    ctx.scheduleSave();
    ctx.broadcast("adventures:changed", { campaignId });
    res.json(userData.adventures[id]);
  });

  // ── Export adventure ──────────────────────────────────────────────────────

  app.get("/api/adventures/:adventureId/export", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const adv = userData.adventures[adventureId];
    if (!adv) return res.status(404).json({ ok: false, message: "Adventure not found" });

    const notes = Object.values(userData.notes)
      .filter((n) => n.adventureId === adventureId)
      .sort(bySortThenUpdatedDesc)
      .map((n) => ({ title: n.title, text: n.text, sort: n.sort }));

    const encounters = Object.values(userData.encounters)
      .filter((e) => e.adventureId === adventureId)
      .sort(bySortThenUpdatedDesc)
      .map((enc) => {
        const combatants = (userData.combats[enc.id]?.combatants ?? [])
          .slice()
          .sort((a, b) => ((a.sort ?? 0) - (b.sort ?? 0)))
          .map((c) => ({
            baseType: c.baseType,
            baseId: c.baseId,
            name: c.name,
            label: c.label,
            initiative: c.initiative,
            friendly: c.friendly,
            color: c.color,
            hpMax: c.hpMax,
            hpCurrent: c.hpCurrent,
            hpDetails: c.hpDetails,
            ac: c.ac,
            acDetails: c.acDetails,
            attackOverrides: c.attackOverrides ?? null,
            conditions: c.conditions ?? [],
            overrides: c.overrides ?? { tempHp: 0, acBonus: 0, hpMaxOverride: null },
            sort: c.sort,
          }));
        return {
          name: enc.name,
          status: enc.status,
          sort: enc.sort,
          combatants,
        };
      });

    res.json({ version: 1, adventure: { name: adv.name, status: adv.status, notes, encounters } });
  });

  // ── Import adventure ──────────────────────────────────────────────────────

  app.post("/api/campaigns/:campaignId/adventures/import", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const parsed = AdventureImportBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: "Invalid adventure file." });
    }

    const { adventure: imp } = parsed.data;
    const t = now();

    // Name collision check
    const existingNames = Object.values(userData.adventures)
      .filter((a) => a.campaignId === campaignId)
      .map((a) => a.name);
    const adventureName = existingNames.includes(imp.name)
      ? `${imp.name} (Imported)`
      : imp.name;

    // Create adventure
    const advId = uid();
    const campaignAdventures = Object.values(userData.adventures).filter(
      (a) => a.campaignId === campaignId
    );
    const newAdventure: StoredAdventure = {
      id: advId,
      campaignId,
      name: adventureName,
      status: imp.status,
      sort: nextSort(campaignAdventures),
      createdAt: t,
      updatedAt: t,
    };
    userData.adventures[advId] = newAdventure;

    // Create notes
    for (const [i, n] of imp.notes.entries()) {
      const noteId = uid();
      const note: StoredNote = {
        id: noteId,
        campaignId,
        adventureId: advId,
        title: n.title,
        text: n.text,
        sort: n.sort ?? i + 1,
        createdAt: t,
        updatedAt: t,
      };
      userData.notes[noteId] = note;
    }

    // Create encounters + combats
    for (const [i, enc] of imp.encounters.entries()) {
      const encId = uid();
      const encounter: StoredEncounter = {
        id: encId,
        campaignId,
        adventureId: advId,
        name: enc.name,
        status: enc.status,
        sort: enc.sort ?? i + 1,
        createdAt: t,
        updatedAt: t,
      };
      userData.encounters[encId] = encounter;

      const combatants: StoredCombatant[] = enc.combatants.map((c, ci) => ({
        id: uid(),
        encounterId: encId,
        baseType: c.baseType,
        baseId: c.baseId,
        name: c.name,
        label: c.label,
        initiative: c.initiative,
        friendly: c.friendly,
        color: c.color,
        hpMax: c.hpMax,
        hpCurrent: c.hpCurrent,
        hpDetails: c.hpDetails,
        ac: c.ac,
        acDetails: c.acDetails,
        attackOverrides: c.attackOverrides ?? null,
        conditions: c.conditions ?? [],
        overrides: c.overrides,
        sort: c.sort ?? ci + 1,
        deathSaves: { success: 0, fail: 0 },
        usedReaction: false,
        usedLegendaryActions: 0,
        usedSpellSlots: {},
        createdAt: t,
        updatedAt: t,
      }));

      const combat: StoredCombat = {
        encounterId: encId,
        round: 1,
        activeIndex: 0,
        activeCombatantId: null,
        combatants,
        createdAt: t,
        updatedAt: t,
      };
      userData.combats[encId] = combat;
    }

    ctx.scheduleSave();
    ctx.broadcast("adventures:changed", { campaignId });
    res.json(newAdventure);
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  app.put("/api/adventures/:adventureId", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const a = userData.adventures[adventureId];
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const body = parseBody(AdventureUpdateBody, req);
    const name = body.name || a.name;
    const t = now();
    userData.adventures[adventureId] = { ...a, name, updatedAt: t };
    ctx.scheduleSave();
    ctx.broadcast("adventures:changed", { adventureId });
    res.json(userData.adventures[adventureId]);
  });

  app.delete("/api/adventures/:adventureId", (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const a = userData.adventures[adventureId];
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });

    const encIds = Object.values(userData.encounters)
      .filter((e) => e.adventureId === adventureId)
      .map((e) => e.id);
    for (const id of encIds) {
      delete userData.encounters[id];
      delete userData.combats[id];
    }

    for (const n of Object.values(userData.notes)) {
      if (n.adventureId === adventureId) delete userData.notes[n.id];
    }

    delete userData.adventures[adventureId];

    ctx.scheduleSave();
    ctx.broadcast("adventures:changed", { adventureId });
    res.json({ ok: true });
  });
}
