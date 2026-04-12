import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { PARTY_INVENTORY_COLS, rowToPartyInventoryItem } from "../lib/db.js";
import { toPartyInventoryItemDto } from "../lib/apiCollections.js";
import { memberOrAdmin } from "../middleware/campaignAuth.js";
import type { StoredPartyInventoryItemState } from "../server/userData.js";

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

function serializePartyInventoryItemState(item: StoredPartyInventoryItemState) {
  void item;
  return "{}";
}

export function registerPartyInventoryRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const emitPartyInventoryChange = (args: {
    campaignId: string;
    action: "upsert" | "delete" | "refresh";
    itemId?: string;
  }) => {
    ctx.broadcast("partyInventory:changed", { campaignId: args.campaignId });
    ctx.broadcast("partyInventory:delta", {
      campaignId: args.campaignId,
      action: args.action,
      ...(args.itemId ? { itemId: args.itemId } : {}),
    });
  };

  // GET all items
  app.get("/api/campaigns/:campaignId/party-inventory", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db.prepare(
      `SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE campaign_id = ? ORDER BY sort ASC, created_at ASC`
    ).all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToPartyInventoryItem).map(toPartyInventoryItemDto));
  });

  app.get("/api/campaigns/:campaignId/party-inventory/:itemId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const itemId = req.params["itemId"];
    const row = db
      .prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE id = ? AND campaign_id = ?`)
      .get(itemId, campaignId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json(toPartyInventoryItemDto(rowToPartyInventoryItem(row)));
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
      `INSERT INTO party_inventory
       (id, campaign_id, name, quantity, weight, notes, source, item_id, rarity, type, description, item_json, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      campaignId,
      body.name,
      body.quantity ?? 1,
      body.weight ?? null,
      body.notes ?? "",
      body.source ?? null,
      body.itemId ?? null,
      body.rarity ?? null,
      body.type ?? null,
      body.description ?? null,
      serializePartyInventoryItemState({
        name: body.name,
        quantity: body.quantity ?? 1,
        weight: body.weight ?? null,
        notes: body.notes ?? "",
        source: body.source ?? null,
        itemId: body.itemId ?? null,
        rarity: body.rarity ?? null,
        type: body.type ?? null,
        description: body.description ?? null,
      }),
      maxSort,
      t,
      t
    );
    emitPartyInventoryChange({ campaignId, action: "upsert", itemId: id });
    res.status(201).json(
      toPartyInventoryItemDto(
        rowToPartyInventoryItem(
          db.prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE id = ?`).get(id) as Record<string, unknown>
        )
      )
    );
  });

  // PUT update item
  app.put("/api/campaigns/:campaignId/party-inventory/:itemId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const body = parseBody(ItemBody, req);
    const t = now();
    const existing = db
      .prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE id = ? AND campaign_id = ?`)
      .get(itemId, campaignId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });
    db.prepare(
      `UPDATE party_inventory SET
         name=?, quantity=?, weight=?, notes=?, source=?, item_id=?, rarity=?, type=?, description=?, item_json=?, updated_at=?
       WHERE id=? AND campaign_id=?`
    ).run(
      body.name,
      body.quantity ?? 1,
      body.weight ?? null,
      body.notes ?? "",
      body.source ?? null,
      body.itemId ?? null,
      body.rarity ?? null,
      body.type ?? null,
      body.description ?? null,
      serializePartyInventoryItemState({
        name: body.name,
        quantity: body.quantity ?? 1,
        weight: body.weight ?? null,
        notes: body.notes ?? "",
        source: body.source ?? null,
        itemId: body.itemId ?? null,
        rarity: body.rarity ?? null,
        type: body.type ?? null,
        description: body.description ?? null,
      }),
      t,
      itemId,
      campaignId
    );
    emitPartyInventoryChange({ campaignId, action: "upsert", itemId });
    const row = db
      .prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE id = ?`)
      .get(itemId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json(toPartyInventoryItemDto(rowToPartyInventoryItem(row)));
  });

  // PATCH quantity only (quick +/- from UI)
  app.patch("/api/campaigns/:campaignId/party-inventory/:itemId/quantity", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const { quantity } = parseBody(QuantityBody, req);
    const existing = db
      .prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE id = ? AND campaign_id = ?`)
      .get(itemId, campaignId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });
    const item = rowToPartyInventoryItem(existing);
    db.prepare("UPDATE party_inventory SET quantity=?, item_json=?, updated_at=? WHERE id=? AND campaign_id=?")
      .run(
        quantity,
        serializePartyInventoryItemState({
          name: item.name,
          quantity,
          weight: item.weight,
          notes: item.notes,
          source: item.source,
          itemId: item.itemId,
          rarity: item.rarity,
          type: item.type,
          description: item.description,
        }),
        now(),
        itemId,
        campaignId
      );
    emitPartyInventoryChange({ campaignId, action: "upsert", itemId });
    const row = db
      .prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE id = ? AND campaign_id = ?`)
      .get(itemId, campaignId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json(toPartyInventoryItemDto(rowToPartyInventoryItem(row)));
  });

  // DELETE item
  app.delete("/api/campaigns/:campaignId/party-inventory/:itemId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    db.prepare("DELETE FROM party_inventory WHERE id = ? AND campaign_id = ?")
      .run(itemId, campaignId);
    emitPartyInventoryChange({ campaignId, action: "delete", itemId });
    res.json({ ok: true });
  });
}
