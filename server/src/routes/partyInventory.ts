import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { memberOrAdmin } from "../middleware/campaignAuth.js";

const ItemBody = z.object({
  name: z.string().trim().min(1),
  quantity: z.number().int().min(1).optional().default(1),
  weight: z.number().nullable().optional(),
  notes: z.string().optional().default(""),
  source: z.string().optional(),
  itemId: z.string().optional(),
  rarity: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  description: z.string().optional(),
});

const QuantityBody = z.object({ quantity: z.number().int().min(1) });

export function registerPartyInventoryRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  // GET all items
  app.get("/api/campaigns/:campaignId/party-inventory", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db.prepare(
      "SELECT * FROM party_inventory WHERE campaign_id = ? ORDER BY sort ASC, created_at ASC"
    ).all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToItem));
  });

  // POST add item
  app.post("/api/campaigns/:campaignId/party-inventory", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const body = parseBody(ItemBody, req);
    const id = uid();
    const t = now();
    const maxSort = (db.prepare(
      "SELECT COALESCE(MAX(sort),0)+1 AS n FROM party_inventory WHERE campaign_id = ?"
    ).get(campaignId) as { n: number }).n;
    db.prepare(
      `INSERT INTO party_inventory (id, campaign_id, name, quantity, weight, notes, source, item_id, rarity, type, description, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, campaignId, body.name, body.quantity, body.weight ?? null, body.notes, body.source ?? null, body.itemId ?? null, body.rarity ?? null, body.type ?? null, body.description ?? null, maxSort, t, t);
    ctx.broadcast("partyInventory:changed", { campaignId });
    res.status(201).json(rowToItem(db.prepare("SELECT * FROM party_inventory WHERE id = ?").get(id) as Record<string, unknown>));
  });

  // PUT update item
  app.put("/api/campaigns/:campaignId/party-inventory/:itemId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const itemId = req.params["itemId"];
    const body = parseBody(ItemBody, req);
    const t = now();
    db.prepare(
      `UPDATE party_inventory SET name=?, quantity=?, weight=?, notes=?, rarity=?, type=?, description=?, updated_at=?
       WHERE id=? AND campaign_id=?`
    ).run(body.name, body.quantity, body.weight ?? null, body.notes, body.rarity ?? null, body.type ?? null, body.description ?? null, t, itemId, campaignId);
    ctx.broadcast("partyInventory:changed", { campaignId });
    const row = db.prepare("SELECT * FROM party_inventory WHERE id = ?").get(itemId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json(rowToItem(row));
  });

  // PATCH quantity only (quick +/- from UI)
  app.patch("/api/campaigns/:campaignId/party-inventory/:itemId/quantity", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const itemId = req.params["itemId"];
    const { quantity } = parseBody(QuantityBody, req);
    db.prepare("UPDATE party_inventory SET quantity=?, updated_at=? WHERE id=? AND campaign_id=?")
      .run(quantity, now(), itemId, campaignId);
    ctx.broadcast("partyInventory:changed", { campaignId });
    res.json({ ok: true });
  });

  // DELETE item
  app.delete("/api/campaigns/:campaignId/party-inventory/:itemId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    db.prepare("DELETE FROM party_inventory WHERE id = ? AND campaign_id = ?")
      .run(req.params["itemId"], campaignId);
    ctx.broadcast("partyInventory:changed", { campaignId });
    res.json({ ok: true });
  });
}

function rowToItem(r: Record<string, unknown>) {
  return {
    id: r["id"] as string,
    campaignId: r["campaign_id"] as string,
    name: r["name"] as string,
    quantity: r["quantity"] as number,
    weight: r["weight"] as number | null,
    notes: r["notes"] as string,
    source: r["source"] as string | null,
    itemId: r["item_id"] as string | null,
    rarity: r["rarity"] as string | null,
    type: r["type"] as string | null,
    description: r["description"] as string | null,
    sort: r["sort"] as number,
    createdAt: r["created_at"] as number,
    updatedAt: r["updated_at"] as number,
  };
}
