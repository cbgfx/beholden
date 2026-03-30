// server/src/routes/compendium/items.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../shared/validate.js";
import { ItemBody, buildItemRecord, baseItemName } from "./helpers.js";

export function registerItemRoutes(app: Express, ctx: ServerContext, anyDm: RequestHandler) {
  const { db } = ctx;

  app.get("/api/compendium/items", (_req, res) => {
    const rawRows = db
      .prepare("SELECT id, name, rarity, type, type_key, attunement, magic, data_json FROM compendium_items ORDER BY name COLLATE NOCASE")
      .all() as { id: string; name: string; rarity: string | null; type: string | null; type_key: string | null; attunement: number; magic: number; data_json: string; }[];
    const rarityByBaseName = new Map<string, string>();
    for (const row of rawRows) {
      const bn = baseItemName(row.name);
      if (row.rarity && bn) rarityByBaseName.set(bn, row.rarity);
    }
    res.json(rawRows.map((r) => {
      const bn = baseItemName(r.name);
      const data = JSON.parse(r.data_json ?? "{}");
      return {
        id: r.id, name: r.name,
        rarity: r.rarity ?? (bn ? rarityByBaseName.get(bn) ?? null : null),
        type: r.type ?? null, typeKey: r.type_key ?? null,
        attunement: Boolean(r.attunement), magic: Boolean(r.magic),
        weight: data.weight ?? null,
        value: data.value ?? null,
        ac: data.ac ?? null,
        stealthDisadvantage: Boolean(data.stealthDisadvantage),
        dmg1: data.dmg1 ?? null,
        dmg2: data.dmg2 ?? null,
        dmgType: data.dmgType ?? null,
        properties: data.properties ?? [],
      };
    }));
  });

  app.get("/api/compendium/items/:itemId", (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const row = db
      .prepare("SELECT id, name, name_key, rarity, type, type_key, attunement, magic, data_json FROM compendium_items WHERE id = ?")
      .get(itemId) as Record<string, unknown> | undefined;
    if (!row)
      return res.status(404).json({ ok: false, message: "Item not found in compendium" });
    const it = JSON.parse(row.data_json as string);
    const rowBaseName = baseItemName(String(row.name));
    const fallbackRarity = row.rarity == null && rowBaseName
      ? ((db.prepare("SELECT rarity FROM compendium_items WHERE name = ?").get(rowBaseName) as { rarity: string | null } | undefined)?.rarity ?? null)
      : null;
    res.json({
      id: row.id, name: row.name, nameKey: row.name_key ?? null,
      rarity: row.rarity ?? fallbackRarity, type: row.type ?? null, typeKey: row.type_key ?? null,
      attunement: Boolean(row.attunement), magic: Boolean(row.magic),
      weight: it.weight ?? null,
      value: it.value ?? null,
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
    db.prepare("INSERT OR REPLACE INTO compendium_items (id, name, name_key, rarity, type, type_key, attunement, magic, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, JSON.stringify(data));
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
    db.prepare("UPDATE compendium_items SET name = ?, name_key = ?, rarity = ?, type = ?, type_key = ?, attunement = ?, magic = ?, data_json = ? WHERE id = ?")
      .run(name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, JSON.stringify(data), itemId);
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
