// server/src/routes/compendium/items.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { parseBody } from "../../lib/validate.js";
import { parseStoredGrandEntry, parseStoredPresentationEntry } from "../../services/compendium/storedCompendium.js";
import { grandEntryId, saveGrandEntry } from "../../services/compendium/grandEditor.js";
import { normalizeLookupName, parseRulesetFilter } from "./helpers.js";
import { z } from "zod";
import { errorMessage } from "../../lib/errors.js";

export function registerItemRoutes(app: Express, ctx: ServerContext, anyDm: RequestHandler) {
  const { db } = ctx;
  const MAX_ITEMS_LIMIT = 250;
  const MAX_ITEM_LOOKUP_NAMES = 250;

  const ItemLookupBody = z.object({
    ruleset: z.enum(["5e", "5.5e"]).optional(),
    ids: z.array(z.string()).max(MAX_ITEM_LOOKUP_NAMES).optional(),
    names: z.array(z.string()).max(MAX_ITEM_LOOKUP_NAMES).optional(),
    includeCommonMagic: z.boolean().optional(),
    includeWondrousRarities: z.array(z.string()).max(10).optional(),
    includeText: z.boolean().optional(),
  });

  const selectItemByExact = db.prepare(
    "SELECT id, ruleset, name, rarity, type, type_key, attunement, magic, data_json FROM compendium_items WHERE name_key = ? AND (? IS NULL OR ruleset = ?) ORDER BY CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END, name_key ASC LIMIT 1",
  );
  const selectItemByPrefix = db.prepare(
    "SELECT id, ruleset, name, rarity, type, type_key, attunement, magic, data_json FROM compendium_items WHERE name_key LIKE ? AND (? IS NULL OR ruleset = ?) ORDER BY LENGTH(name_key) ASC, CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END, name_key ASC LIMIT 1",
  );
  const selectItemByContains = db.prepare(
    "SELECT id, ruleset, name, rarity, type, type_key, attunement, magic, data_json FROM compendium_items WHERE name_key LIKE ? AND (? IS NULL OR ruleset = ?) ORDER BY LENGTH(name_key) ASC, CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END, name_key ASC LIMIT 1",
  );

  function mapLookupRow(row: {
    id: string;
    ruleset?: "5e" | "5.5e";
    name: string;
    rarity: string | null;
    type: string | null;
    type_key: string | null;
    attunement: number;
    magic: number;
    data_json: string | null;
  }) {
    let data: {
      ruleset?: "5e" | "5.5e";
      equippable?: boolean;
      weight?: number | null;
      value?: number | null;
      proficiency?: string | null;
      ac?: number | null;
      stealthDisadvantage?: boolean;
      dmg1?: string | null;
      dmg2?: string | null;
      dmgType?: string | null;
      properties?: string[];
      mastery?: string | null;
      modifiers?: Array<{ category?: string; text?: string }>;
      uses?: unknown;
      spells?: unknown;
      spellcasting?: unknown;
      spellTemplate?: unknown;
      ammo?: string | null;
      usage?: string | null;
      weaponAmmo?: string | null;
      bundle?: unknown;
      container?: boolean;
      ignoreWeight?: boolean;
      effects?: unknown[] | null;
    } = {};
    data = parseStoredPresentationEntry("items", row.data_json) as typeof data;
    return {
      id: row.id,
      ruleset: data.ruleset ?? row.ruleset,
      name: row.name,
      rarity: row.rarity ?? null,
      type: row.type ?? null,
      typeKey: row.type_key ?? null,
      attunement: Boolean(row.attunement),
      magic: Boolean(row.magic),
      // Read from the stored entry: these are display values, never filtered on, so they have no columns.
      equippable: data.equippable === true,
      weight: data.weight ?? null,
      value: data.value ?? null,
      proficiency: data.proficiency ?? null,
      ac: data.ac ?? null,
      stealthDisadvantage: Boolean(data.stealthDisadvantage),
      dmg1: data.dmg1 ?? null,
      dmg2: data.dmg2 ?? null,
      dmgType: data.dmgType ?? null,
      properties: Array.isArray(data.properties) ? data.properties : [],
      mastery: data.mastery ?? null,
      modifiers: Array.isArray(data.modifiers) ? data.modifiers : [],
      uses: data.uses ?? null,
      spells: data.spells ?? null,
      spellcasting: data.spellcasting ?? null,
      spellTemplate: data.spellTemplate ?? null,
      ammo: data.ammo ?? null,
      usage: data.usage ?? null,
      weaponAmmo: data.weaponAmmo ?? null,
      bundle: data.bundle ?? null,
      container: data.container === true,
      ignoreWeight: data.ignoreWeight === true,
      effects: Array.isArray(data.effects) ? data.effects : null,
    };
  }

  function lookupItemByName(rawName: string, ruleset?: "5e" | "5.5e"): {
    id: string;
    name: string;
    rarity: string | null;
    type: string | null;
    typeKey: string | null;
    attunement: boolean;
    magic: boolean;
  } | null {
    const normalized = normalizeLookupName(rawName);
    if (!normalized) return null;

    const exact = selectItemByExact.get(normalized, ruleset ?? null, ruleset ?? null) as
      | {
        id: string;
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
        data_json: string | null;
      }
      | undefined;
    if (exact) return mapLookupRow(exact);

    const prefix = selectItemByPrefix.get(`${normalized}%`, ruleset ?? null, ruleset ?? null) as
      | {
        id: string;
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
        data_json: string | null;
      }
      | undefined;
    if (prefix) return mapLookupRow(prefix);

    const contains = selectItemByContains.get(`%${normalized}%`, ruleset ?? null, ruleset ?? null) as
      | {
        id: string;
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
        data_json: string | null;
      }
      | undefined;
    return contains ? mapLookupRow(contains) : null;
  }

  // MARK: - GET /api/compendium/items
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
    // Separate from `magic` rather than making that param tri-state: callers already send magic=0
    // to mean "don't filter on magic at all", so 0 can't be repurposed to mean "mundane only".
    const nonMagicOnlyRaw = String(req.query.nonmagic ?? "").trim().toLowerCase();
    const nonMagicOnly = nonMagicOnlyRaw === "1" || nonMagicOnlyRaw === "true" || nonMagicOnlyRaw === "yes";
    const limitRaw = Number.parseInt(String(req.query.limit ?? "0"), 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_ITEMS_LIMIT) : null;
    const offsetRaw = Number.parseInt(String(req.query.offset ?? "0"), 10);
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
    const withTotalRaw = String(req.query.withTotal ?? "").trim().toLowerCase();
    const withTotal = withTotalRaw === "1" || withTotalRaw === "true" || withTotalRaw === "yes";
    const fieldsParam = String(req.query.fields ?? "").trim();
    const requestedFields = new Set(
      fieldsParam
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );
    const hasRequestedFields = requestedFields.size > 0;
    const includeField = (field: string) => !hasRequestedFields || requestedFields.has(field);
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
    if (nonMagicOnly && !magicOnly) whereParts.push("magic = 0");
    const rulesetFilter = parseRulesetFilter(req.query.ruleset);
    if (rulesetFilter) {
      whereParts.push("ruleset = ?");
      whereParams.push(rulesetFilter);
    }
    const whereSql = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";
    const useCompact = compact && !includeStats;

    if (useCompact) {
      const baseSql = `SELECT id, ruleset, name, rarity, type, type_key, attunement, magic FROM compendium_items${whereSql} ORDER BY name COLLATE NOCASE`;
      const paginatedSql = limit != null ? `${baseSql} LIMIT ${limit} OFFSET ${offset}` : baseSql;
      const rows = db.prepare(paginatedSql).all(...whereParams) as {
        id: string;
        ruleset: "5e" | "5.5e";
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
      }[];
      const mapped = rows.map((r) => ({
          ...(includeField("id") ? { id: r.id } : {}),
          ...(includeField("ruleset") ? { ruleset: r.ruleset } : {}),
          ...(includeField("name") ? { name: r.name } : {}),
          ...(includeField("rarity") ? { rarity: r.rarity ?? null } : {}),
          ...(includeField("type") ? { type: r.type ?? null } : {}),
          ...(includeField("typekey") ? { typeKey: r.type_key ?? null } : {}),
          ...(includeField("attunement") ? { attunement: Boolean(r.attunement) } : {}),
          ...(includeField("magic") ? { magic: Boolean(r.magic) } : {}),
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
      `SELECT id, name, rarity, type, type_key, attunement, magic, data_json ` +
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
      data_json: string;
    }[];
    const mapped = rawRows.map((r) => {
        const data = parseStoredPresentationEntry("items", r.data_json);
        return {
          ...(includeField("id") ? { id: r.id } : {}),
          ...(includeField("ruleset") ? { ruleset: data.ruleset } : {}),
          ...(includeField("name") ? { name: r.name } : {}),
          ...(includeField("rarity") ? { rarity: r.rarity ?? null } : {}),
          ...(includeField("type") ? { type: r.type ?? null } : {}),
          ...(includeField("typekey") ? { typeKey: r.type_key ?? null } : {}),
          ...(includeField("attunement") ? { attunement: Boolean(r.attunement) } : {}),
          ...(includeField("magic") ? { magic: Boolean(r.magic) } : {}),
          ...(includeField("equippable") ? { equippable: data.equippable === true } : {}),
          ...(includeField("weight") ? { weight: data.weight ?? null } : {}),
          ...(includeField("value") ? { value: data.value ?? null } : {}),
          ...(includeField("proficiency") ? { proficiency: data.proficiency ?? null } : {}),
          ...(includeField("ac") ? { ac: data.ac ?? null } : {}),
          ...(includeField("stealthdisadvantage") ? { stealthDisadvantage: Boolean(data.stealthDisadvantage) } : {}),
          ...(includeField("dmg1") ? { dmg1: data.dmg1 ?? null } : {}),
          ...(includeField("dmg2") ? { dmg2: data.dmg2 ?? null } : {}),
          ...(includeField("dmgtype") ? { dmgType: data.dmgType ?? null } : {}),
          ...(includeField("properties") ? { properties: data.properties ?? [] } : {}),
          ...(includeField("modifiers") ? { modifiers: data.modifiers ?? [] } : {}),
          ...(includeField("uses") ? { uses: data.uses ?? null } : {}),
          ...(includeField("spells") ? { spells: data.spells ?? null } : {}),
          ...(includeField("spellcasting") ? { spellcasting: data.spellcasting ?? null } : {}),
          ...(includeField("spelltemplate") ? { spellTemplate: data.spellTemplate ?? null } : {}),
          ...(includeField("ammo") ? { ammo: data.ammo ?? null } : {}),
          ...(includeField("usage") ? { usage: data.usage ?? null } : {}),
          ...(includeField("weaponammo") ? { weaponAmmo: data.weaponAmmo ?? null } : {}),
          ...(includeField("container") ? { container: data.container === true } : {}),
          ...(includeField("ignoreweight") ? { ignoreWeight: data.ignoreWeight === true } : {}),
          ...(includeField("effects") ? { effects: data.effects ?? null } : {}),
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

  // MARK: - GET /api/compendium/items/facets
  app.get("/api/compendium/items/facets", (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const rulesetClause = ruleset ? " AND ruleset = ?" : "";
    const rulesetParams = ruleset ? [ruleset] : [];
    const rarityRows = db
      .prepare(
        `SELECT rarity, COUNT(*) AS count FROM compendium_items WHERE rarity IS NOT NULL AND rarity <> ''${rulesetClause} GROUP BY rarity ORDER BY rarity COLLATE NOCASE`,
      )
      .all(...rulesetParams) as Array<{ rarity: string; count: number }>;
    const typeRows = db
      .prepare(
        `SELECT type, COUNT(*) AS count FROM compendium_items WHERE type IS NOT NULL AND type <> ''${rulesetClause} GROUP BY type ORDER BY type COLLATE NOCASE`,
      )
      .all(...rulesetParams) as Array<{ type: string; count: number }>;
    res.json({
      rarity: rarityRows.map((row) => ({ value: row.rarity, count: row.count })),
      type: typeRows.map((row) => ({ value: row.type, count: row.count })),
    });
  });

  // MARK: - POST /api/compendium/items/lookup
  app.post("/api/compendium/items/lookup", (req, res) => {
    const body = parseBody(ItemLookupBody, req);
    const ruleset = body.ruleset;
    const includeText = Boolean(body.includeText);
    const rows = new Map<string, {
      id: string;
      name: string;
      rarity: string | null;
      type: string | null;
      typeKey: string | null;
      attunement: boolean;
      magic: boolean;
      text?: string[] | null;
    }>();

    const ids = Array.from(new Set((body.ids ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean)));
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      const idRows = db.prepare(
        `SELECT id, ruleset, name, rarity, type, type_key, attunement, magic, data_json
         FROM compendium_items
         WHERE id IN (${placeholders}) AND (? IS NULL OR ruleset = ?)
         ORDER BY CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END`,
      ).all(...ids, ruleset ?? null, ruleset ?? null) as Array<{
        id: string;
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
        data_json: string | null;
      }>;
      idRows.forEach((row) => { if (!rows.has(row.id)) rows.set(row.id, mapLookupRow(row)); });
    }

    const seen = new Set<string>();
    const names = (body.names ?? [])
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean)
      .filter((entry) => {
        const key = normalizeLookupName(entry);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    for (const query of names) {
      const match = lookupItemByName(query, ruleset);
      if (!match) continue;
      rows.set(match.id, match);
    }

    if (body.includeCommonMagic) {
      const commonMagicRows = db.prepare(
        "SELECT id, ruleset, name, rarity, type, type_key, attunement, magic, data_json FROM compendium_items WHERE magic = 1 AND lower(coalesce(rarity, '')) = 'common' AND lower(coalesce(type, '')) NOT LIKE '%potion%' AND lower(coalesce(type, '')) NOT LIKE '%scroll%' AND (? IS NULL OR ruleset = ?) ORDER BY CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END, name COLLATE NOCASE LIMIT ?",
      ).all(ruleset ?? null, ruleset ?? null, MAX_ITEMS_LIMIT) as Array<{
        id: string;
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
        data_json: string | null;
      }>;
      commonMagicRows.forEach((row) => { if (!rows.has(row.id)) rows.set(row.id, mapLookupRow(row)); });
    }

    const wondrousRarities = Array.from(
      new Set(
        (body.includeWondrousRarities ?? [])
          .map((entry) => String(entry ?? "").trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (wondrousRarities.length > 0) {
      const placeholders = wondrousRarities.map(() => "?").join(", ");
      const wondrousRows = db.prepare(
        `SELECT id, ruleset, name, rarity, type, type_key, attunement, magic, data_json
         FROM compendium_items
         WHERE magic = 1
           AND lower(coalesce(rarity, '')) IN (${placeholders})
           AND (
             lower(coalesce(type, '')) LIKE '%wondrous%'
             OR lower(coalesce(type_key, '')) LIKE '%wondrous%'
           )
           AND (? IS NULL OR ruleset = ?)
         ORDER BY CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END, name COLLATE NOCASE
         LIMIT ?`,
      ).all(...wondrousRarities, ruleset ?? null, ruleset ?? null, MAX_ITEMS_LIMIT) as Array<{
        id: string;
        name: string;
        rarity: string | null;
        type: string | null;
        type_key: string | null;
        attunement: number;
        magic: number;
        data_json: string | null;
      }>;
      wondrousRows.forEach((row) => { if (!rows.has(row.id)) rows.set(row.id, mapLookupRow(row)); });
    }

    if (includeText && rows.size > 0) {
      const rowIds = Array.from(rows.keys());
      const placeholders = rowIds.map(() => "?").join(", ");
      const textRows = db.prepare(
        `SELECT id, ruleset, data_json
         FROM compendium_items
         WHERE id IN (${placeholders}) AND (? IS NULL OR ruleset = ?)
         ORDER BY CASE ruleset WHEN '5.5e' THEN 0 ELSE 1 END`,
      ).all(...rowIds, ruleset ?? null, ruleset ?? null) as Array<{ id: string; ruleset: string; data_json: string | null }>;
      const hydrated = new Set<string>();
      for (const textRow of textRows) {
        if (hydrated.has(textRow.id)) continue;
        const base = rows.get(textRow.id);
        if (!base) continue;
        hydrated.add(textRow.id);
        let text: string[] | null = null;
        const parsed = parseStoredPresentationEntry("items", textRow.data_json);
        if (Array.isArray(parsed.text)) {
          text = parsed.text.map((entry) => String(entry ?? "")).filter(Boolean);
        } else if (typeof parsed.text === "string" && parsed.text.trim()) {
          text = [parsed.text.trim()];
        }
        rows.set(textRow.id, {
          ...base,
          text,
        });
      }
    }

    res.json({ rows: Array.from(rows.values()) });
  });

  /** An item as the apps receive it: the stored columns plus the presentation projection. */
  function readItemDetail(itemId: string, ruleset?: "5e" | "5.5e") {
    const row = db
      .prepare(`SELECT id, ruleset, name, name_key, rarity, type, type_key, attunement, magic, data_json FROM compendium_items WHERE id = ?${ruleset ? " AND ruleset = ?" : ""}`)
      .all(...(ruleset ? [itemId, ruleset] : [itemId])) as Record<string, unknown>[];
    if (!ruleset && row.length > 1) return "ambiguous" as const;
    const found = row[0];
    if (!found) return null;
    const it = parseStoredPresentationEntry("items", found.data_json as string);
    return {
      id: found.id, name: found.name, nameKey: found.name_key ?? null,
      ruleset: it.ruleset ?? found.ruleset,
      source: it.source ?? null,
      rarity: found.rarity ?? null, type: found.type ?? null, typeKey: found.type_key ?? null,
      attunement: Boolean(found.attunement), magic: Boolean(found.magic), equippable: it.equippable === true,
      weight: it.weight ?? null,
      value: it.value ?? null,
      proficiency: it.proficiency ?? null,
      ac: it.ac ?? null,
      stealthDisadvantage: Boolean(it.stealthDisadvantage),
      dmg1: it.dmg1 ?? null,
      dmg2: it.dmg2 ?? null,
      dmgType: it.dmgType ?? null,
      properties: it.properties ?? [],
      mastery: it.mastery ?? null,
      modifiers: it.modifiers ?? [],
      uses: it.uses ?? null,
      spells: it.spells ?? null,
      spellcasting: it.spellcasting ?? null,
      spellTemplate: it.spellTemplate ?? null,
      ammo: it.ammo ?? null,
      usage: it.usage ?? null,
      weaponAmmo: it.weaponAmmo ?? null,
      bundle: it.bundle ?? null,
      container: it.container === true,
      ignoreWeight: it.ignoreWeight === true,
      effects: it.effects ?? null,
      text: Array.isArray(it.text) ? it.text : (it.text ? [it.text] : []),
    };
  }

  // MARK: - GET /api/compendium/items/:itemId
  app.get("/api/compendium/items/:itemId", (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const ruleset = parseRulesetFilter(req.query.ruleset);
    if (String(req.query.view ?? "").trim().toLowerCase() === "grand") {
      const rows = db.prepare(`SELECT data_json FROM compendium_items WHERE id = ?${ruleset ? " AND ruleset = ?" : ""}`).all(...(ruleset ? [itemId, ruleset] : [itemId])) as Array<{ data_json: string }>;
      if (!ruleset && rows.length > 1) return res.status(409).json({ ok: false, message: "Item ID exists in multiple rulesets; specify the ruleset." });
      const row = rows[0];
      if (!row) return res.status(404).json({ ok: false, message: "Item not found in compendium" });
      return res.json(parseStoredGrandEntry("items", row.data_json));
    }
    const detail = readItemDetail(itemId, ruleset ?? undefined);
    if (detail === "ambiguous") return res.status(409).json({ ok: false, message: "Item ID exists in multiple rulesets; specify the ruleset." });
    if (!detail) return res.status(404).json({ ok: false, message: "Item not found in compendium" });
    res.json(detail);
  });

  // MARK: - POST /api/compendium/items/preview
  //
  // A player's homebrew item. The item editor is the same one the DM uses, but a player's item
  // belongs in their own inventory, not in the compendium everyone browses. So this runs the real
  // save - the same validation and the same projection a compendium item gets - inside a
  // transaction, reads the result back exactly as GET does, and rolls it all back. The player gets
  // an item indistinguishable from a compendium one, weapon damage and all, and nothing is written.
  app.post("/api/compendium/items/preview", (req, res) => {
    const previewId = `preview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const discard = Symbol("discard");
    let detail: ReturnType<typeof readItemDetail> = null;
    try {
      db.transaction(() => {
        saveGrandEntry(db, "items", req.body, previewId);
        detail = readItemDetail(previewId);
        throw discard;
      })();
    } catch (error) {
      if (error !== discard) throw error;
    }
    if (!detail) return res.status(400).json({ ok: false, message: "That item could not be built." });
    // The id only existed inside the rolled-back transaction; it belongs to nothing.
    const { id: _discarded, ...item } = detail as Record<string, unknown>;
    res.json(item);
  });

  // MARK: - POST /api/compendium/items
  app.post("/api/compendium/items", anyDm, (req, res) => {
    try {
      const id = grandEntryId("i", (req.body as Record<string, unknown> | undefined)?.name);
      saveGrandEntry(db, "items", req.body, id);
      ctx.broadcast("compendium:changed", { itemCreated: id });
      res.json({ ok: true, id });
    } catch (error) {
      res.status(400).json({ ok: false, message: errorMessage(error, "Item could not be saved.") });
    }
  });

  // MARK: - PUT /api/compendium/items/:itemId
  app.put("/api/compendium/items/:itemId", anyDm, (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const bodyRuleset = parseRulesetFilter((req.body as Record<string, unknown> | undefined)?.ruleset);
    const existing = bodyRuleset ? db.prepare("SELECT id FROM compendium_items WHERE id = ? AND ruleset = ?").get(itemId, bodyRuleset) : undefined;
    if (!existing)
      return res.status(404).json({ ok: false, message: "Item not found" });
    try {
      saveGrandEntry(db, "items", req.body, itemId);
      ctx.broadcast("compendium:changed", { itemUpdated: itemId });
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ ok: false, message: errorMessage(error, "Item could not be saved.") });
    }
  });

  // MARK: - DELETE /api/compendium/items/:itemId
  app.delete("/api/compendium/items/:itemId", anyDm, (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const matches = db.prepare("SELECT ruleset FROM compendium_items WHERE id = ?").all(itemId) as Array<{ ruleset: string }>;
    if (!ruleset && matches.length > 1) return res.status(409).json({ ok: false, message: "Item ID exists in multiple rulesets; specify the ruleset to delete." });
    if (ruleset) db.prepare("DELETE FROM compendium_items WHERE id = ? AND ruleset = ?").run(itemId, ruleset);
    else db.prepare("DELETE FROM compendium_items WHERE id = ?").run(itemId);
    ctx.broadcast("compendium:changed", { itemDeleted: itemId });
    res.json({ ok: true });
  });
}
