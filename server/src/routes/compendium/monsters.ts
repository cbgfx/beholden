// server/src/routes/compendium/monsters.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { parseBody } from "../../shared/validate.js";
import { MonsterBody, buildMonsterRecord } from "./helpers.js";

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

  app.get("/api/compendium/monsters/facets", (_req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const rows = db
      .prepare("SELECT type_key, size, environment FROM compendium_monsters")
      .all() as Array<{ type_key: string | null; size: string | null; environment: string | null }>;
    const envSet = new Set<string>();
    const typeSet = new Set<string>();
    const sizeSet = new Set<string>();
    for (const row of rows) {
      const typeKey = String(row.type_key ?? "").trim();
      if (typeKey) typeSet.add(typeKey);
      const size = String(row.size ?? "").trim();
      if (size) sizeSet.add(size);
      const envRaw = String(row.environment ?? "").trim();
      if (!envRaw) continue;
      for (const part of envRaw.split(",").map((value) => value.trim()).filter(Boolean)) {
        envSet.add(part);
      }
    }
    res.json({
      environments: Array.from(envSet).sort((a, b) => a.localeCompare(b)),
      sizes: Array.from(sizeSet).sort((a, b) => a.localeCompare(b)),
      types: Array.from(typeSet).sort((a, b) => a.localeCompare(b)),
    });
  });

  app.get("/api/compendium/monsters/:monsterId", (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const monsterId = requireParam(req, res, "monsterId");
    if (!monsterId) return;
    const view = String(req.query.view ?? "").trim().toLowerCase();
    const metricsOnly = view === "metrics" || view === "summary";
    const row = db
      .prepare("SELECT id, name, name_key, cr, type_key, type_full, size, environment, data_json FROM compendium_monsters WHERE id = ?")
      .get(monsterId) as {
      id: string;
      name: string;
      name_key: string | null;
      cr: string | null;
      type_key: string | null;
      type_full: string | null;
      size: string | null;
      environment: string | null;
      data_json: string;
    } | undefined;
    if (!row)
      return res.status(404).json({ ok: false, message: "Monster not found in compendium" });

    const m = JSON.parse(row.data_json ?? "{}");
    if (metricsOnly) {
      return res.json({
        id: row.id,
        name: row.name,
        cr: row.cr ?? m.cr ?? null,
        xp: m.xp ?? null,
        action: m.action ?? [],
        legendary: m.legendary ?? [],
        _summaryOnly: true,
      });
    }
    res.json({
      id: row.id,
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
      trait: m.trait ?? [],
      action: m.action ?? [],
      reaction: m.reaction ?? [],
      legendary: m.legendary ?? [],
      spellcasting: m.spellcasting ?? [],
      spells: m.spells ?? [],
    });
  });

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
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(row.data_json ?? "{}") as Record<string, unknown>;
      } catch {
        parsed = {};
      }
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

  app.post("/api/compendium/monsters", anyDm, (req, res) => {
    const b = parseBody(MonsterBody, req);
    const id = `m_${b.name.toLowerCase().replace(/\s+/g, "_")}`;
    const { name, nameKey, cr, crNumeric, typeKey, typeFull, size, environment, data } =
      buildMonsterRecord(id, b);
    db.prepare(
      "INSERT OR REPLACE INTO compendium_monsters (id, name, name_key, cr, cr_numeric, type_key, type_full, size, environment, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, name, nameKey, cr, crNumeric, typeKey, typeFull, size, environment, JSON.stringify(data));
    ctx.broadcast("compendium:changed", { monsterCreated: id });
    res.json({ ok: true, id });
  });

  app.put("/api/compendium/monsters/:monsterId", anyDm, (req, res) => {
    const monsterId = requireParam(req, res, "monsterId");
    if (!monsterId) return;
    if (!db.prepare("SELECT id FROM compendium_monsters WHERE id = ?").get(monsterId))
      return res.status(404).json({ ok: false, message: "Monster not found" });
    const b = parseBody(MonsterBody, req);
    const { name, nameKey, cr, crNumeric, typeKey, typeFull, size, environment, data } =
      buildMonsterRecord(monsterId, b);
    db.prepare(
      "UPDATE compendium_monsters SET name = ?, name_key = ?, cr = ?, cr_numeric = ?, type_key = ?, type_full = ?, size = ?, environment = ?, data_json = ? WHERE id = ?"
    ).run(name, nameKey, cr, crNumeric, typeKey, typeFull, size, environment, JSON.stringify(data), monsterId);
    ctx.broadcast("compendium:changed", { monsterUpdated: monsterId });
    res.json({ ok: true });
  });

  app.delete("/api/compendium/monsters/:monsterId", anyDm, (req, res) => {
    const monsterId = requireParam(req, res, "monsterId");
    if (!monsterId) return;
    db.prepare("DELETE FROM compendium_monsters WHERE id = ?").run(monsterId);
    ctx.broadcast("compendium:changed", { monsterDeleted: monsterId });
    res.json({ ok: true });
  });

  // Monster search
  app.get("/api/compendium/search", (req, res) => {
    applySharedApiCacheHeaders(res);
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1),
      MAX_MONSTER_SEARCH_LIMIT,
    );
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
    const crMin = parseCrFilterValue(req.query.crMin);
    const crMax = parseCrFilterValue(req.query.crMax);
    const types = req.query.types ? String(req.query.types).split(",").filter(Boolean) : null;
    const sizes = req.query.sizes ? String(req.query.sizes).split(",").filter(Boolean) : null;
    const environments = req.query.env ? String(req.query.env).split(",").filter(Boolean) : null;
    const sortRaw = String(req.query.sort ?? "az").trim();
    const sort: "az" | "crAsc" | "crDesc" =
      sortRaw === "crAsc" || sortRaw === "crDesc" ? sortRaw : "az";
    const withTotalRaw = String(req.query.withTotal ?? "").trim().toLowerCase();
    const withTotal = withTotalRaw === "1" || withTotalRaw === "true" || withTotalRaw === "yes";

    const parts: string[] = ["SELECT id, name, cr, cr_numeric, type_key, size, environment FROM compendium_monsters WHERE 1=1"];
    const countParts: string[] = ["SELECT count(*) AS n FROM compendium_monsters WHERE 1=1"];
    const params: unknown[] = [];

    if (q) {
      parts.push("AND (name LIKE ? OR name_key LIKE ?)");
      countParts.push("AND (name LIKE ? OR name_key LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like);
    }
    if (crMin != null && Number.isFinite(crMin)) {
      parts.push("AND cr_numeric >= ?");
      countParts.push("AND cr_numeric >= ?");
      params.push(crMin);
    }
    if (crMax != null && Number.isFinite(crMax)) {
      parts.push("AND cr_numeric <= ?");
      countParts.push("AND cr_numeric <= ?");
      params.push(crMax);
    }
    if (types?.length) {
      const clause = `AND type_key IN (${types.map(() => "?").join(",")})`;
      parts.push(clause);
      countParts.push(clause);
      params.push(...types);
    }
    if (sizes?.length) {
      const clause = `AND size IN (${sizes.map(() => "?").join(",")})`;
      parts.push(clause);
      countParts.push(clause);
      params.push(...sizes);
    }
    if (environments?.length) {
      const envClauses: string[] = [];
      for (const envRaw of environments) {
        const env = envRaw.trim().toLowerCase();
        if (!env) continue;
        envClauses.push("LOWER(environment) LIKE ?");
        params.push(`%${env}%`);
      }
      if (envClauses.length > 0) {
        const clause = `AND (${envClauses.join(" OR ")})`;
        parts.push(clause);
        countParts.push(clause);
      }
    }
    if (sort === "crAsc") {
      parts.push("ORDER BY cr_numeric ASC, name_key ASC");
    } else if (sort === "crDesc") {
      parts.push("ORDER BY cr_numeric DESC, name_key ASC");
    } else {
      parts.push("ORDER BY name_key ASC");
    }
    parts.push(`LIMIT ${limit} OFFSET ${offset}`);

    const rows = db.prepare(parts.join(" ")).all(...params) as {
      id: string; name: string; cr: string | null; cr_numeric: number | null;
      type_key: string | null; size: string | null; environment: string | null;
    }[];
    const outRows = rows.map((r) => ({
      id: r.id, name: r.name, cr: r.cr ?? r.cr_numeric ?? 0,
      type: r.type_key ?? "", environment: r.environment ?? "", size: r.size ?? "",
    }));
    if (!withTotal) return res.json(outRows);

    const total = (db.prepare(countParts.join(" ")).get(...params) as { n: number }).n;
    return res.json({ rows: outRows, total });
  });

}
