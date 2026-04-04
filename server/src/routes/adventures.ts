import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import type { StoredEncounterActor, StoredConditionInstance } from "../server/userData.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import {
  rowToAdventure,
  rowToEncounter,
  rowToNote,
  rowToEncounterActor,
  nextSortFor,
  ADVENTURE_COLS,
  ENCOUNTER_COLS,
  NOTE_COLS,
  ENCOUNTER_ACTOR_COLS,
} from "../lib/db.js";
import { ensureCombat, insertCombatant } from "../services/combat.js";
import {
  ConditionInstanceSchema,
  AttackOverrideSchema,
  OverridesSchema,
} from "../lib/schemas.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import type { StoredNoteState } from "../server/userData.js";

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
  attackOverrides: AttackOverrideSchema.default(null),
  conditions: z.array(ConditionInstanceSchema).default([]),
  overrides: OverridesSchema.default(DEFAULT_OVERRIDES),
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
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const serializeNoteState = (note: StoredNoteState) => JSON.stringify(note);

  app.get("/api/campaigns/:campaignId/adventures", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db
      .prepare(
        `SELECT ${ADVENTURE_COLS} FROM adventures WHERE campaign_id = ? ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToAdventure));
  });

  app.post("/api/campaigns/:campaignId/adventures", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const body = parseBody(AdventureCreateBody, req);
    const name = body.name || "New Adventure";
    const id = uid();
    const t = now();
    const sort = nextSortFor(db, "adventures", "campaign_id", campaignId);
    db.prepare(
      "INSERT INTO adventures (id, campaign_id, name, status, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, campaignId, name, "active", sort, t, t);
    ctx.broadcast("adventures:changed", { campaignId });
    const row = db
      .prepare(`SELECT ${ADVENTURE_COLS} FROM adventures WHERE id = ?`)
      .get(id) as Record<string, unknown>;
    res.json(rowToAdventure(row));
  });

  // ── Export adventure ──────────────────────────────────────────────────────

  app.get("/api/adventures/:adventureId/export", memberOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const advRow = db
      .prepare(`SELECT ${ADVENTURE_COLS} FROM adventures WHERE id = ?`)
      .get(adventureId) as Record<string, unknown> | undefined;
    if (!advRow)
      return res.status(404).json({ ok: false, message: "Adventure not found" });
    const adv = rowToAdventure(advRow);

    const noteRows = db
      .prepare(
        `SELECT ${NOTE_COLS} FROM notes WHERE adventure_id = ? ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(adventureId) as Record<string, unknown>[];
    const notes = noteRows.map((n) => {
      const note = rowToNote(n);
      return {
        title: note.title,
        text: note.text,
        sort: note.sort,
      };
    });

    const encRows = db
      .prepare(
        `SELECT ${ENCOUNTER_COLS} FROM encounters WHERE adventure_id = ? ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(adventureId) as Record<string, unknown>[];

    // Fetch all combatants for all encounters in one query, group by encounter.
    const allCombatantRows = db
      .prepare(
        `SELECT ${ENCOUNTER_ACTOR_COLS}
         FROM combatants
         WHERE encounter_id IN (SELECT id FROM encounters WHERE adventure_id = ?)
         ORDER BY encounter_id, COALESCE(sort, 9999), created_at`
      )
      .all(adventureId) as Record<string, unknown>[];
    const combatantsByEnc = new Map<string, Record<string, unknown>[]>();
    for (const row of allCombatantRows) {
      const encId = row.encounter_id as string;
      if (!combatantsByEnc.has(encId)) combatantsByEnc.set(encId, []);
      combatantsByEnc.get(encId)!.push(row);
    }

    const encounters = encRows.map((encRow) => {
      const enc = rowToEncounter(encRow);
      const combatants = (combatantsByEnc.get(enc.id) ?? []).map((c) => {
        const combatant = rowToEncounterActor(c);
        return {
          baseType: combatant.baseType,
          baseId: combatant.baseId,
          name: combatant.name,
          label: combatant.label,
          initiative: combatant.initiative,
          friendly: combatant.friendly,
          color: combatant.color,
          hpMax: combatant.hpMax,
          hpCurrent: combatant.hpCurrent,
          hpDetails: combatant.hpDetails,
          ac: combatant.ac,
          acDetails: combatant.acDetails,
          attackOverrides: combatant.attackOverrides ?? null,
          conditions: combatant.conditions ?? [],
          overrides: combatant.overrides ?? DEFAULT_OVERRIDES,
          sort: combatant.sort,
        };
      });
      return { name: enc.name, status: enc.status, sort: enc.sort, combatants };
    });

    res.json({
      version: 1,
      adventure: { name: adv.name, status: adv.status, notes, encounters },
    });
  });

  // ── Import adventure ──────────────────────────────────────────────────────

  app.post("/api/campaigns/:campaignId/adventures/import", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const parsed = AdventureImportBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: "Invalid adventure file." });
    }

    const { adventure: imp } = parsed.data;
    const t = now();

    // Name collision check
    const existingNames = (
      db
        .prepare("SELECT name FROM adventures WHERE campaign_id = ?")
        .all(campaignId) as { name: string }[]
    ).map((r) => r.name);
    const adventureName = existingNames.includes(imp.name)
      ? `${imp.name} (Imported)`
      : imp.name;

    const advId = uid();
    const sort = nextSortFor(db, "adventures", "campaign_id", campaignId);

    db.transaction(() => {
      db.prepare(
        "INSERT INTO adventures (id, campaign_id, name, status, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(advId, campaignId, adventureName, imp.status, sort, t, t);

      for (const [i, n] of imp.notes.entries()) {
        db.prepare(
          "INSERT INTO notes (id, campaign_id, adventure_id, note_json, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(
          uid(),
          campaignId,
          advId,
          serializeNoteState({ title: n.title, text: n.text }),
          n.sort ?? i + 1,
          t,
          t
        );
      }

      for (const [i, enc] of imp.encounters.entries()) {
        const encId = uid();
        db.prepare(
          "INSERT INTO encounters (id, campaign_id, adventure_id, name, status, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(encId, campaignId, advId, enc.name, enc.status, enc.sort ?? i + 1, t, t);

        ensureCombat(db, encId);

        for (const [ci, c] of enc.combatants.entries()) {
          const combatant: StoredEncounterActor = {
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
            conditions: (c.conditions ?? []) as StoredConditionInstance[],
            overrides: c.overrides,
            sort: c.sort ?? ci + 1,
            deathSaves: { ...DEFAULT_DEATH_SAVES },
            usedReaction: false,
            usedLegendaryActions: 0,
            usedSpellSlots: {},
            createdAt: t,
            updatedAt: t,
          };
          insertCombatant(db, combatant);
        }
      }
    })();

    ctx.broadcast("adventures:changed", { campaignId });
    const advRow = db
      .prepare(`SELECT ${ADVENTURE_COLS} FROM adventures WHERE id = ?`)
      .get(advId) as Record<string, unknown>;
    res.json(rowToAdventure(advRow));
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  app.put("/api/adventures/:adventureId", dmOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const advRow = db
      .prepare(`SELECT ${ADVENTURE_COLS} FROM adventures WHERE id = ?`)
      .get(adventureId) as Record<string, unknown> | undefined;
    if (!advRow)
      return res.status(404).json({ ok: false, message: "Adventure not found" });
    const a = rowToAdventure(advRow);
    const body = parseBody(AdventureUpdateBody, req);
    const name = body.name || a.name;
    const t = now();
    db.prepare("UPDATE adventures SET name = ?, updated_at = ? WHERE id = ?").run(
      name,
      t,
      adventureId
    );
    ctx.broadcast("adventures:changed", { adventureId });
    res.json({ ...a, name, updatedAt: t });
  });

  app.delete("/api/adventures/:adventureId", dmOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const advRow = db
      .prepare("SELECT campaign_id FROM adventures WHERE id = ?")
      .get(adventureId) as { campaign_id: string } | undefined;
    if (!advRow)
      return res.status(404).json({ ok: false, message: "Adventure not found" });
    // FK CASCADE handles: encounters → combats, combatants; notes
    db.prepare("DELETE FROM adventures WHERE id = ?").run(adventureId);
    ctx.broadcast("adventures:changed", { adventureId, campaignId: advRow.campaign_id });
    res.json({ ok: true });
  });
}
