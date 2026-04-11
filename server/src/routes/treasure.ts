import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { rowToTreasure, nextSortFor, TREASURE_COLS } from "../lib/db.js";
import { toTreasureDto } from "../lib/apiCollections.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import type { StoredTreasureState } from "../server/userData.js";

const TreasureQtyBody = z.object({
  qty: z.number().int().min(1),
});

const TreasureCreateBody = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("compendium"),
    itemId: z.string(),
    qty: z.number().int().min(1).optional(),
  }),
  z.object({
    source: z.literal("custom"),
    qty: z.number().int().min(1).optional(),
    custom: z.object({
      name: z.string().trim().min(1),
      rarity: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      attunement: z.boolean().optional(),
      magic: z.boolean().optional(),
      text: z.string().optional(),
    }).optional(),
  }),
]);

export function registerTreasureRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now, normalizeKey } = ctx.helpers;
  const emitTreasureChange = (args: {
    campaignId: string;
    adventureId?: string | null;
    action: "upsert" | "delete" | "refresh";
    treasureId?: string;
  }) => {
    ctx.broadcast("treasure:changed", { campaignId: args.campaignId });
    ctx.broadcast("treasure:delta", {
      campaignId: args.campaignId,
      adventureId: args.adventureId ?? null,
      action: args.action,
      ...(args.treasureId ? { treasureId: args.treasureId } : {}),
    });
  };

  function serializeTreasureState(entry: StoredTreasureState) {
    return JSON.stringify(entry);
  }

  function hydrateTreasureEntry(entry: ReturnType<typeof rowToTreasure>) {
    if (entry.source !== "compendium" || !entry.itemId) return entry;
    const itemRow = db
      .prepare("SELECT name, rarity, type, type_key, attunement, magic, data_json FROM compendium_items WHERE id = ?")
      .get(entry.itemId) as
        | {
            name: string;
            rarity: string | null;
            type: string | null;
            type_key: string | null;
            attunement: number;
            magic: number;
            data_json: string;
          }
        | undefined;
    if (!itemRow) return entry;
    const itemData = JSON.parse(itemRow.data_json ?? "{}");
    const itemText = Array.isArray(itemData.text) ? itemData.text.join("\n\n") : (itemData.text ?? "");
    return {
      ...entry,
      name: entry.name === "New Item" ? String(itemRow.name ?? "").trim() || entry.name : entry.name,
      rarity: itemRow.rarity ?? entry.rarity,
      type: itemRow.type ?? entry.type,
      type_key: itemRow.type_key ?? entry.type_key,
      attunement: Boolean(itemRow.attunement),
      magic: Boolean(itemRow.magic),
      text: entry.text || String(itemText ?? ""),
    };
  }

  app.get("/api/campaigns/:campaignId/treasure", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const c = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!c) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const rows = db
      .prepare(
        `SELECT ${TREASURE_COLS} FROM treasure WHERE campaign_id = ? AND adventure_id IS NULL ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToTreasure).map(hydrateTreasureEntry).map(toTreasureDto));
  });

  app.get("/api/adventures/:adventureId/treasure", memberOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const a = db.prepare("SELECT id FROM adventures WHERE id = ?").get(adventureId);
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const rows = db
      .prepare(
        `SELECT ${TREASURE_COLS} FROM treasure WHERE adventure_id = ? ORDER BY COALESCE(sort, 9999) ASC, updated_at DESC`
      )
      .all(adventureId) as Record<string, unknown>[];
    res.json(rows.map(rowToTreasure).map(hydrateTreasureEntry).map(toTreasureDto));
  });

  app.get("/api/treasure/:treasureId", memberOrAdmin(db), (req, res) => {
    const treasureId = requireParam(req, res, "treasureId");
    if (!treasureId) return;
    const row = db
      .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
      .get(treasureId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Treasure not found" });
    res.json(toTreasureDto(hydrateTreasureEntry(rowToTreasure(row))));
  });

  app.patch("/api/treasure/:treasureId/qty", dmOrAdmin(db), (req, res) => {
    const treasureId = requireParam(req, res, "treasureId");
    if (!treasureId) return;
    const row = db
      .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
      .get(treasureId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Treasure not found" });
    const { qty } = parseBody(TreasureQtyBody, req);
    const treasure = hydrateTreasureEntry(rowToTreasure(row));
    const t = now();
    db.prepare("UPDATE treasure SET entry_json = ?, updated_at = ? WHERE id = ?").run(
      serializeTreasureState({
        source: treasure.source,
        itemId: treasure.itemId,
        name: treasure.name,
        rarity: treasure.rarity,
        type: treasure.type,
        type_key: treasure.type_key,
        attunement: treasure.attunement,
        magic: treasure.magic,
        text: treasure.text,
        qty,
      }),
      t,
      treasureId
    );
    emitTreasureChange({
      campaignId: treasure.campaignId,
      adventureId: treasure.adventureId ?? null,
      action: "upsert",
      treasureId,
    });
    const updatedRow = db
      .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
      .get(treasureId) as Record<string, unknown>;
    res.json(toTreasureDto(hydrateTreasureEntry(rowToTreasure(updatedRow))));
  });

  app.post("/api/campaigns/:campaignId/treasure", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const c = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(campaignId);
    if (!c) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const b = parseBody(TreasureCreateBody, req);
    const out = createTreasureEntry({
      campaignId, adventureId: null,
      source: b.source,
      itemId: b.source === "compendium" ? b.itemId : undefined,
      custom: b.source === "custom" ? b.custom : undefined,
      qty: b.qty,
    });
    if (out.error) return res.status(out.error.status).json({ ok: false, message: out.error.message });
    emitTreasureChange({
      campaignId,
      adventureId: null,
      action: "upsert",
      treasureId: out.entry.id,
    });
    res.json(toTreasureDto(hydrateTreasureEntry(out.entry)));
  });

  app.post("/api/adventures/:adventureId/treasure", dmOrAdmin(db), (req, res) => {
    const adventureId = requireParam(req, res, "adventureId");
    if (!adventureId) return;
    const aRow = db
      .prepare("SELECT campaign_id FROM adventures WHERE id = ?")
      .get(adventureId) as { campaign_id: string } | undefined;
    if (!aRow) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const b = parseBody(TreasureCreateBody, req);
    const out = createTreasureEntry({
      campaignId: aRow.campaign_id, adventureId,
      source: b.source,
      itemId: b.source === "compendium" ? b.itemId : undefined,
      custom: b.source === "custom" ? b.custom : undefined,
      qty: b.qty,
    });
    if (out.error) return res.status(out.error.status).json({ ok: false, message: out.error.message });
    emitTreasureChange({
      campaignId: aRow.campaign_id,
      adventureId,
      action: "upsert",
      treasureId: out.entry.id,
    });
    res.json(toTreasureDto(hydrateTreasureEntry(out.entry)));
  });

  app.delete("/api/treasure/:treasureId", dmOrAdmin(db), (req, res) => {
    const treasureId = requireParam(req, res, "treasureId");
    if (!treasureId) return;
    const row = db
      .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
      .get(treasureId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Treasure not found" });
    const t = rowToTreasure(row);
    db.prepare("DELETE FROM treasure WHERE id = ?").run(treasureId);
    emitTreasureChange({
      campaignId: t.campaignId,
      adventureId: t.adventureId ?? null,
      action: "delete",
      treasureId,
    });
    res.json({ ok: true });
  });

  type TreasureResult =
    | { entry: ReturnType<typeof rowToTreasure>; error?: never }
    | { error: { status: number; message: string }; entry?: never };

  function createTreasureEntry({
    campaignId,
    adventureId,
    source,
    itemId,
    custom,
    qty: qtyRaw,
  }: {
    campaignId: string;
    adventureId?: string | null;
    source: "compendium" | "custom";
    itemId?: unknown;
    custom?: unknown;
    qty?: unknown;
  }): TreasureResult {
    const qty = Math.max(1, Math.round(Number(qtyRaw ?? 1))) || 1;
    const id = uid();
    const t = now();

    let entry: StoredTreasureState = {
      source,
      itemId: itemId != null ? String(itemId) : null,
      name: "New Item",
      rarity: null,
      type: null,
      type_key: null,
      attunement: false,
      magic: false,
      text: "",
      qty,
    };

    if (source === "compendium") {
      const itRow = db
        .prepare("SELECT name, data_json FROM compendium_items WHERE id = ?")
        .get(String(itemId ?? "")) as { name: string; data_json: string } | undefined;
      if (!itRow)
        return { error: { status: 404, message: "Item not found in compendium" } };
      const it = JSON.parse(itRow.data_json);
      entry = {
        source,
        itemId: String(itemId ?? ""),
        name: String(itRow.name ?? "").trim() || "New Item",
        rarity: it.rarity ?? null,
        type: it.type ?? null,
        type_key: it.typeKey ?? it.type_key ?? null,
        attunement: Boolean(it.attunement),
        magic: Boolean(it.magic),
        text: Array.isArray(it.text) ? it.text.join("\n\n") : (it.text ?? ""),
        qty,
      };
    } else {
      const c = (custom as Record<string, unknown>) ?? {};
      const type = c.type != null ? String(c.type).trim() : null;
      entry = {
        source,
        itemId: null,
        name: String(c.name ?? "New Item").trim() || "New Item",
        rarity: c.rarity != null ? String(c.rarity).trim() : null,
        type,
        type_key: type ? normalizeKey(type) : null,
        attunement: Boolean(c.attunement),
        magic: Boolean(c.magic),
        text: c.text != null ? String(c.text) : "",
        qty,
      };
    }

    const sort = adventureId
      ? nextSortFor(db, "treasure", "adventure_id", adventureId)
      : nextSortFor(db, "treasure", "campaign_id", campaignId);

    db.prepare(`
      INSERT INTO treasure
        (id, campaign_id, adventure_id, entry_json, sort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      adventureId ?? null,
      serializeTreasureState(entry),
      sort,
      t,
      t
    );

    const createdEntry = rowToTreasure(
      db.prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`).get(id) as Record<string, unknown>
    );
    return { entry: createdEntry };
  }
}
