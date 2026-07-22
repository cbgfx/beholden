// server/src/routes/compendium/lore.ts
// Classes, races, backgrounds, and feats routes.

import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { requireAuth } from "../../middleware/auth.js";
import { parseBody } from "../../shared/validate.js";
import {
  parseStoredGrandEntry,
  parseStoredPresentationEntry,
} from "../../services/compendium/storedCompendium.js";
import { featPrerequisiteLabel } from "../../services/compendium/featCompaction.js";
import { z } from "zod";

export function registerLoreRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const MAX_FEAT_LOOKUP_IDS = 300;
  const FeatLookupBody = z.object({
    ids: z.array(z.string()).max(MAX_FEAT_LOOKUP_IDS),
    ruleset: z.enum(["5e", "5.5e"]).optional(),
  });
  const parseRequestedFields = (value: unknown): Set<string> =>
    new Set(
      String(value ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    );
  const includeField = (fields: Set<string>, ...aliases: string[]) =>
    fields.size === 0 || aliases.some((alias) => fields.has(alias.toLowerCase()));
  const parseRulesetFilter = (value: unknown): "5e" | "5.5e" | null =>
    value === "5e" || value === "5.5e" ? value : null;

  /** Read-time projection: fill each background equipment item entry's display name from the
   * item catalog. Canonical records store only the item ID (one fact, one home) plus an optional
   * `sourceLabel` reserved for text that intentionally differs from the catalog name (display
   * ordering like "Traveler's Clothes", or flavor like "Book (prayers)"). */
  function projectBackgroundEquipmentNames(entry: Record<string, unknown>): Record<string, unknown> {
    const equipment = entry.equipment as { options?: Array<{ entries?: Array<Record<string, unknown>> }> } | undefined;
    const options = equipment?.options;
    if (!Array.isArray(options)) return entry;
    const itemEntries = options.flatMap((option) => (option.entries ?? []).filter(
      (e) => e.kind === "item" && typeof e.itemId === "string" && e.sourceLabel === undefined && e.name === undefined,
    ));
    if (itemEntries.length === 0) return entry;
    const ids = Array.from(new Set(itemEntries.map((e) => String(e.itemId))));
    const placeholders = ids.map(() => "?").join(", ");
    const rows = db.prepare(`SELECT id, name FROM compendium_items WHERE id IN (${placeholders})`).all(...ids) as Array<{ id: string; name: string }>;
    const nameById = new Map(rows.map((row) => [row.id, row.name]));
    for (const e of itemEntries) {
      const name = nameById.get(String(e.itemId));
      if (name) e.name = name;
    }
    return entry;
  }

  const canonicalDetailRoutes = [
    ["classes", "classes", "compendium_classes"],
    ["species", "species", "compendium_races"],
    ["backgrounds", "backgrounds", "compendium_backgrounds"],
    ["feats", "feats", "compendium_feats"],
  ] as const;
  for (const [routeCategory, storedCategory, table] of canonicalDetailRoutes) {
    const canonicalDetail = (req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1]) => {
      applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
      const id = requireParam(req, res, "id");
      if (!id) return;
      // classes/species/backgrounds/feats have a composite PRIMARY KEY (id, ruleset) -- id
      // alone no longer identifies a unique row. Every real caller of this route already has
      // a locked character ruleset in scope (character creator, level-up), so this is safe
      // to require rather than guess.
      const ruleset = parseRulesetFilter(req.query.ruleset);
      if (!ruleset) return res.status(400).json({ ok: false, message: "ruleset query param is required (5e or 5.5e)" });
      const row = db.prepare(`SELECT data_json FROM ${table} WHERE id = ? AND ruleset = ?`).get(id, ruleset) as
        | { data_json: string }
        | undefined;
      if (!row) return res.status(404).json({ ok: false, message: "Not found" });
      const entry = parseStoredGrandEntry(storedCategory, row.data_json) as Record<string, unknown>;
      return res.json(routeCategory === "backgrounds" ? projectBackgroundEquipmentNames(entry) : entry);
    };
    app.get(`/api/compendium/canonical/${routeCategory}/:id`, requireAuth, canonicalDetail);
  }

  function buildFeatDetailFromRow(row: { id: string; name: string; data_json: string }) {
    const presentation = parseStoredPresentationEntry("feats", row.data_json);
    const canonical = parseStoredGrandEntry("feats", row.data_json);
    return {
      ...presentation,
      id: row.id,
      name: row.name,
      ruleset: presentation.ruleset ?? canonical.ruleset,
    };
  }

  // --- Classes ---------------------------------------------------------------
  app.get("/api/compendium/classes", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res);
    const fields = parseRequestedFields(req.query.fields);
    const wantHd = includeField(fields, "hd");
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const rows = db.prepare(
      `SELECT id, name${wantHd ? ", hd" : ""}
       FROM compendium_classes
       ${ruleset ? "WHERE ruleset = ?" : ""}
       ORDER BY name COLLATE NOCASE`,
    ).all(...(ruleset ? [ruleset] : [])) as Array<{ id: string; name: string; hd?: number | null }>;
    res.json(rows.map((row) => {
      return {
        ...(includeField(fields, "id") ? { id: row.id } : {}),
        ...(includeField(fields, "name") ? { name: row.name } : {}),
        ...(wantHd ? { hd: row.hd ?? null } : {}),
      };
    }));
  });

  // --- Races -----------------------------------------------------------------
  app.get("/api/compendium/races", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res);
    const fields = parseRequestedFields(req.query.fields);
    const wantSize = includeField(fields, "size");
    const wantSpeed = includeField(fields, "speed");
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const rows = db.prepare(
      `SELECT id, name${wantSize ? ", size" : ""}${wantSpeed ? ", speed" : ""}
       FROM compendium_races
       ${ruleset ? "WHERE ruleset = ?" : ""}
       ORDER BY name COLLATE NOCASE`,
    ).all(...(ruleset ? [ruleset] : [])) as Array<{ id: string; name: string; size?: string | null; speed?: number | null }>;
    res.json(rows.map((row) => {
      return {
        ...(includeField(fields, "id") ? { id: row.id } : {}),
        ...(includeField(fields, "name") ? { name: row.name } : {}),
        ...(wantSize ? { size: row.size ?? null } : {}),
        ...(wantSpeed ? { speed: row.speed ?? null } : {}),
      };
    }));
  });

  // --- Backgrounds -----------------------------------------------------------
  app.get("/api/compendium/backgrounds", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res);
    const fields = parseRequestedFields(req.query.fields);
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const rows = db.prepare(
      `SELECT id, name
       FROM compendium_backgrounds
       ${ruleset ? "WHERE ruleset = ?" : ""}
       ORDER BY name COLLATE NOCASE`,
    ).all(...(ruleset ? [ruleset] : [])) as Array<{ id: string; name: string }>;
    res.json(rows.map((row) => {
      return {
        ...(includeField(fields, "id") ? { id: row.id } : {}),
        ...(includeField(fields, "name") ? { name: row.name } : {}),
      };
    }));
  });

  // --- Feats -----------------------------------------------------------------
  app.get("/api/compendium/feats", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res);
    const fields = parseRequestedFields(req.query.fields);
    const wantMetadata = [
      "category",
      "prerequisite",
      "repeatable",
      "source",
      "abilities",
    ].some((field) => includeField(fields, field));
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const rows = db.prepare(
      `SELECT id, name${wantMetadata ? ", data_json" : ""}
       FROM compendium_feats
       ${ruleset ? "WHERE ruleset = ?" : ""}
       ORDER BY name COLLATE NOCASE`,
    ).all(...(ruleset ? [ruleset] : [])) as Array<{ id: string; name: string; data_json?: string }>;
    res.json(rows.map((row) => {
      let data: any = {};
      if (wantMetadata) {
        try {
          data = parseStoredPresentationEntry("feats", row.data_json);
        } catch (error) {
          console.error(`[compendium] Skipping unparsable feat metadata for "${row.id}" (${row.name}):`, error);
        }
      }
      const parsed: any = wantMetadata
        ? (data.parsed ?? {})
        : null;
      const prerequisite = featPrerequisiteLabel(parsed?.prerequisite ?? data.prerequisite);
      const category = data.category ?? parsed?.category ?? null;
      const abilityNames = new Map([
        ["str", "Strength"],
        ["dex", "Dexterity"],
        ["con", "Constitution"],
        ["int", "Intelligence"],
        ["wis", "Wisdom"],
        ["cha", "Charisma"],
      ]);
      const abilityKeys = new Set<string>(Object.keys(parsed?.grants?.abilityIncreases ?? {}));
      for (const choice of parsed?.choices ?? []) {
        if (choice.type !== "ability_score") continue;
        for (const option of choice.options ?? []) abilityKeys.add(String(option).toLowerCase().slice(0, 3));
      }
      const abilities = Array.from(abilityKeys)
        .map((key) => abilityNames.get(key.toLowerCase().slice(0, 3)))
        .filter((value): value is string => Boolean(value));
      return {
        ...(includeField(fields, "id") ? { id: row.id } : {}),
        ...(includeField(fields, "name") ? { name: row.name } : {}),
        ...(includeField(fields, "category") ? { category } : {}),
        ...(includeField(fields, "prerequisite") ? { prerequisite } : {}),
        ...(includeField(fields, "repeatable") ? { repeatable: Boolean(parsed?.repeatable) } : {}),
        ...(includeField(fields, "source") ? { source: parsed?.source ?? null } : {}),
        ...(includeField(fields, "abilities") ? { abilities } : {}),
      };
    }));
  });

  app.get("/api/compendium/feats/:featId", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const featId = requireParam(req, res, "featId");
    if (!featId) return;
    // Unlike the canonical classes/species/backgrounds routes, this one is also called from
    // web-dm's general compendium browser with no character/ruleset context at all -- ruleset
    // stays optional here. When supplied, filter by it; otherwise prefer the 5.5e row if a
    // feat id happens to exist in both rulesets.
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const row = (ruleset
      ? db.prepare("SELECT id, name, data_json FROM compendium_feats WHERE id = ? AND ruleset = ?").get(featId, ruleset)
      : db.prepare("SELECT id, name, data_json FROM compendium_feats WHERE id = ? ORDER BY CASE WHEN ruleset = '5.5e' THEN 0 ELSE 1 END LIMIT 1").get(featId)
    ) as { id: string; name: string; data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Feat not found" });
    res.json(buildFeatDetailFromRow(row));
  });

  app.post("/api/compendium/feats/lookup", requireAuth, (req, res) => {
    const body = parseBody(FeatLookupBody, req);
    const ids = Array.from(new Set(body.ids.map((id) => String(id ?? "").trim()).filter(Boolean)));
    if (ids.length === 0) return res.json({ rows: [] });

    const placeholders = ids.map(() => "?").join(", ");
    // ids can collide across rulesets (composite PK). When the caller supplies its ruleset,
    // filter by it; otherwise sort 5.5e first so it "wins" the Map.set below for any id that
    // happens to exist in both.
    const rows = (body.ruleset
      ? db.prepare(`SELECT id, name, data_json FROM compendium_feats WHERE id IN (${placeholders}) AND ruleset = ?`).all(...ids, body.ruleset)
      : db.prepare(`SELECT id, name, data_json FROM compendium_feats WHERE id IN (${placeholders}) ORDER BY CASE WHEN ruleset = '5.5e' THEN 1 ELSE 0 END`).all(...ids)
    ) as Array<{ id: string; name: string; data_json: string }>;
    const byId = new Map<string, unknown>();
    for (const row of rows) {
      try {
        byId.set(row.id, buildFeatDetailFromRow(row));
      } catch (error) {
        console.error(`[compendium] Skipping unparsable feat "${row.id}" (${row.name}) in lookup:`, error);
      }
    }

    res.json({
      rows: ids.map((id) => ({
        id,
        feat: byId.get(id) ?? null,
      })),
    });
  });
}
