// server/src/routes/compendium/lore.ts
// Classes, races, backgrounds, and feats routes.

import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { requireAuth } from "../../middleware/auth.js";
import { parseBody } from "../../shared/validate.js";
import { parseFeat } from "../../lib/featParser.js";
import { parseBackgroundProficiencies, parseRaceChoicesByRuleset } from "../../lib/proficiencyConstants.js";
import { inferRuleset } from "../../lib/inferRuleset.js";
import { parsePreparedSpellProgression } from "../../lib/preparedSpellProgression.js";
import { z } from "zod";

export function registerLoreRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const MAX_FEAT_LOOKUP_IDS = 300;
  const FeatLookupBody = z.object({
    ids: z.array(z.string()).max(MAX_FEAT_LOOKUP_IDS),
  });

  function buildFeatDetailFromRow(row: { data_json: string }) {
    const feat = JSON.parse(row.data_json);
    if (!feat.ruleset) {
      feat.ruleset = inferRuleset(feat.name, feat.text, feat.prerequisite, feat.special);
    }
    feat.parsed = parseFeat({
      name: String(feat.name ?? ""),
      text: String(feat.text ?? ""),
      prerequisite: typeof feat.prerequisite === "string" ? feat.prerequisite : null,
      proficiency: typeof feat.proficiency === "string" ? feat.proficiency : null,
      modifiers: Array.isArray(feat.modifierDetails)
        ? feat.modifierDetails
        : Array.isArray(feat.modifiers)
          ? feat.modifiers.map((text: unknown) => ({ category: "", text: String(text ?? "") }))
          : [],
    });
    return feat;
  }

  // --- Classes ---------------------------------------------------------------
  app.get("/api/compendium/classes", requireAuth, (_req, res) => {
    applySharedApiCacheHeaders(res);
    const rows = db.prepare("SELECT id, name, hd, data_json FROM compendium_classes ORDER BY name COLLATE NOCASE").all() as { id: string; name: string; hd: number | null; data_json: string }[];
    res.json(rows.map((row) => {
      const data = JSON.parse(row.data_json);
      return { id: row.id, name: row.name, hd: row.hd, ruleset: data.ruleset ?? inferRuleset(row.name) };
    }));
  });

  app.get("/api/compendium/classes/:id", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_classes WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const cls = JSON.parse(row.data_json);
    if (!cls.ruleset) cls.ruleset = inferRuleset(cls.name);
    if (Array.isArray(cls.autolevels)) {
      cls.autolevels = cls.autolevels.map((al: any) => ({
        ...al,
        features: Array.isArray(al?.features)
          ? al.features.map((feature: any) => ({
              ...feature,
              preparedSpellProgression: Array.isArray(feature?.preparedSpellProgression)
                ? feature.preparedSpellProgression
                : parsePreparedSpellProgression(String(feature?.text ?? "")),
            }))
          : [],
      }));
    }
    res.json(cls);
  });

  // --- Races -----------------------------------------------------------------
  app.get("/api/compendium/races", requireAuth, (_req, res) => {
    applySharedApiCacheHeaders(res);
    const rows = db.prepare("SELECT id, name, size, speed, data_json FROM compendium_races ORDER BY name COLLATE NOCASE").all() as { id: string; name: string; size: string | null; speed: number | null; data_json: string }[];
    res.json(rows.map((row) => {
      const data = JSON.parse(row.data_json);
      return { id: row.id, name: row.name, size: row.size, speed: row.speed, ruleset: data.ruleset ?? inferRuleset(row.name) };
    }));
  });

  app.get("/api/compendium/races/:id", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_races WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const race = JSON.parse(row.data_json);
    if (!race.ruleset) {
      race.ruleset = inferRuleset(race.name, Array.isArray(race.traits) ? race.traits.map((t: any) => `${t?.name ?? ""}\n${t?.text ?? ""}`).join("\n") : "");
    }
    if (!race.parsedChoices) {
      race.parsedChoices = parseRaceChoicesByRuleset(
        race.ruleset,
        Array.isArray(race.traits) ? race.traits.map((t: any) => ({ name: String(t?.name ?? ""), text: String(t?.text ?? "") })) : [],
      );
    }
    if (Array.isArray(race.traits)) {
      race.traits = race.traits.map((trait: any) => ({
        ...trait,
        preparedSpellProgression: Array.isArray(trait?.preparedSpellProgression)
          ? trait.preparedSpellProgression
          : parsePreparedSpellProgression(String(trait?.text ?? "")),
      }));
    }
    res.json(race);
  });

  // --- Backgrounds -----------------------------------------------------------
  app.get("/api/compendium/backgrounds", requireAuth, (_req, res) => {
    applySharedApiCacheHeaders(res);
    const rows = db.prepare("SELECT id, name, data_json FROM compendium_backgrounds ORDER BY name COLLATE NOCASE").all() as { id: string; name: string; data_json: string }[];
    res.json(rows.map((row) => {
      const data = JSON.parse(row.data_json);
      return { id: row.id, name: row.name, ruleset: data.ruleset ?? inferRuleset(row.name) };
    }));
  });

  app.get("/api/compendium/backgrounds/:id", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_backgrounds WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const bg = JSON.parse(row.data_json);
    if (!bg.ruleset) {
      bg.ruleset = inferRuleset(bg.name, bg.equipment, Array.isArray(bg.traits) ? bg.traits.map((t: any) => `${t?.name ?? ""}\n${t?.text ?? ""}`).join("\n") : "");
    }
    bg.proficiencies = parseBackgroundProficiencies({
      proficiency: bg.proficiency,
      trait: bg.traits,
      ruleset: bg.ruleset,
    });
    if (Array.isArray(bg.traits)) {
      bg.traits = bg.traits.map((trait: any) => ({
        ...trait,
        preparedSpellProgression: Array.isArray(trait?.preparedSpellProgression)
          ? trait.preparedSpellProgression
          : parsePreparedSpellProgression(String(trait?.text ?? "")),
      }));
    }
    res.json(bg);
  });

  // --- Feats -----------------------------------------------------------------
  app.get("/api/compendium/feats", requireAuth, (_req, res) => {
    applySharedApiCacheHeaders(res);
    const rows = db.prepare("SELECT id, name, data_json FROM compendium_feats ORDER BY name COLLATE NOCASE").all() as { id: string; name: string; data_json: string }[];
    res.json(rows.map((row) => {
      const data = JSON.parse(row.data_json);
      return { id: row.id, name: row.name, ruleset: data.ruleset ?? inferRuleset(row.name) };
    }));
  });

  app.get("/api/compendium/feats/:featId", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const featId = requireParam(req, res, "featId");
    if (!featId) return;
    const row = db.prepare("SELECT data_json FROM compendium_feats WHERE id = ?").get(featId) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Feat not found" });
    res.json(buildFeatDetailFromRow(row));
  });

  app.post("/api/compendium/feats/lookup", requireAuth, (req, res) => {
    const body = parseBody(FeatLookupBody, req);
    const ids = Array.from(new Set(body.ids.map((id) => String(id ?? "").trim()).filter(Boolean)));
    if (ids.length === 0) return res.json({ rows: [] });

    const placeholders = ids.map(() => "?").join(", ");
    const rows = db.prepare(
      `SELECT id, data_json
       FROM compendium_feats
       WHERE id IN (${placeholders})`,
    ).all(...ids) as Array<{ id: string; data_json: string }>;
    const byId = new Map(rows.map((row) => [row.id, buildFeatDetailFromRow({ data_json: row.data_json })]));

    res.json({
      rows: ids.map((id) => ({
        id,
        feat: byId.get(id) ?? null,
      })),
    });
  });
}
