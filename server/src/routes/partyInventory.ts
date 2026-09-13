import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { parseBody } from "../lib/validate.js";
import { requireParam } from "../lib/routeHelpers.js";
import { PARTY_INVENTORY_COLS, rowToPartyInventoryItem, type Db } from "../lib/db.js";
import { toPartyInventoryItemDto } from "../lib/apiCollections.js";
import { memberOrAdmin } from "../middleware/campaignAuth.js";
import { getAssignedPlayers } from "../services/characters.js";
import { inventoryRevOf } from "./characters/helpers.js";

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
  // Full portable item state for transfers. Opaque to the server (the player
  // client owns the shape); only bounded so a hostile payload can't bloat the row.
  payload: z.record(z.string(), z.unknown())
    .refine((value) => JSON.stringify(value).length <= 32_000, "Item payload too large")
    .nullish(),
});

const payloadJson = (payload: Record<string, unknown> | null | undefined): string | null =>
  payload ? JSON.stringify(payload) : null;

const QuantityBody = z.object({ quantity: z.number().int().min(1) });

// Atomic character <-> party-stash transfer. The client sends the character's
// already-computed next inventory alongside the matching party-stash mutation;
// the server applies both in a single transaction so the item can never be
// duplicated (withdraw) or destroyed (deposit) by a half-completed transfer.
const TransferBody = z.object({
  characterId: z.string().min(1),
  expectedInventoryRev: z.string().min(1).max(64),
  // Opaque inventory/container arrays owned by the player client. Bounds keep a
  // malformed or hostile payload from bloating the stored sheet.
  inventory: z.array(z.record(z.string(), z.unknown())).max(5000),
  inventoryContainers: z.array(z.record(z.string(), z.unknown())).max(500),
  stash: z.discriminatedUnion("action", [
    // Deposit into an empty stash slot (or a non-stackable item).
    z.object({ action: z.literal("create"), item: ItemBody }),
    // Deposit that merges into an existing stack: `quantity` is the final total.
    z.object({
      action: z.literal("setQuantity"),
      itemId: z.string().min(1),
      quantity: z.number().int().min(1),
      expectedQuantity: z.number().int().min(1),
      expectedStashRev: z.string().length(64),
    }),
    // Withdraw: the whole stash row moves onto the character.
    z.object({ action: z.literal("delete"), itemId: z.string().min(1), expectedQuantity: z.number().int().min(1), expectedStashRev: z.string().length(64) }),
  ]),
});

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

  // MARK: - GET /api/campaigns/:campaignId/party-inventory
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

  // MARK: - GET /api/campaigns/:campaignId/party-inventory/:itemId
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

  // MARK: - POST /api/campaigns/:campaignId/party-inventory
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
       (id, campaign_id, name, quantity, weight, notes, source, item_id, rarity, type, description, payload_json, sort, created_at, updated_at)
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
      payloadJson(body.payload),
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

  // MARK: - PUT /api/campaigns/:campaignId/party-inventory/:itemId
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
    // An edit that doesn't mention `payload` leaves the stored transfer payload
    // in place; an explicit `null` clears it.
    const nextPayload = body.payload === undefined
      ? ((existing.payload_json as string | null) ?? null)
      : payloadJson(body.payload);
    db.prepare(
      `UPDATE party_inventory SET
         name=?, quantity=?, weight=?, notes=?, source=?, item_id=?, rarity=?, type=?, description=?, payload_json=?, updated_at=?
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
      nextPayload,
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

  // MARK: - PATCH /api/campaigns/:campaignId/party-inventory/:itemId/quantity
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

  // MARK: - DELETE /api/campaigns/:campaignId/party-inventory/:itemId
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

  // Atomic transfer of one item between a character sheet and the party stash.

  // MARK: - POST /api/campaigns/:campaignId/party-inventory/transfer
  app.post("/api/campaigns/:campaignId/party-inventory/transfer", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const userId = req.user!.userId;
    const body = parseBody(TransferBody, req);

    // The caller may only rewrite a character sheet they own...
    const charRow = db
      .prepare("SELECT character_data_json FROM user_characters WHERE id = ? AND user_id = ?")
      .get(body.characterId, userId) as { character_data_json: string | null } | undefined;
    if (!charRow) return res.status(404).json({ ok: false, message: "Character not found" });

    // ...and only when that character actually belongs to this campaign, so this
    // endpoint can't double as a generic sheet writer for an unrelated campaign.
    const linked = getAssignedPlayers(db, body.characterId)
      .some((assignment) => assignment.campaign_id === campaignId);
    if (!linked) return res.status(403).json({ ok: false, message: "Character is not in this campaign" });

    const t = now();
    const stashItemId = body.stash.action === "create" ? uid() : body.stash.itemId;

    const conflict = db.transaction(() => {
      // Re-read the sheet inside the transaction and merge only the inventory
      // fields, so a concurrent unrelated sheet save is never clobbered.
      const freshRow = db
        .prepare("SELECT character_data_json FROM user_characters WHERE id = ? AND user_id = ?")
        .get(body.characterId, userId) as { character_data_json: string | null } | undefined;
      const characterData = JSON.parse(freshRow?.character_data_json ?? "{}") as Record<string, unknown>;
      if (!freshRow || inventoryRevOf(characterData) !== body.expectedInventoryRev) {
        return { code: "stale-inventory", message: "Inventory changed; refresh and retry." };
      }
      if (body.stash.action !== "create") {
        const stash = db.prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE id = ? AND campaign_id = ?`)
          .get(body.stash.itemId, campaignId) as Record<string, unknown> | undefined;
        if (!stash || stash.quantity !== body.stash.expectedQuantity || toPartyInventoryItemDto(rowToPartyInventoryItem(stash)).meta.revision !== body.stash.expectedStashRev) {
          return { code: "stale-stash", message: "Party stash item changed; refresh and retry." };
        }
      }
      const nextData = {
        ...characterData,
        inventory: body.inventory,
        inventoryContainers: body.inventoryContainers,
      };
      db.prepare("UPDATE user_characters SET character_data_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
        .run(JSON.stringify(nextData), t, body.characterId, userId);

      if (body.stash.action === "create") {
        const maxSort = (db.prepare(
          "SELECT COALESCE(MAX(sort),0)+1 AS n FROM party_inventory WHERE campaign_id = ?"
        ).get(campaignId) as { n: number }).n;
        db.prepare(
          `INSERT INTO party_inventory
           (id, campaign_id, name, quantity, weight, notes, source, item_id, rarity, type, description, payload_json, sort, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          stashItemId,
          campaignId,
          body.stash.item.name,
          body.stash.item.quantity ?? 1,
          body.stash.item.weight ?? null,
          body.stash.item.notes ?? "",
          body.stash.item.source ?? null,
          body.stash.item.itemId ?? null,
          body.stash.item.rarity ?? null,
          body.stash.item.type ?? null,
          body.stash.item.description ?? null,
          payloadJson(body.stash.item.payload),
          maxSort,
          t,
          t,
        );
      } else if (body.stash.action === "setQuantity") {
        db.prepare("UPDATE party_inventory SET quantity = ?, updated_at = ? WHERE id = ? AND campaign_id = ?")
          .run(body.stash.quantity, t, stashItemId, campaignId);
      } else {
        db.prepare("DELETE FROM party_inventory WHERE id = ? AND campaign_id = ?")
          .run(stashItemId, campaignId);
      }
      return null;
    }).immediate();
    if (conflict) return res.status(409).json({ ok: false, ...conflict });

    const stashAction = body.stash.action === "delete" ? "delete" : "upsert";
    emitPartyInventoryChange({ campaignId, action: stashAction, itemId: stashItemId });
    // Nudge any DM/other client watching this character to re-read the sheet.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, body.characterId)) {
      ctx.broadcast("players:delta", {
        campaignId: campaign_id,
        action: "upsert",
        playerId: player_id,
        characterId: body.characterId,
      });
    }

    const stashItem = body.stash.action === "delete"
      ? null
      : toPartyInventoryItemDto(rowToPartyInventoryItem(
          db.prepare(`SELECT ${PARTY_INVENTORY_COLS} FROM party_inventory WHERE id = ?`).get(stashItemId) as Record<string, unknown>
        ));
    res.json({ ok: true, itemId: stashItemId, stashItem, inventoryRev: inventoryRevOf({ inventory: body.inventory, inventoryContainers: body.inventoryContainers }) });
  });

  // GET party currency

  // MARK: - GET /api/campaigns/:campaignId/party-currency
  app.get("/api/campaigns/:campaignId/party-currency", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    res.json(readPartyCurrency(db, campaignId));
  });

  // PATCH party currency (merge — only provided keys are updated)

  // MARK: - PATCH /api/campaigns/:campaignId/party-currency
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
