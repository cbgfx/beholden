import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { dmOrAdmin } from "../middleware/campaignAuth.js";

const ReorderBody = z.object({
  ids: z.array(z.string()),
});

// Allowlist guards: table names and column names are not user-supplied, but
// we validate them anyway to prevent accidental misuse if callers change.
const REORDER_TABLES = new Set(["adventures", "encounters", "notes", "treasure"]);
const REORDER_COLUMNS = new Set(["campaign_id", "adventure_id"]);

export function registerReorderRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now } = ctx.helpers;

  function runReorder(
    table: string,
    col: string,
    val: string,
    ids: string[],
    t: number,
    extraWhere = ""
  ) {
    if (!REORDER_TABLES.has(table) || !REORDER_COLUMNS.has(col)) {
      throw new Error(`runReorder: invalid table "${table}" or column "${col}"`);
    }
    const stmt = db.prepare(
      `UPDATE ${table} SET sort=?, updated_at=? WHERE id=? AND ${col}=?${extraWhere}`
    );
    db.transaction(() => {
      ids.forEach((id, i) => stmt.run(i + 1, t, id, val));
    })();
  }

  app.post("/api/campaigns/:campaignId/adventures/reorder", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const { ids } = parseBody(ReorderBody, req);
    runReorder("adventures", "campaign_id", campaignId, ids, now());
    ctx.broadcast("adventures:changed", { campaignId });
    res.json({ ok: true });
  });

  app.post("/api/adventures/:adventureId/encounters/reorder", dmOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const aRow = db
      .prepare("SELECT campaign_id FROM adventures WHERE id = ?")
      .get(adventureId) as { campaign_id: string } | undefined;
    if (!aRow) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const { ids } = parseBody(ReorderBody, req);
    runReorder("encounters", "adventure_id", adventureId, ids, now());
    ctx.broadcast("encounters:changed", { campaignId: aRow.campaign_id });
    res.json({ ok: true });
  });

  app.post("/api/campaigns/:campaignId/notes/reorder", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const { ids } = parseBody(ReorderBody, req);
    runReorder("notes", "campaign_id", campaignId, ids, now(), " AND adventure_id IS NULL");
    ctx.broadcast("notes:changed", { campaignId });
    ctx.broadcast("notes:delta", { campaignId, adventureId: null, action: "refresh" });
    res.json({ ok: true });
  });

  app.post("/api/adventures/:adventureId/notes/reorder", dmOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const aRow = db
      .prepare("SELECT campaign_id FROM adventures WHERE id = ?")
      .get(adventureId) as { campaign_id: string } | undefined;
    if (!aRow) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const { ids } = parseBody(ReorderBody, req);
    runReorder("notes", "adventure_id", adventureId, ids, now());
    ctx.broadcast("notes:changed", { campaignId: aRow.campaign_id });
    ctx.broadcast("notes:delta", { campaignId: aRow.campaign_id, adventureId, action: "refresh" });
    res.json({ ok: true });
  });
}
