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
      const row = db.prepare(`SELECT data_json FROM ${table} WHERE id = ?`).get(id) as
        | { data_json: string }
        | undefined;
      if (!row) return res.status(404).json({ ok: false, message: "Not found" });
      const entry = parseStoredGrandEntry(storedCategory, row.data_json) as Record<string, unknown>;
      return res.json(routeCategory === "backgrounds" ? projectBackgroundEquipmentNames(entry) : entry);
    };
    app.get(`/api/compendium/canonical/${routeCategory}/:id`, requireAuth, canonicalDetail);
  }

  function buildFeatDetailFromRow(row: { id: string; name: string; data_json: string }) {
    return {
      ...parseStoredPresentationEntry("feats", row.data_json),
      id: row.id,
      name: row.name,
    };
  }

  // --- Classes ---------------------------------------------------------------
  app.get("/api/compendium/classes", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res);
    const fields = parseRequestedFields(req.query.fields);
    const wantHd = includeField(fields, "hd");
    const rows = db.prepare(
      `SELECT id, name${wantHd ? ", hd" : ""}
       FROM compendium_classes
       ORDER BY name COLLATE NOCASE`,
    ).all() as Array<{ id: string; name: string; hd?: number | null }>;
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
    const rows = db.prepare(
      `SELECT id, name${wantSize ? ", size" : ""}${wantSpeed ? ", speed" : ""}
       FROM compendium_races
       ORDER BY name COLLATE NOCASE`,
    ).all() as Array<{ id: string; name: string; size?: string | null; speed?: number | null }>;
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
    const rows = db.prepare(
      `SELECT id, name
       FROM compendium_backgrounds
       ORDER BY name COLLATE NOCASE`,
    ).all() as Array<{ id: string; name: string }>;
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
    const rows = db.prepare(
      `SELECT id, name${wantMetadata ? ", data_json" : ""}
       FROM compendium_feats
       ORDER BY name COLLATE NOCASE`,
    ).all() as Array<{ id: string; name: string; data_json?: string }>;
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
    const row = db.prepare("SELECT id, name, data_json FROM compendium_feats WHERE id = ?").get(featId) as {
      id: string;
      name: string;
      data_json: string;
    } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Feat not found" });
    res.json(buildFeatDetailFromRow(row));
  });

  app.post("/api/compendium/feats/lookup", requireAuth, (req, res) => {
    const body = parseBody(FeatLookupBody, req);
    const ids = Array.from(new Set(body.ids.map((id) => String(id ?? "").trim()).filter(Boolean)));
    if (ids.length === 0) return res.json({ rows: [] });

    const placeholders = ids.map(() => "?").join(", ");
    const rows = db.prepare(
      `SELECT id, name, data_json
       FROM compendium_feats
       WHERE id IN (${placeholders})`,
    ).all(...ids) as Array<{ id: string; name: string; data_json: string }>;
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
