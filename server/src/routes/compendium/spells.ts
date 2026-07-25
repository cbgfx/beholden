// server/src/routes/compendium/spells.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { requireAuth } from "../../middleware/auth.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { parseBody } from "../../shared/validate.js";
import { parseStoredGrandEntry, parseStoredPresentationEntry } from "../../services/compendium/storedCompendium.js";
import { grandEntryId, saveGrandEntry } from "../../services/compendium/grandEditor.js";
import { normalizeLookupName, parseRulesetFilter } from "./helpers.js";
import { z } from "zod";
import { readSpellAccessRegistry, resolveSpellAccessFilters } from "../../services/compendium/spellAccess.js";

export function registerSpellRoutes(app: Express, ctx: ServerContext, anyDm: RequestHandler) {
  const { db } = ctx;
  const MAX_SPELL_SEARCH_LIMIT = 250;
  const MAX_SPELL_LOOKUP_NAMES = 250;
  const displayAccessWith = (registry: Map<string, string>, value: unknown): string | null => {
    const labels = String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).map((id) => registry.get(id) ?? id);
    return labels.join(", ") || null;
  };

  const schoolAliases: Record<string, string[]> = {
    abjuration: ["A", "Abjuration"],
    conjuration: ["C", "Conjuration"],
    divination: ["D", "Divination"],
    enchantment: ["EN", "Enchantment"],
    evocation: ["EV", "Evocation"],
    illusion: ["I", "Illusion"],
    necromancy: ["N", "Necromancy"],
    transmutation: ["T", "Transmutation"],
  };

  const SpellLookupBody = z.object({
    ids: z.array(z.string()).max(MAX_SPELL_LOOKUP_NAMES).optional(),
    names: z.array(z.string()).max(MAX_SPELL_LOOKUP_NAMES).optional(),
    includeText: z.boolean().optional(),
    ruleset: z.enum(["5e", "5.5e"]).optional(),
  });

  // Name (and id) collide across rulesets (composite PK). When the caller's ruleset is known,
  // filter by it; otherwise prefer the 5.5e row, matching the established feats pattern.
  const RULESET_TIEBREAK = "CASE WHEN ruleset = '5.5e' THEN 0 ELSE 1 END";
  const selectSpellByExact = db.prepare(
    `SELECT id, ruleset, name, level, concentration FROM compendium_spells WHERE name_key = ? ORDER BY ${RULESET_TIEBREAK}, name_key ASC LIMIT 1`,
  );
  const selectSpellByExactRuleset = db.prepare(
    "SELECT id, ruleset, name, level, concentration FROM compendium_spells WHERE name_key = ? AND ruleset = ? ORDER BY name_key ASC LIMIT 1",
  );
  const selectSpellByPrefix = db.prepare(
    `SELECT id, ruleset, name, level, concentration FROM compendium_spells WHERE name_key LIKE ? ORDER BY ${RULESET_TIEBREAK}, LENGTH(name_key) ASC, name_key ASC LIMIT 1`,
  );
  const selectSpellByPrefixRuleset = db.prepare(
    "SELECT id, ruleset, name, level, concentration FROM compendium_spells WHERE name_key LIKE ? AND ruleset = ? ORDER BY LENGTH(name_key) ASC, name_key ASC LIMIT 1",
  );
  const selectSpellByContains = db.prepare(
    `SELECT id, ruleset, name, level, concentration FROM compendium_spells WHERE name_key LIKE ? ORDER BY ${RULESET_TIEBREAK}, LENGTH(name_key) ASC, name_key ASC LIMIT 1`,
  );
  const selectSpellByContainsRuleset = db.prepare(
    "SELECT id, ruleset, name, level, concentration FROM compendium_spells WHERE name_key LIKE ? AND ruleset = ? ORDER BY LENGTH(name_key) ASC, name_key ASC LIMIT 1",
  );

  type SpellBasicRow = { id: string; ruleset: "5e" | "5.5e"; name: string; level: number | null; concentration: number };
  function lookupSpellByName(rawName: string, ruleset?: "5e" | "5.5e" | null): { id: string; ruleset: "5e" | "5.5e"; name: string; level: number | null; concentration: boolean } | null {
    const normalized = normalizeLookupName(rawName);
    if (!normalized) return null;

    const toOut = (row: SpellBasicRow) => ({ ...row, concentration: row.concentration === 1 });

    const exact = (ruleset ? selectSpellByExactRuleset.get(normalized, ruleset) : selectSpellByExact.get(normalized)) as SpellBasicRow | undefined;
    if (exact) return toOut(exact);

    const prefix = (ruleset ? selectSpellByPrefixRuleset.get(`${normalized}%`, ruleset) : selectSpellByPrefix.get(`${normalized}%`)) as SpellBasicRow | undefined;
    if (prefix) return toOut(prefix);

    const contains = (ruleset ? selectSpellByContainsRuleset.get(`%${normalized}%`, ruleset) : selectSpellByContains.get(`%${normalized}%`)) as SpellBasicRow | undefined;
    return contains ? toOut(contains) : null;
  }

  app.get("/api/spells/search", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res);
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1),
      MAX_SPELL_SEARCH_LIMIT,
    );
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
    const withTotalRaw = String(req.query.withTotal ?? "").trim().toLowerCase();
    const withTotal = withTotalRaw === "1" || withTotalRaw === "true" || withTotalRaw === "yes";
    const includeTextRaw = String(req.query.includeText ?? "").trim().toLowerCase();
    const includeText = includeTextRaw === "1" || includeTextRaw === "true" || includeTextRaw === "yes";
    const liteRaw = String(req.query.lite ?? "").trim().toLowerCase();
    const lite = liteRaw === "1" || liteRaw === "true" || liteRaw === "yes";
    const compactRaw = String(req.query.compact ?? "").trim().toLowerCase();
    const compact = compactRaw === "1" || compactRaw === "true" || compactRaw === "yes";
    const levelRaw = String(req.query.level ?? "").trim();
    const level = levelRaw === "" ? null : Number(levelRaw);
    const maxLevelRaw = String(req.query.maxLevel ?? "").trim();
    const maxLevel = maxLevelRaw === "" ? null : Number(maxLevelRaw);
    const classesFilter = String(req.query.classes ?? "").trim();
    const schoolFilter = String(req.query.school ?? "").trim();
    const ritualRaw = String(req.query.ritual ?? "").trim().toLowerCase();
    const ritualOnly = ritualRaw === "1" || ritualRaw === "true" || ritualRaw === "yes";

    const shouldSelectDataJson = includeText || (!compact && !lite);
    const baseSelect = shouldSelectDataJson
      ? "SELECT id, ruleset, name, level, school, ritual, concentration, components, classes, data_json FROM compendium_spells WHERE 1=1"
      : "SELECT id, ruleset, name, level, school, ritual, concentration, components, classes FROM compendium_spells WHERE 1=1";
    const parts: string[] = [baseSelect];
    const countParts: string[] = ["SELECT count(*) AS n FROM compendium_spells WHERE 1=1"];
    const params: unknown[] = [];

    if (q) {
      parts.push("AND (name LIKE ? OR name_key LIKE ?)");
      countParts.push("AND (name LIKE ? OR name_key LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like);
    }
    if (level != null && Number.isFinite(level)) {
      parts.push("AND level = ?");
      countParts.push("AND level = ?");
      params.push(level);
    }
    const minLevelRaw = String(req.query.minLevel ?? "").trim();
    const minLevel = minLevelRaw === "" ? null : Number(minLevelRaw);
    if (minLevel != null && Number.isFinite(minLevel)) {
      parts.push("AND level >= ?");
      countParts.push("AND level >= ?");
      params.push(minLevel);
    }
    if (maxLevel != null && Number.isFinite(maxLevel)) {
      parts.push("AND level <= ?");
      countParts.push("AND level <= ?");
      params.push(maxLevel);
    }
    if (classesFilter) {
      const cls = resolveSpellAccessFilters(db, classesFilter.split(",").map(s => s.trim()).filter(Boolean));
      const orParts = cls.map(() => "classes LIKE ?");
      parts.push(`AND (${orParts.join(" OR ")})`);
      countParts.push(`AND (${orParts.join(" OR ")})`);
      params.push(...cls.map(c => `%${c}%`));
    }
    if (schoolFilter) {
      const schools = schoolFilter
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .flatMap((school) => schoolAliases[school.toLowerCase()] ?? [school]);
      const uniqueSchools = Array.from(new Set(schools));
      if (uniqueSchools.length > 0) {
        const orParts = uniqueSchools.map(() => "school LIKE ?");
        parts.push(`AND (${orParts.join(" OR ")})`);
        countParts.push(`AND (${orParts.join(" OR ")})`);
        params.push(...uniqueSchools.map((school) => `%${school}%`));
      }
    }
    if (ritualOnly) {
      parts.push("AND ritual = 1");
      countParts.push("AND ritual = 1");
    }
    const searchRuleset = parseRulesetFilter(req.query.ruleset);
    if (searchRuleset) {
      parts.push("AND ruleset = ?");
      countParts.push("AND ruleset = ?");
      params.push(searchRuleset);
    }
    parts.push("ORDER BY level NULLS LAST, name COLLATE NOCASE");
    parts.push(`LIMIT ${limit} OFFSET ${offset}`);

    const rows = db.prepare(parts.join(" ")).all(...params) as {
      id: string; ruleset: "5e" | "5.5e"; name: string; level: number | null; school: string | null;
      ritual: number; concentration: number; components: string | null; classes: string | null; data_json?: string;
    }[];
    const accessRegistry = readSpellAccessRegistry(db);
    const outRows = rows.map((row) => {
      const s = shouldSelectDataJson
        ? parseStoredPresentationEntry("spells", row.data_json)
        : {};
      if (lite) {
        const out: Record<string, unknown> = {
          id: row.id,
          ruleset: row.ruleset,
          name: row.name,
          level: row.level,
          school: row.school ?? null,
          ritual: row.ritual === 1,
          concentration: row.concentration === 1,
          components: row.components ?? null,
          classes: displayAccessWith(accessRegistry, row.classes),
        };
        out.time = s.time ?? null;
        out.range = s.range ?? null;
        out.duration = s.duration ?? null;
        out.rolls = s.rolls ?? [];
        out.check = s.check ?? null;
        if (includeText) {
          const textArr: string[] = Array.isArray(s.text) ? s.text : (s.text ? [s.text] : []);
          out.text = textArr.join("\n") || null;
        }
        return out;
      }
      const out: Record<string, unknown> = {
        id: row.id, ruleset: row.ruleset, name: row.name, level: row.level, school: row.school,
        time: s.time ?? null,
        ritual: row.ritual === 1, concentration: row.concentration === 1,
        components: row.components ?? s.components ?? null,
        classes: displayAccessWith(accessRegistry, row.classes ?? s.classes),
      };
      if (includeText) {
        const textArr: string[] = Array.isArray(s.text) ? s.text : (s.text ? [s.text] : []);
        out.text = textArr.join("\n") || null;
      }
      return out;
    });

    if (!withTotal) return res.json(outRows);
    const total = (db.prepare(countParts.join(" ")).get(...params) as { n: number }).n;
    return res.json({ rows: outRows, total });
  });

  app.post("/api/spells/lookup", requireAuth, (req, res) => {
    const body = parseBody(SpellLookupBody, req);
    const includeText = Boolean(body.includeText);
    const rows: Array<{
      query: string;
      match:
        | ( {
            id: string;
            ruleset: "5e" | "5.5e";
            name: string;
            level: number | null;
            school?: string | null;
            ritual?: boolean;
            concentration?: boolean;
            components?: string | null;
            classes?: string | null;
            time?: string | null;
            range?: string | null;
            duration?: string | null;
            text?: string | null;
            rolls?: unknown[];
            check?: unknown;
          } )
        | null;
    }> = [];

    const ids = Array.from(new Set((body.ids ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean)));
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      // ids can collide across rulesets (composite PK). When the caller supplies its ruleset,
      // filter by it; otherwise sort 5.5e first so it "wins" the Map.set below for any id that
      // happens to exist in both.
      const idRows = (body.ruleset
        ? db.prepare(`SELECT id, ruleset, name, level, concentration FROM compendium_spells WHERE id IN (${placeholders}) AND ruleset = ?`).all(...ids, body.ruleset)
        : db.prepare(`SELECT id, ruleset, name, level, concentration FROM compendium_spells WHERE id IN (${placeholders}) ORDER BY CASE WHEN ruleset = '5.5e' THEN 1 ELSE 0 END`).all(...ids)
      ) as SpellBasicRow[];
      const idRowById = new Map(idRows.map((row) => [
        row.id,
        {
          id: row.id,
          ruleset: row.ruleset,
          name: row.name,
          level: row.level,
          concentration: row.concentration === 1,
        },
      ]));
      for (const id of ids) {
        const row = idRowById.get(id);
        rows.push({ query: id, match: row ?? null });
      }
    }

    const seen = new Set<string>();
    const nameRows = (body.names ?? [])
      .map((entry) => String(entry ?? ""))
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry) => {
        const key = normalizeLookupName(entry);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((query) => ({ query, match: lookupSpellByName(query, body.ruleset) }));
    rows.push(...nameRows);

    if (includeText) {
      // Fetch text by the exact (id, ruleset) each match resolved to -- not bare id, which could
      // pull the wrong ruleset's row back in for a spell name that collides across rulesets.
      const matchKeys = Array.from(
        new Map(
          rows
            .filter((row): row is typeof row & { match: NonNullable<typeof row.match> } => Boolean(row.match?.id))
            .map((row) => [`${row.match.ruleset}:${row.match.id}`, row.match]),
        ).values(),
      );
      if (matchKeys.length > 0) {
        const placeholders = matchKeys.map(() => "(id = ? AND ruleset = ?)").join(" OR ");
        const textRows = db.prepare(
          `SELECT id, school, ritual, concentration, components, classes, data_json
           FROM compendium_spells
           WHERE ${placeholders}`,
        ).all(...matchKeys.flatMap((m) => [m.id, m.ruleset])) as Array<{
          id: string;
          school: string | null;
          ritual: number;
          concentration: number;
          components: string | null;
          classes: string | null;
          data_json: string | null;
        }>;
        const lookupAccessRegistry = readSpellAccessRegistry(db);
        const detailById = new Map(
          textRows.map((row) => {
            let time: string | null = null;
            let range: string | null = null;
            let duration: string | null = null;
            let text: string | null = null;
            const parsed = parseStoredPresentationEntry("spells", row.data_json);
            time = parsed.time == null ? null : String(parsed.time);
            range = parsed.range == null ? null : String(parsed.range);
            duration = parsed.duration == null ? null : String(parsed.duration);
            const textArr: string[] = Array.isArray(parsed.text)
              ? parsed.text.map((entry) => String(entry ?? "")).filter(Boolean)
              : parsed.text
                ? [String(parsed.text)]
                : [];
            text = textArr.join("\n").trim() || null;
            return [row.id, {
              school: row.school ?? null,
              ritual: row.ritual === 1,
              concentration: row.concentration === 1,
              components: row.components ?? null,
              classes: displayAccessWith(lookupAccessRegistry, row.classes),
              time,
              range,
              duration,
              text,
              rolls: Array.isArray(parsed.rolls) ? parsed.rolls : [],
              check: parsed.check ?? null,
              source: parsed.source ?? null,
            }] as const;
          }),
        );
        for (const row of rows) {
          if (!row.match?.id) continue;
          const detail = detailById.get(row.match.id);
          if (!detail) continue;
          row.match = { ...row.match, ...detail };
        }
      }
    }

    res.json({ rows });
  });

  app.get("/api/spells/:spellId", (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const spellId = requireParam(req, res, "spellId");
    if (!spellId) return;
    // ids can collide across rulesets (composite PK) -- filter by ruleset when supplied,
    // otherwise prefer the 5.5e row, matching the established feats pattern.
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const row = (ruleset
      ? db.prepare("SELECT id, ruleset, name, name_key, level, school, ritual, concentration, components, classes, data_json FROM compendium_spells WHERE id = ? AND ruleset = ?").get(spellId, ruleset)
      : db.prepare("SELECT id, ruleset, name, name_key, level, school, ritual, concentration, components, classes, data_json FROM compendium_spells WHERE id = ? ORDER BY CASE WHEN ruleset = '5.5e' THEN 0 ELSE 1 END LIMIT 1").get(spellId)
    ) as {
      id: string;
      ruleset: "5e" | "5.5e";
      name: string;
      name_key: string | null;
      level: number | null;
      school: string | null;
      ritual: number;
      concentration: number;
      components: string | null;
      classes: string | null;
      data_json: string;
    } | undefined;
    if (!row)
      return res.status(404).json({ ok: false, message: "Spell not found in compendium" });
    if (String(req.query.view ?? "").trim().toLowerCase() === "grand") {
      return res.json(parseStoredGrandEntry("spells", row.data_json));
    }
    const data = parseStoredPresentationEntry("spells", row.data_json);
    res.json({
      ...data,
      id: row.id,
      ruleset: data.ruleset ?? row.ruleset,
      name: row.name,
      nameKey: row.name_key ?? (typeof data.nameKey === "string" ? data.nameKey : null),
      name_key: row.name_key ?? (typeof data.name_key === "string" ? data.name_key : null),
      level: row.level,
      school: row.school,
      ritual: row.ritual === 1,
      concentration: row.concentration === 1,
      components: row.components ?? data.components ?? null,
      classes: displayAccessWith(readSpellAccessRegistry(db), row.classes ?? data.classes),
    });
  });

  app.post("/api/spells", anyDm, (req, res) => {
    const id = grandEntryId("s", (req.body as Record<string, unknown> | undefined)?.name);
    saveGrandEntry(db, "spells", req.body, id);
    ctx.broadcast("compendium:changed", { spellCreated: id });
    res.json({ ok: true, id });
  });

  app.put("/api/spells/:spellId", anyDm, (req, res) => {
    const spellId = requireParam(req, res, "spellId");
    if (!spellId) return;
    // The body's own `ruleset` (required by SpellSchema) identifies exactly which row this
    // update targets -- ids can collide across rulesets (composite PK).
    const bodyRuleset = parseRulesetFilter((req.body as Record<string, unknown> | undefined)?.ruleset);
    const existing = (bodyRuleset
      ? db.prepare("SELECT id FROM compendium_spells WHERE id = ? AND ruleset = ?").get(spellId, bodyRuleset)
      : db.prepare("SELECT id FROM compendium_spells WHERE id = ?").get(spellId)
    ) as { id: string } | undefined;
    if (!existing)
      return res.status(404).json({ ok: false, message: "Spell not found" });
    saveGrandEntry(db, "spells", req.body, spellId);
    ctx.broadcast("compendium:changed", { spellUpdated: spellId });
    res.json({ ok: true });
  });

  app.delete("/api/spells/:spellId", anyDm, (req, res) => {
    const spellId = requireParam(req, res, "spellId");
    if (!spellId) return;
    // ids can collide across rulesets (composite PK) -- filter by ruleset when supplied,
    // otherwise fall back to deleting the 5.5e row, matching the GET/lookup fallback below.
    const ruleset = parseRulesetFilter(req.query.ruleset);
    if (ruleset) {
      db.prepare("DELETE FROM compendium_spells WHERE id = ? AND ruleset = ?").run(spellId, ruleset);
    } else {
      db.prepare(
        "DELETE FROM compendium_spells WHERE rowid IN (SELECT rowid FROM compendium_spells WHERE id = ? ORDER BY CASE WHEN ruleset = '5.5e' THEN 0 ELSE 1 END LIMIT 1)",
      ).run(spellId);
    }
    ctx.broadcast("compendium:changed", { spellDeleted: spellId });
    res.json({ ok: true });
  });
}
