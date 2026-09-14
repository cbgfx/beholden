// server/src/routes/compendium/monsters.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { parseStoredGrandEntry, parseStoredPresentationEntry } from "../../services/compendium/storedCompendium.js";
import { grandEntryId, saveGrandEntry } from "../../services/compendium/grandEditor.js";
import { parseRulesetFilter } from "./helpers.js";
import { monsterSortLetter } from "@beholden/shared/domain/compendium/monsterSortName";

function parseCrFilterValue(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (text.includes("/")) {
    const [numeratorRaw, denominatorRaw] = text.split("/");
    const numerator = Number(numeratorRaw);
    const denominator = Number(denominatorRaw);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function registerMonsterRoutes(app: Express, ctx: ServerContext, anyDm: RequestHandler) {
  const { db } = ctx;
  const MAX_MONSTER_SEARCH_LIMIT = 200;
  const MAX_MONSTER_METRICS_BATCH = 500;

  // MARK: - GET /api/compendium/monsters/facets
  app.get("/api/compendium/monsters/facets", (_req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const typeRows = db
      .prepare("SELECT DISTINCT type_key FROM compendium_monsters WHERE type_key IS NOT NULL AND type_key != ''")
      .all() as Array<{ type_key: string }>;
    const sizeRows = db
      .prepare("SELECT DISTINCT size FROM compendium_monsters WHERE size IS NOT NULL AND size != ''")
      .all() as Array<{ size: string }>;
    const envRows = db
      .prepare("SELECT environment FROM compendium_monsters WHERE environment IS NOT NULL AND environment != ''")
      .all() as Array<{ environment: string }>;
    const envSet = new Set<string>();
    for (const row of envRows) {
      for (const part of row.environment.split(",").map((v) => v.trim()).filter(Boolean)) {
        const environment = part.toLocaleLowerCase();
        // "any"/"all" describe the absence of a habitat restriction; the UI already
        // represents that with its synthetic "All environments" option.
        if (environment !== "any" && environment !== "all") envSet.add(environment);
      }
    }
    res.json({
      environments: Array.from(envSet).sort((a, b) => a.localeCompare(b)),
      sizes: sizeRows.map((r) => r.size).sort((a, b) => a.localeCompare(b)),
      types: typeRows.map((r) => r.type_key).sort((a, b) => a.localeCompare(b)),
    });
  });

  // MARK: - GET /api/compendium/monsters/:monsterId
  // MARK: - GET /api/compendium/monsters/letters
  // Registered above /:monsterId, which would otherwise match "letters" as a monster id.
  // Row index of the first monster under each initial letter, for the browser's A-Z jump bar.
  // The bar has to know where "M" starts within the whole filtered list, which the browser can no
  // longer work out for itself now that it holds only the rows it has scrolled past.
  app.get("/api/compendium/monsters/letters", (req, res) => {
    applySharedApiCacheHeaders(res);
    const { clauses, params } = buildMonsterFilters(req.query);
    // Only the name column, in the same order the list is rendered in -- cheap enough to scan even
    // for an unfiltered catalogue, and it keeps the indices exact.
    const rows = db
      .prepare(`SELECT name FROM compendium_monsters WHERE 1=1 ${clauses.join(" ")} ${monsterOrderBy(req.query.sort)}`)
      .all(...params) as { name: string }[];

    const firstIndex = new Map<string, number>();
    for (let index = 0; index < rows.length; index += 1) {
      const letter = monsterSortLetter(rows[index]?.name ?? "");
      if (letter && !firstIndex.has(letter)) firstIndex.set(letter, index);
    }

    return res.json({
      letters: Array.from(firstIndex.entries())
        .map(([letter, index]) => ({ letter, index }))
        .sort((a, b) => a.letter.localeCompare(b.letter)),
      total: rows.length,
    });
  });

  app.get("/api/compendium/monsters/:monsterId", (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const monsterId = requireParam(req, res, "monsterId");
    if (!monsterId) return;
    const view = String(req.query.view ?? "").trim().toLowerCase();
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const metricsOnly = view === "metrics" || view === "summary";
    const rows = db
      .prepare(`SELECT id, ruleset, name, name_key, cr, type_key, type_full, size, environment, data_json
                FROM compendium_monsters WHERE id = ?${ruleset ? " AND ruleset = ?" : ""}`)
      .all(...(ruleset ? [monsterId, ruleset] : [monsterId])) as Array<{
      id: string;
      ruleset: "5e" | "5.5e";
      name: string;
      name_key: string | null;
      cr: string | null;
      type_key: string | null;
      type_full: string | null;
      size: string | null;
      environment: string | null;
      data_json: string;
    }>;
    if (!ruleset && rows.length > 1) {
      return res.status(409).json({ ok: false, message: "Monster ID exists in multiple rulesets; specify ?ruleset=5e or ?ruleset=5.5e." });
    }
    const row = rows[0];
    if (!row)
      return res.status(404).json({ ok: false, message: "Monster not found in compendium" });

    if (String(req.query.view ?? "").trim().toLowerCase() === "grand") {
      return res.json(parseStoredGrandEntry("monsters", row.data_json));
    }

    const m = parseStoredPresentationEntry("monsters", row.data_json);
    if (metricsOnly) {
      return res.json({
        id: row.id,
        ruleset: m.ruleset,
        name: row.name,
        cr: row.cr ?? m.cr ?? null,
        xp: m.xp ?? null,
        action: m.action ?? [],
        legendary: m.legendary ?? [],
        legendaryUses: m.legendaryUses ?? null,
        _summaryOnly: true,
      });
    }
    res.json({
      id: row.id,
      ruleset: m.ruleset,
      name: row.name,
      nameKey: row.name_key ?? m.nameKey ?? m.name_key ?? null,
      cr: row.cr ?? m.cr ?? null,
      xp: m.xp ?? null,
      typeFull: row.type_full ?? m.typeFull ?? m.type_full ?? null,
      typeKey: row.type_key ?? m.typeKey ?? m.type_key ?? null,
      size: row.size ?? m.size ?? null,
      environment: row.environment ?? m.environment ?? null,
      source: m.source ?? null,
      ac: m.ac ?? null,
      hp: ctx.helpers.normalizeHp(m.hp ?? null),
      speed: m.speed ?? null,
      movement: m.movement ?? null,
      str: m.str ?? null,
      dex: m.dex ?? null,
      con: m.con ?? null,
      int: m.int ?? null,
      wis: m.wis ?? null,
      cha: m.cha ?? null,
      save: m.save ?? null,
      skill: m.skill ?? null,
      senses: m.senses ?? null,
      languages: m.languages ?? null,
      immune: m.immune ?? null,
      resist: m.resist ?? null,
      vulnerable: m.vulnerable ?? null,
      conditionImmune: m.conditionImmune ?? null,
      treasure: m.treasure ?? null,
      trait: m.trait ?? [],
      action: m.action ?? [],
      reaction: m.reaction ?? [],
      legendary: m.legendary ?? [],
      legendaryUses: m.legendaryUses ?? null,
      spellcasting: m.spellcasting ?? [],
      // Spell references store only catalog IDs; display names are projected from the
      // spell catalog at read time (one fact, one home in storage).
      spells: projectMonsterSpellNames(Array.isArray(m.spells) ? m.spells as Array<Record<string, unknown>> : []),
    });
  });

  function projectMonsterSpellNames(spells: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const ids = Array.from(new Set(spells.map((s) => String(s.spellId ?? "")).filter(Boolean)));
    if (ids.length === 0) return spells;
    const placeholders = ids.map(() => "?").join(", ");
    const rows = db.prepare(`SELECT id, name FROM compendium_spells WHERE id IN (${placeholders})`).all(...ids) as Array<{ id: string; name: string }>;
    const nameById = new Map(rows.map((row) => [row.id, row.name]));
    return spells.map((s) => {
      const name = String(s.name ?? "") || nameById.get(String(s.spellId ?? "")) || "";
      return { ...s, name };
    });
  }

  // MARK: - GET /api/compendium/monsters
  app.get("/api/compendium/monsters", (_req, res) => {
    applySharedApiCacheHeaders(res);
    const rows = db
      .prepare("SELECT id, name, cr, cr_numeric, type_key, size, environment FROM compendium_monsters")
      .all() as {
        id: string; name: string; cr: string | null; cr_numeric: number | null;
        type_key: string | null; size: string | null; environment: string | null;
      }[];
    res.json(rows.map((r) => ({
      id: r.id, name: r.name,
      cr: r.cr ?? r.cr_numeric ?? 0,
      type: r.type_key ?? "",
      environment: r.environment ?? "",
      size: r.size ?? "",
    })));
  });

  // MARK: - GET /api/compendium/monsters-metrics
  app.get("/api/compendium/monsters-metrics", (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const rawIds = String(req.query.ids ?? "").trim();
    if (!rawIds) return res.json({ rows: [] as unknown[] });
    const ids = Array.from(new Set(rawIds.split(",").map((id) => id.trim()).filter(Boolean))).slice(0, MAX_MONSTER_METRICS_BATCH);
    if (!ids.length) return res.json({ rows: [] as unknown[] });

    const placeholders = ids.map(() => "?").join(", ");
    const rows = db
      .prepare(`SELECT id, name, cr, data_json FROM compendium_monsters WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string; name: string; cr: string | null; data_json: string | null }>;

    const metricsRows = rows.map((row) => {
      const parsed = parseStoredPresentationEntry("monsters", row.data_json);
      return {
        id: row.id,
        name: row.name,
        cr: row.cr ?? parsed.cr ?? null,
        xp: parsed.xp ?? null,
        action: Array.isArray(parsed.action) ? parsed.action : [],
        legendary: Array.isArray(parsed.legendary) ? parsed.legendary : [],
        _summaryOnly: true,
      };
    });

    return res.json({ rows: metricsRows });
  });

  // MARK: - POST /api/compendium/monsters
  app.post("/api/compendium/monsters", anyDm, (req, res) => {
    const id = grandEntryId("m", (req.body as Record<string, unknown> | undefined)?.name);
    saveGrandEntry(db, "monsters", req.body, id);
    ctx.broadcast("compendium:changed", { monsterCreated: id });
    res.json({ ok: true, id });
  });

  // MARK: - PUT /api/compendium/monsters/:monsterId
  app.put("/api/compendium/monsters/:monsterId", anyDm, (req, res) => {
    const monsterId = requireParam(req, res, "monsterId");
    if (!monsterId) return;
    const bodyRuleset = (req.body as { ruleset?: unknown } | undefined)?.ruleset;
    const ruleset = bodyRuleset === "5e" ? "5e" : bodyRuleset === "5.5e" ? "5.5e" : undefined;
    const existing = ruleset
      ? db.prepare("SELECT id FROM compendium_monsters WHERE id = ? AND ruleset = ?").get(monsterId, ruleset)
      : db.prepare("SELECT id FROM compendium_monsters WHERE id = ?").get(monsterId);
    if (!existing)
      return res.status(404).json({ ok: false, message: "Monster not found" });
    saveGrandEntry(db, "monsters", req.body, monsterId);
    ctx.broadcast("compendium:changed", { monsterUpdated: monsterId });
    res.json({ ok: true });
  });

  // MARK: - DELETE /api/compendium/monsters/:monsterId
  app.delete("/api/compendium/monsters/:monsterId", anyDm, (req, res) => {
    const monsterId = requireParam(req, res, "monsterId");
    if (!monsterId) return;
    const ruleset = parseRulesetFilter(req.query.ruleset);
    const matches = db.prepare("SELECT ruleset FROM compendium_monsters WHERE id = ?").all(monsterId) as Array<{ ruleset: string }>;
    if (!ruleset && matches.length > 1) {
      return res.status(409).json({ ok: false, message: "Monster ID exists in multiple rulesets; specify the ruleset to delete." });
    }
    if (ruleset) db.prepare("DELETE FROM compendium_monsters WHERE id = ? AND ruleset = ?").run(monsterId, ruleset);
    else db.prepare("DELETE FROM compendium_monsters WHERE id = ?").run(monsterId);
    ctx.broadcast("compendium:changed", { monsterDeleted: monsterId });
    res.json({ ok: true });
  });

  // Monster search

  // MARK: - Monster search filters
  type MonsterQuery = Record<string, unknown>;

  /**
   * Build the shared WHERE clauses for a monster search. /search and /monsters/letters both run
   * through this, so the jump bar's row indices always refer to the list actually on screen.
   */
  function buildMonsterFilters(query: MonsterQuery): { clauses: string[]; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];

    const q = String(query.q ?? "").trim().toLowerCase();
    if (q) {
      clauses.push("AND (name LIKE ? OR name_key LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like);
    }

    const crMin = parseCrFilterValue(query.crMin);
    if (crMin != null && Number.isFinite(crMin)) {
      clauses.push("AND cr_numeric >= ?");
      params.push(crMin);
    }
    const crMax = parseCrFilterValue(query.crMax);
    if (crMax != null && Number.isFinite(crMax)) {
      clauses.push("AND cr_numeric <= ?");
      params.push(crMax);
    }

    const types = query.types ? String(query.types).split(",").filter(Boolean) : null;
    if (types?.length) {
      clauses.push(`AND type_key IN (${types.map(() => "?").join(",")})`);
      params.push(...types);
    }

    const sizes = query.sizes ? String(query.sizes).split(",").filter(Boolean) : null;
    if (sizes?.length) {
      clauses.push(`AND size IN (${sizes.map(() => "?").join(",")})`);
      params.push(...sizes);
    }

    const environments = query.env ? String(query.env).split(",").filter(Boolean) : null;
    if (environments?.length) {
      const envClauses: string[] = [];
      for (const envRaw of environments) {
        const env = envRaw.trim().toLowerCase();
        if (!env) continue;
        envClauses.push("LOWER(environment) LIKE ?");
        params.push(`%${env}%`);
      }
      if (envClauses.length > 0) clauses.push(`AND (${envClauses.join(" OR ")})`);
    }

    const ruleset = parseRulesetFilter(query.ruleset);
    if (ruleset) {
      clauses.push("AND ruleset = ?");
      params.push(ruleset);
    }

    return { clauses, params };
  }

  // Alphabetical order ignores a leading "The", so "The Abbot" files under A rather than sitting
  // among the Ts -- the ordinary index convention, and the same rule normalizeMonsterSortName
  // applies for the A-Z jump bar. Without this the bar and the list disagree about where A starts.
  //
  // The underscore is escaped because LIKE reads a bare _ as a single-character wildcard, which
  // would make 'the_%' also match "Theodore" and sort it under O. "!" is the escape character
  // rather than the usual backslash simply because it needs no escaping of its own here.
  const MONSTER_SORT_KEY =
    "CASE WHEN name_key LIKE 'the!_%' ESCAPE '!' THEN substr(name_key, 5) ELSE name_key END";

  function monsterOrderBy(rawSort: unknown): string {
    const sort = String(rawSort ?? "az").trim();
    if (sort === "crAsc") return `ORDER BY cr_numeric ASC, ${MONSTER_SORT_KEY} ASC`;
    if (sort === "crDesc") return `ORDER BY cr_numeric DESC, ${MONSTER_SORT_KEY} ASC`;
    return `ORDER BY ${MONSTER_SORT_KEY} ASC`;
  }

  // MARK: - GET /api/compendium/search
  app.get("/api/compendium/search", (req, res) => {
    applySharedApiCacheHeaders(res);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1),
      MAX_MONSTER_SEARCH_LIMIT,
    );
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
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

    const { clauses, params } = buildMonsterFilters(req.query);
    const parts: string[] = [
      "SELECT id, ruleset, name, cr, cr_numeric, type_key, size, environment FROM compendium_monsters WHERE 1=1",
      ...clauses,
      monsterOrderBy(req.query.sort),
      `LIMIT ${limit} OFFSET ${offset}`,
    ];
    const countParts: string[] = ["SELECT count(*) AS n FROM compendium_monsters WHERE 1=1", ...clauses];

    const rows = db.prepare(parts.join(" ")).all(...params) as {
      id: string; ruleset: "5e" | "5.5e"; name: string; cr: string | null; cr_numeric: number | null;
      type_key: string | null; size: string | null; environment: string | null;
    }[];
    const outRows = rows.map((r) => ({
      ...(includeField("id") ? { id: r.id } : {}),
      ...(includeField("ruleset") ? { ruleset: r.ruleset } : {}),
      ...(includeField("name") ? { name: r.name } : {}),
      ...(includeField("cr") ? { cr: r.cr ?? r.cr_numeric ?? 0 } : {}),
      ...(includeField("type") ? { type: r.type_key ?? "" } : {}),
      ...(includeField("environment") ? { environment: r.environment ?? "" } : {}),
      ...(includeField("size") ? { size: r.size ?? "" } : {}),
    }));
    if (!withTotal) return res.json(outRows);

    const total = (db.prepare(countParts.join(" ")).get(...params) as { n: number }).n;
    return res.json({ rows: outRows, total });
  });

}
