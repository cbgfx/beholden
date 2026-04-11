// server/src/routes/compendium/items.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { parseBody } from "../../shared/validate.js";
import { ItemBody, buildItemRecord } from "./helpers.js";

export function registerItemRoutes(app: Express, ctx: ServerContext, anyDm: RequestHandler) {
  const { db } = ctx;

  app.get("/api/compendium/items", (req, res) => {
    applySharedApiCacheHeaders(res);
    const compactRaw = String(req.query.compact ?? "").trim().toLowerCase();
    const compact = compactRaw === "1" || compactRaw === "true" || compactRaw === "yes";
    const includeStatsRaw = String(req.query.includeStats ?? "").trim().toLowerCase();
    const includeStats =
      includeStatsRaw === "1" || includeStatsRaw === "true" || includeStatsRaw === "yes";
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const rarity = String(req.query.rarity ?? "").trim().toLowerCase();
    const type = String(req.query.type ?? "").trim();
    const attunementOnlyRaw = String(req.query.attunement ?? "").trim().toLowerCase();
    const attunementOnly =
      attunementOnlyRaw === "1" || attunementOnlyRaw === "true" || attunementOnlyRaw === "yes";
    const magicOnlyRaw = String(req.query.magic ?? "").trim().toLowerCase();
    const magicOnly = magicOnlyRaw === "1" || magicOnlyRaw === "true" || magicOnlyRaw === "yes";
    const limitRaw = Number.parseInt(String(req.query.limit ?? "0"), 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : null;
    const offsetRaw = Number.parseInt(String(req.query.offset ?? "0"), 10);
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
    const withTotalRaw = String(req.query.withTotal ?? "").trim().toLowerCase();
    const withTotal = withTotalRaw === "1" || withTotalRaw === "true" || withTotalRaw === "yes";
    const whereParts: string[] = [];
    const whereParams: unknown[] = [];
    if (q) {
      const like = `%${q}%`;
      whereParts.push("(name LIKE ? OR name_key LIKE ?)");
      whereParams.push(like, like);
    }
    if (rarity && rarity !== "all") {
      whereParts.push("rarity = ?");
      whereParams.push(rarity);
    }
    if (type && type.toLowerCase() !== "all") {
      whereParts.push("type = ?");
      whereParams.push(type);
    }
    if (attunementOnly) whereParts.push("attunement = 1");
    if (magicOnly) whereParts.push("magic = 1");
    const whereSql = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";
    const useCompact = compact && !includeStats;

    if (useCompact) {
      const baseSql = `SELECT id, name, rarity, type, type_key, attunement, magic FROM compendium_items${whereSql} ORDER BY name COLLATE NOCASE`;
      const paginatedSql = limit != null ? `${baseSql} LIMIT ${limit} OFFSET ${offset}` : baseSql;
      const rows = db.prepare(paginatedSql).all(...whereParams) as {
        id: string;
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
      }[];
      const mapped = rows.map((r) => ({
          id: r.id,
          name: r.name,
          rarity: r.rarity ?? null,
          type: r.type ?? null,
          typeKey: r.type_key ?? null,
          attunement: Boolean(r.attunement),
          magic: Boolean(r.magic),
        }));
      if (withTotal) {
        const totalRow = db
          .prepare(`SELECT count(*) AS n FROM compendium_items${whereSql}`)
          .get(...whereParams) as { n: number };
        return res.json({ rows: mapped, total: totalRow.n });
      }
      return res.json(mapped);
    }

    const baseSql =
      `SELECT id, name, rarity, type, type_key, attunement, magic, equippable, weight, value, proficiency, data_json ` +
      `FROM compendium_items${whereSql} ORDER BY name COLLATE NOCASE`;
    const paginatedSql = limit != null ? `${baseSql} LIMIT ${limit} OFFSET ${offset}` : baseSql;
    const rawRows = db.prepare(paginatedSql).all(...whereParams) as {
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
    const mapped = rawRows.map((r) => {
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
      });
    if (withTotal) {
      const totalRow = db
        .prepare(`SELECT count(*) AS n FROM compendium_items${whereSql}`)
        .get(...whereParams) as { n: number };
      return res.json({ rows: mapped, total: totalRow.n });
    }
    return res.json(mapped);
  });

  app.get("/api/compendium/items/facets", (_req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const rarityRows = db
      .prepare(
        "SELECT rarity, COUNT(*) AS count FROM compendium_items WHERE rarity IS NOT NULL AND rarity <> '' GROUP BY rarity ORDER BY rarity COLLATE NOCASE",
      )
      .all() as Array<{ rarity: string; count: number }>;
    const typeRows = db
      .prepare(
        "SELECT type, COUNT(*) AS count FROM compendium_items WHERE type IS NOT NULL AND type <> '' GROUP BY type ORDER BY type COLLATE NOCASE",
      )
      .all() as Array<{ type: string; count: number }>;
    res.json({
      rarity: rarityRows.map((row) => ({ value: row.rarity, count: row.count })),
      type: typeRows.map((row) => ({ value: row.type, count: row.count })),
    });
  });

  app.get("/api/compendium/items/:itemId", (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
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
