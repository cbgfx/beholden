// server/src/routes/compendium/items.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../shared/validate.js";
import { ItemBody, buildItemRecord } from "./helpers.js";

export function registerItemRoutes(app: Express, ctx: ServerContext, anyDm: RequestHandler) {
  const { db } = ctx;

  app.get("/api/compendium/items", (req, res) => {
    const compactRaw = String(req.query.compact ?? "").trim().toLowerCase();
    const compact = compactRaw === "1" || compactRaw === "true" || compactRaw === "yes";
    const includeStatsRaw = String(req.query.includeStats ?? "").trim().toLowerCase();
    const includeStats =
      includeStatsRaw === "1" || includeStatsRaw === "true" || includeStatsRaw === "yes";
    const useCompact = compact && !includeStats;

    if (useCompact) {
      const rows = db
        .prepare(
          "SELECT id, name, rarity, type, type_key, attunement, magic FROM compendium_items ORDER BY name COLLATE NOCASE",
        )
        .all() as {
        id: string;
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
      }[];
      return res.json(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          rarity: r.rarity ?? null,
          type: r.type ?? null,
          typeKey: r.type_key ?? null,
          attunement: Boolean(r.attunement),
          magic: Boolean(r.magic),
        })),
      );
    }

    const rawRows = db
      .prepare(
        "SELECT id, name, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json FROM compendium_items ORDER BY name COLLATE NOCASE",
      )
      .all() as {
      id: string;
      name: string;
      rarity: string | null;
      type: string | null;
      type_key: string | null;
      attunement: number;
      magic: number;
      equippable: number;
      weight: number | null;
      value: number | null;
      proficiency: string | null;
      data_json: string;
    }[];
    return res.json(
      rawRows.map((r) => {
        const data = JSON.parse(r.data_json ?? "{}");
        return {
          id: r.id,
          name: r.name,
          rarity: r.rarity ?? null,
          type: r.type ?? null,
          typeKey: r.type_key ?? null,
          attunement: Boolean(r.attunement),
          magic: Boolean(r.magic),
          equippable: Boolean(r.equippable),
          weight: r.weight ?? data.weight ?? null,
          value: r.value ?? data.value ?? null,
          proficiency: r.proficiency ?? null,
          ac: data.ac ?? null,
          stealthDisadvantage: Boolean(data.stealthDisadvantage),
          dmg1: data.dmg1 ?? null,
          dmg2: data.dmg2 ?? null,
          dmgType: data.dmgType ?? null,
          properties: data.properties ?? [],
        };
      }),
    );
  });

  app.get("/api/compendium/items/:itemId", (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const row = db
      .prepare("SELECT id, name, name_key, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json FROM compendium_items WHERE id = ?")
      .get(itemId) as Record<string, unknown> | undefined;
    if (!row)
      return res.status(404).json({ ok: false, message: "Item not found in compendium" });
    const it = JSON.parse(row.data_json as string);
    res.json({
      id: row.id, name: row.name, nameKey: row.name_key ?? null,
      rarity: row.rarity ?? null, type: row.type ?? null, typeKey: row.type_key ?? null,
      attunement: Boolean(row.attunement), magic: Boolean(row.magic), equippable: Boolean(row.equippable),
      weight: (row.weight as number | null) ?? it.weight ?? null,
      value: (row.value as number | null) ?? it.value ?? null,
      proficiency: (row.proficiency as string | null) ?? null,
      ac: it.ac ?? null,
      stealthDisadvantage: Boolean(it.stealthDisadvantage),
      dmg1: it.dmg1 ?? null,
      dmg2: it.dmg2 ?? null,
      dmgType: it.dmgType ?? null,
      properties: it.properties ?? [],
      modifiers: it.modifiers ?? [],
      text: Array.isArray(it.text) ? it.text : (it.text ? [it.text] : []),
    });
  });

  app.post("/api/compendium/items", anyDm, (req, res) => {
    const b = parseBody(ItemBody, req);
    const id = `i_${b.name.toLowerCase().replace(/\s+/g, "_")}`;
    const { name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, data } = buildItemRecord(id, b);
    db.prepare("INSERT OR REPLACE INTO compendium_items (id, name, name_key, rarity, type, type_key, attunement, magic, weight, value, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, data.weight ?? null, data.value ?? null, JSON.stringify(data));
    ctx.broadcast("compendium:changed", { itemCreated: id });
    res.json({ ok: true, id });
  });

  app.put("/api/compendium/items/:itemId", anyDm, (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    if (!db.prepare("SELECT id FROM compendium_items WHERE id = ?").get(itemId))
      return res.status(404).json({ ok: false, message: "Item not found" });
    const b = parseBody(ItemBody, req);
    const { name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, data } = buildItemRecord(itemId, b);
    db.prepare("UPDATE compendium_items SET name = ?, name_key = ?, rarity = ?, type = ?, type_key = ?, attunement = ?, magic = ?, weight = ?, value = ?, data_json = ? WHERE id = ?")
      .run(name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, data.weight ?? null, data.value ?? null, JSON.stringify(data), itemId);
    ctx.broadcast("compendium:changed", { itemUpdated: itemId });
    res.json({ ok: true });
  });

  app.delete("/api/compendium/items/:itemId", anyDm, (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    db.prepare("DELETE FROM compendium_items WHERE id = ?").run(itemId);
    ctx.broadcast("compendium:changed", { itemDeleted: itemId });
    res.json({ ok: true });
  });
}
