// server/src/routes/compendium/lore.ts
// Classes, races, backgrounds, and feats routes.

import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { requireAuth } from "../../middleware/auth.js";
import { parseBody } from "../../shared/validate.js";
import {
  parseStoredCanonicalCompendiumEntry,
  parseStoredCompendiumEntry,
} from "../../services/compendium/storedCompendium.js";
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

  const canonicalDetailRoutes = [
    ["classes", "classes", "compendium_classes"],
    ["species", "species", "compendium_races"],
    ["backgrounds", "backgrounds", "compendium_backgrounds"],
    ["feats", "feats", "compendium_feats"],
  ] as const;
  for (const [routeCategory, storedCategory, table] of canonicalDetailRoutes) {
    app.get(`/api/compendium/v2/${routeCategory}/:id`, requireAuth, (req, res) => {
      applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
      const id = requireParam(req, res, "id");
      if (!id) return;
      const row = db.prepare(`SELECT data_json FROM ${table} WHERE id = ?`).get(id) as
        | { data_json: string }
        | undefined;
      if (!row) return res.status(404).json({ ok: false, message: "Not found" });
      return res.json(parseStoredCanonicalCompendiumEntry(storedCategory, row.data_json));
    });
  }

  function buildFeatDetailFromRow(row: { id: string; name: string; data_json: string }) {
    return {
      ...parseStoredCompendiumEntry("feats", row.data_json),
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

  app.get("/api/compendium/classes/:id", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_classes WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const cls: any = parseStoredCompendiumEntry("classes", row.data_json);
    const v2Data = parseStoredCanonicalCompendiumEntry("classes", row.data_json);
    if (v2Data.proficiencies) cls.proficiencies = v2Data.proficiencies;
    res.json(cls);
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

  app.get("/api/compendium/races/:id", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_races WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const race: any = parseStoredCompendiumEntry("species", row.data_json);
    res.json(race);
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

  app.get("/api/compendium/backgrounds/:id", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_backgrounds WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const bg: any = parseStoredCompendiumEntry("backgrounds", row.data_json);
    res.json(bg);
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
      const data: any = wantMetadata
        ? parseStoredCompendiumEntry("feats", row.data_json)
        : {};
      const parsed: any = wantMetadata
        ? (data.parsed ?? {})
        : null;
      const prerequisite = parsed?.prerequisite ?? data.prerequisite ?? null;
      const category = data.category ?? parsed?.category
        ?? (/^Boon of\b/i.test(row.name) || /\bLevel 19\b/i.test(String(prerequisite ?? "")) ? "Epic Boon"
          : /\bFighting Style Feature\b/i.test(String(prerequisite ?? "")) ? "Fighting Style"
            : /\bLevel 4\b/i.test(String(prerequisite ?? "")) ? "General"
              : "Other");
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
    const byId = new Map(rows.map((row) => [row.id, buildFeatDetailFromRow(row)]));

    res.json({
      rows: ids.map((id) => ({
        id,
        feat: byId.get(id) ?? null,
      })),
    });
  });
}
