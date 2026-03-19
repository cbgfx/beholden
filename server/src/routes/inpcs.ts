import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { rowToINpc, INPC_COLS } from "../lib/db.js";
import { extractLeadingNumber, extractDetails } from "../lib/text.js";

const InpcCreateBody = z.object({
  monsterId: z.string(),
  qty: z.number().int().min(1).max(20).default(1),
  name: z.string().optional(),
  label: z.string().nullable().optional(),
  friendly: z.boolean().optional(),
  hpMax: z.number().optional(),
  hpCurrent: z.number().optional(),
  hpDetails: z.string().nullable().optional(),
  ac: z.number().optional(),
  acDetails: z.string().nullable().optional(),
});

const InpcUpdateBody = z.object({
  name: z.string().optional(),
  label: z.string().nullable().optional(),
  friendly: z.boolean().optional(),
  hpMax: z.number().optional(),
  hpCurrent: z.number().optional(),
  hpDetails: z.string().nullable().optional(),
  ac: z.number().optional(),
  acDetails: z.string().nullable().optional(),
});

export function registerInpcRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/inpcs", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db
      .prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToINpc));
  });

  app.post("/api/campaigns/:campaignId/inpcs", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const b = parseBody(InpcCreateBody, req);
    const { monsterId, qty } = b;

    const monRow = db
      .prepare("SELECT data_json FROM compendium_monsters WHERE id = ?")
      .get(monsterId) as { data_json: string } | undefined;
    if (!monRow)
      return res
        .status(404)
        .json({ ok: false, message: "Monster not found in compendium" });

    const m = JSON.parse(monRow.data_json);
    const mAc: unknown = m?.ac ?? null;
    const mHp: unknown = m?.hp ?? null;

    const defaultAc = extractLeadingNumber(mAc);
    const defaultHp = extractLeadingNumber(mHp);
    const defaultAcDetail = extractDetails(mAc);
    const defaultHpDetail = extractDetails(mHp);

    const t = now();
    const created: ReturnType<typeof rowToINpc>[] = [];

    for (let i = 0; i < qty; i++) {
      const id = uid();
      const name = b.name?.trim() || m.name;
      const hpMax = b.hpMax != null && Number.isFinite(b.hpMax) ? b.hpMax : (defaultHp ?? 1);
      const ac = b.ac != null && Number.isFinite(b.ac) ? b.ac : (defaultAc ?? 10);
      const hpDetails = b.hpDetails ?? (defaultHpDetail != null ? String(defaultHpDetail) : null);
      const acDetails = b.acDetails ?? (defaultAcDetail != null ? String(defaultAcDetail) : null);
      const label = b.label ?? null;
      const friendly = b.friendly ?? true;
      const hpCurrent = b.hpCurrent ?? hpMax;

      db.prepare(`
        INSERT INTO inpcs
          (id, campaign_id, monster_id, name, label, friendly, hp_max, hp_current, hp_details, ac, ac_details, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, campaignId, monsterId, name, label,
        friendly ? 1 : 0,
        hpMax, hpCurrent, hpDetails, ac, acDetails, t, t
      );

      created.push({
        id, campaignId, monsterId, name, label, friendly,
        hpMax, hpCurrent, hpDetails,
        ac, acDetails,
        createdAt: t, updatedAt: t,
      });
    }

    ctx.broadcast("inpcs:changed", { campaignId });
    res.json(created.length === 1 ? created[0] : { ok: true, created });
  });

  app.put("/api/inpcs/:inpcId", (req, res) => {
    const inpcId = requireParam(req, res, "inpcId");
    if (!inpcId) return;
    const existingRow = db
      .prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE id = ?`)
      .get(inpcId) as Record<string, unknown> | undefined;
    if (!existingRow)
      return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToINpc(existingRow);
    const b = parseBody(InpcUpdateBody, req);
    const t = now();

    const name = b.name ?? existing.name;
    const label = b.label !== undefined ? b.label : existing.label;
    const friendly = b.friendly ?? existing.friendly;
    const hpMax = b.hpMax ?? existing.hpMax;
    const hpCurrent = b.hpCurrent ?? existing.hpCurrent;
    const hpDetails = b.hpDetails !== undefined ? b.hpDetails : existing.hpDetails;
    const ac = b.ac ?? existing.ac;
    const acDetails = b.acDetails !== undefined ? b.acDetails : existing.acDetails;

    db.prepare(`
      UPDATE inpcs SET
        name=?, label=?, friendly=?, hp_max=?, hp_current=?, hp_details=?, ac=?, ac_details=?, updated_at=?
      WHERE id=?
    `).run(name, label, friendly ? 1 : 0, hpMax, hpCurrent, hpDetails, ac, acDetails, t, inpcId);

    ctx.broadcast("inpcs:changed", { campaignId: existing.campaignId });
    const updated = db.prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE id = ?`).get(inpcId) as Record<string, unknown>;
    res.json(rowToINpc(updated));
  });

  app.delete("/api/inpcs/:inpcId", (req, res) => {
    const inpcId = requireParam(req, res, "inpcId");
    if (!inpcId) return;
    const existingRow = db
      .prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE id = ?`)
      .get(inpcId) as Record<string, unknown> | undefined;
    if (!existingRow)
      return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToINpc(existingRow);

    // Remove inpc-type combatants from all encounters
    const affectedEncounters = db
      .prepare(
        "SELECT DISTINCT encounter_id FROM combatants WHERE base_type = 'inpc' AND base_id = ?"
      )
      .all(inpcId) as { encounter_id: string }[];

    db.prepare(
      "DELETE FROM combatants WHERE base_type = 'inpc' AND base_id = ?"
    ).run(inpcId);

    for (const { encounter_id } of affectedEncounters) {
      ctx.broadcast("encounter:combatantsChanged", { encounterId: encounter_id });
    }

    db.prepare("DELETE FROM inpcs WHERE id = ?").run(inpcId);
    ctx.broadcast("inpcs:changed", { campaignId: existing.campaignId });
    res.json({ ok: true });
  });
}
