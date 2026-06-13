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

const TreasureAwardBody = z.object({
  playerId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
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
  const isListView = (value: unknown): boolean => {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "list" || raw === "summary" || raw === "compact";
  };
  const emitTreasureChange = (args: {
    campaignId: string;
    adventureId?: string | null;
    action: "upsert" | "delete" | "refresh";
    treasureId?: string;
    treasure?: ReturnType<typeof toTreasureDto>;
  }) => {
    ctx.broadcast("treasure:delta", {
      campaignId: args.campaignId,
      adventureId: args.adventureId ?? null,
      action: args.action,
      ...(args.treasureId ? { treasureId: args.treasureId } : {}),
      ...(args.treasure ? { treasure: args.treasure } : {}),
    });
  };

  function serializeTreasureState(entry: StoredTreasureState) {
    return JSON.stringify(entry);
  }

  function hydrateTreasureEntry(entry: ReturnType<typeof rowToTreasure>) {
    if (!entry.itemId) return entry;
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
    const hasPlaceholderName = !String(entry.name ?? "").trim() || entry.name === "New Item";
    return {
      ...entry,
      // Legacy rows may have source mismatches; if itemId resolves, prefer real compendium metadata.
      source: entry.source === "compendium" ? entry.source : (hasPlaceholderName ? "compendium" : entry.source),
      name: hasPlaceholderName ? String(itemRow.name ?? "").trim() || entry.name : entry.name,
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
    const treasure = rows.map(rowToTreasure).map(hydrateTreasureEntry);
    if (isListView(req.query.view)) {
      return res.json(treasure.map((entry) => ({
        id: entry.id,
        campaignId: entry.campaignId,
        adventureId: null as string | null,
        itemId: entry.itemId,
        name: entry.name,
        qty: entry.qty,
        rarity: entry.rarity,
        type: entry.type,
        attunement: entry.attunement,
        magic: entry.magic,
        sort: entry.sort,
        updatedAt: entry.updatedAt,
      })));
    }
    res.json(treasure.map(toTreasureDto));
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
    const treasure = rows.map(rowToTreasure).map(hydrateTreasureEntry);
    if (isListView(req.query.view)) {
      return res.json(treasure.map((entry) => ({
        id: entry.id,
        campaignId: entry.campaignId,
        adventureId: entry.adventureId,
        itemId: entry.itemId,
        name: entry.name,
        qty: entry.qty,
        rarity: entry.rarity,
        type: entry.type,
        attunement: entry.attunement,
        magic: entry.magic,
        sort: entry.sort,
        updatedAt: entry.updatedAt,
      })));
    }
    res.json(treasure.map(toTreasureDto));
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
    db.prepare(
      "UPDATE treasure SET source = ?, item_id = ?, name = ?, rarity = ?, type = ?, type_key = ?, attunement = ?, magic = ?, text = ?, qty = ?, entry_json = ?, updated_at = ? WHERE id = ?",
    ).run(
      treasure.source,
      treasure.itemId,
      treasure.name,
      treasure.rarity,
      treasure.type,
      treasure.type_key,
      treasure.attunement ? 1 : 0,
      treasure.magic ? 1 : 0,
      treasure.text,
      qty,
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
      treasureId,
    );
    const updatedRow = db
      .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
      .get(treasureId) as Record<string, unknown>;
    const dto = toTreasureDto(hydrateTreasureEntry(rowToTreasure(updatedRow)));
    emitTreasureChange({
      campaignId: treasure.campaignId,
      adventureId: treasure.adventureId ?? null,
      action: "upsert",
      treasureId,
      treasure: dto,
    });
    res.json(dto);
  });

  app.post("/api/treasure/:treasureId/award", dmOrAdmin(db), (req, res) => {
    const treasureId = requireParam(req, res, "treasureId");
    if (!treasureId) return;
    const { playerId, quantity } = parseBody(TreasureAwardBody, req);

    const result = db.transaction(() => {
      const treasureRow = db
        .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
        .get(treasureId) as Record<string, unknown> | undefined;
      if (!treasureRow) return { error: { status: 404, message: "Treasure not found" } } as const;

      const treasure = hydrateTreasureEntry(rowToTreasure(treasureRow));
      if (quantity > treasure.qty) {
        return { error: { status: 400, message: `Only ${treasure.qty} available` } } as const;
      }

      const player = db
        .prepare("SELECT campaign_id, character_id FROM players WHERE id = ?")
        .get(playerId) as { campaign_id: string; character_id: string | null } | undefined;
      if (!player || player.campaign_id !== treasure.campaignId) {
        return { error: { status: 404, message: "Player not found in this campaign" } } as const;
      }
      if (!player.character_id) {
        return { error: { status: 400, message: "This player has no linked character sheet" } } as const;
      }

      const characterRow = db
        .prepare("SELECT character_data_json FROM user_characters WHERE id = ?")
        .get(player.character_id) as { character_data_json: string | null } | undefined;
      if (!characterRow) {
        return { error: { status: 404, message: "Linked character sheet not found" } } as const;
      }

      let characterData: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(characterRow.character_data_json ?? "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          characterData = parsed as Record<string, unknown>;
        }
      } catch {
        characterData = {};
      }
      const inventory = Array.isArray(characterData.inventory)
        ? [...characterData.inventory]
        : [];

      let itemDetail: Record<string, unknown> = {};
      if (treasure.itemId) {
        const itemRow = db
          .prepare("SELECT equippable, weight, value, proficiency, data_json FROM compendium_items WHERE id = ?")
          .get(treasure.itemId) as {
            equippable: number;
            weight: number | null;
            value: number | null;
            proficiency: string | null;
            data_json: string;
          } | undefined;
        if (itemRow) {
          try {
            const data = JSON.parse(itemRow.data_json ?? "{}") as Record<string, unknown>;
            itemDetail = {
              equippable: Boolean(itemRow.equippable),
              weight: itemRow.weight ?? data.weight ?? null,
              value: itemRow.value ?? data.value ?? null,
              proficiency: itemRow.proficiency ?? null,
              ac: data.ac ?? null,
              stealthDisadvantage: Boolean(data.stealthDisadvantage),
              dmg1: data.dmg1 ?? null,
              dmg2: data.dmg2 ?? null,
              dmgType: data.dmgType ?? null,
              properties: Array.isArray(data.properties) ? data.properties : [],
            };
          } catch {
            itemDetail = {};
          }
        }
      }

      const inventoryItem = {
        id: uid(),
        name: treasure.name,
        quantity,
        equipped: false,
        equipState: "backpack",
        source: treasure.source,
        ...(treasure.itemId ? { itemId: treasure.itemId } : {}),
        rarity: treasure.rarity,
        type: treasure.type,
        attunement: treasure.attunement,
        attuned: false,
        magic: treasure.magic,
        silvered: false,
        description: treasure.text || undefined,
        ...itemDetail,
      };
      inventory.push(inventoryItem);

      const t = now();
      db.prepare("UPDATE user_characters SET character_data_json = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify({ ...characterData, inventory }), t, player.character_id);

      const remaining = treasure.qty - quantity;
      if (remaining === 0) {
        db.prepare("DELETE FROM treasure WHERE id = ?").run(treasureId);
        return { treasure, characterId: player.character_id, remaining, treasureDto: null } as const;
      }

      db.prepare(
        "UPDATE treasure SET qty = ?, entry_json = ?, updated_at = ? WHERE id = ?",
      ).run(
        remaining,
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
          qty: remaining,
        }),
        t,
        treasureId,
      );
      const updatedRow = db
        .prepare(`SELECT ${TREASURE_COLS} FROM treasure WHERE id = ?`)
        .get(treasureId) as Record<string, unknown>;
      return {
        treasure,
        characterId: player.character_id,
        remaining,
        treasureDto: toTreasureDto(hydrateTreasureEntry(rowToTreasure(updatedRow))),
      } as const;
    })();

    if ("error" in result) {
      return res.status(result.error.status).json({ ok: false, message: result.error.message });
    }

    emitTreasureChange({
      campaignId: result.treasure.campaignId,
      adventureId: result.treasure.adventureId ?? null,
      action: result.remaining === 0 ? "delete" : "upsert",
      treasureId,
      ...(result.treasureDto ? { treasure: result.treasureDto } : {}),
    });
    ctx.broadcast("players:delta", {
      campaignId: result.treasure.campaignId,
      action: "upsert",
      playerId,
      characterId: result.characterId,
    });
    res.json({ ok: true, remaining: result.remaining });
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
    const dto = toTreasureDto(hydrateTreasureEntry(out.entry));
    emitTreasureChange({
      campaignId,
      adventureId: null,
      action: "upsert",
      treasureId: out.entry.id,
      treasure: dto,
    });
    res.json(dto);
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
    const dto = toTreasureDto(hydrateTreasureEntry(out.entry));
    emitTreasureChange({
      campaignId: aRow.campaign_id,
      adventureId,
      action: "upsert",
      treasureId: out.entry.id,
      treasure: dto,
    });
    res.json(dto);
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
        (id, campaign_id, adventure_id, source, item_id, name, rarity, type, type_key, attunement, magic, text, qty, entry_json, sort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      adventureId ?? null,
      entry.source,
      entry.itemId,
      entry.name,
      entry.rarity,
      entry.type,
      entry.type_key,
      entry.attunement ? 1 : 0,
      entry.magic ? 1 : 0,
      entry.text,
      entry.qty,
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
