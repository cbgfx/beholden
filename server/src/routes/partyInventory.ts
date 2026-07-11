import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../shared/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { PARTY_INVENTORY_COLS, rowToPartyInventoryItem, type Db } from "../lib/db.js";
import { toPartyInventoryItemDto } from "../lib/apiCollections.js";
import { memberOrAdmin } from "../middleware/campaignAuth.js";

export type PartyCurrencyMap = { PP: number; GP: number; SP: number; CP: number };
const EMPTY_PARTY_CURRENCY: PartyCurrencyMap = { PP: 0, GP: 0, SP: 0, CP: 0 };

function readPartyCurrency(db: Db, campaignId: string): PartyCurrencyMap {
  const row = db.prepare("SELECT party_currency_json FROM campaigns WHERE id = ?").get(campaignId) as
    | { party_currency_json: string | null }
    | undefined;
  if (!row) return { ...EMPTY_PARTY_CURRENCY };
  try {
    return { ...EMPTY_PARTY_CURRENCY, ...(JSON.parse(row.party_currency_json ?? "{}") as Partial<PartyCurrencyMap>) };
  } catch {
    return { ...EMPTY_PARTY_CURRENCY };
  }
}

const CurrencyPatchBody = z.object({
  PP: z.number().int().min(0).optional(),
  GP: z.number().int().min(0).optional(),
  SP: z.number().int().min(0).optional(),
  CP: z.number().int().min(0).optional(),
});

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
  const emitPartyInventoryChange = (args: {
    campaignId: string;
    action: "upsert" | "delete" | "refresh";
    itemId?: string;
  }) => {
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
    const items = rows.map(rowToPartyInventoryItem).map(toPartyInventoryItemDto);

    // The stash can use the combined unused carrying capacity of every
    // character in the campaign: sum(max(0, Strength * 15 - carried weight)).
    const playerRows = db.prepare(`
      SELECT p.str, uc.character_data_json
      FROM players p
      LEFT JOIN user_characters uc ON p.character_id = uc.id
      WHERE p.campaign_id = ? AND p.str IS NOT NULL
    `).all(campaignId) as Array<{ str: number; character_data_json: string | null }>;

    let partyCapacityLbs: number | null = null;
    if (playerRows.length > 0) {
      partyCapacityLbs = 0;
      for (const { str, character_data_json } of playerRows) {
        let carriedWeight = 0;
        if (character_data_json) {
          try {
            const data = JSON.parse(character_data_json) as Record<string, unknown>;
            const inventory = Array.isArray(data.inventory) ? data.inventory as Record<string, unknown>[] : [];
            const containers = Array.isArray(data.inventoryContainers)
              ? data.inventoryContainers as Array<{ id: string; ignoreWeight?: boolean }>
              : [];
            const ignoredContainerIds = new Set(
              containers.filter((container) => container.ignoreWeight).map((container) => container.id),
            );
            for (const item of inventory) {
              const containerId = typeof item["containerId"] === "string" ? item["containerId"] : null;
              if (containerId && ignoredContainerIds.has(containerId)) continue;
              const weight = Math.max(0, Number(item["weight"]) || 0);
              const quantity = Math.max(1, Number(item["quantity"]) || 1);
              carriedWeight += weight * quantity;
            }
          } catch { /* Treat invalid/missing inventory as empty. */ }
        }
        partyCapacityLbs += Math.max(0, str * 15 - carriedWeight);
      }
    }

    res.json({ items, partyCapacityLbs });
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
       (id, campaign_id, name, quantity, weight, notes, source, item_id, rarity, type, description, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
         name=?, quantity=?, weight=?, notes=?, source=?, item_id=?, rarity=?, type=?, description=?, updated_at=?
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
    db.prepare("UPDATE party_inventory SET quantity=?, updated_at=? WHERE id=? AND campaign_id=?")
      .run(quantity, now(), itemId, campaignId);
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

  // GET party currency
  app.get("/api/campaigns/:campaignId/party-currency", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    res.json(readPartyCurrency(db, campaignId));
  });

  // PATCH party currency (merge — only provided keys are updated)
  app.patch("/api/campaigns/:campaignId/party-currency", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const patch = parseBody(CurrencyPatchBody, req);
    const current = readPartyCurrency(db, campaignId);
    const next: PartyCurrencyMap = { ...current, ...patch } as PartyCurrencyMap;
    db.prepare("UPDATE campaigns SET party_currency_json = ? WHERE id = ?")
      .run(JSON.stringify(next), campaignId);
    ctx.broadcast("partyCurrency:delta", { campaignId });
    res.json(next);
  });
}
