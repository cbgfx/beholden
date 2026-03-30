// server/src/routes/compendium/monsters.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../shared/validate.js";
import { MonsterBody, buildMonsterRecord, parseCrToNumeric } from "./helpers.js";

export function registerMonsterRoutes(app: Express, ctx: ServerContext, anyDm: RequestHandler) {
  const { db } = ctx;

  app.get("/api/compendium/monsters/:monsterId", (req, res) => {
    const monsterId = requireParam(req, res, "monsterId");
    if (!monsterId) return;
    const row = db
      .prepare("SELECT data_json FROM compendium_monsters WHERE id = ?")
      .get(monsterId) as { data_json: string } | undefined;
    if (!row)
      return res.status(404).json({ ok: false, message: "Monster not found in compendium" });

    const m = JSON.parse(row.data_json);
    res.json({
      id: m.id,
      name: m.name,
      nameKey: m.nameKey ?? m.name_key ?? null,
      cr: m.cr ?? null,
      xp: m.xp ?? null,
      typeFull: m.typeFull ?? m.type_full ?? null,
      typeKey: m.typeKey ?? m.type_key ?? null,
      size: m.size ?? null,
      environment: m.environment ?? null,
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
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
    const crMin = req.query.crMin != null ? Number(req.query.crMin) : null;
    const crMax = req.query.crMax != null ? Number(req.query.crMax) : null;
    const types = req.query.types ? String(req.query.types).split(",").filter(Boolean) : null;
    const sizes = req.query.sizes ? String(req.query.sizes).split(",").filter(Boolean) : null;
    const environments = req.query.env ? String(req.query.env).split(",").filter(Boolean) : null;

    const parts: string[] = ["SELECT id, name, cr, cr_numeric, type_key, size, environment FROM compendium_monsters WHERE 1=1"];
    const params: unknown[] = [];

    if (q) { parts.push("AND (name LIKE ? OR name_key LIKE ?)"); const like = `%${q}%`; params.push(like, like); }
    if (crMin != null && Number.isFinite(crMin)) { parts.push("AND cr_numeric >= ?"); params.push(crMin); }
    if (crMax != null && Number.isFinite(crMax)) { parts.push("AND cr_numeric <= ?"); params.push(crMax); }
    if (types?.length) { parts.push(`AND type_key IN (${types.map(() => "?").join(",")})`); params.push(...types); }
    if (sizes?.length) { parts.push(`AND size IN (${sizes.map(() => "?").join(",")})`); params.push(...sizes); }
    if (environments?.length) { parts.push(`AND environment IN (${environments.map(() => "?").join(",")})`); params.push(...environments); }
    parts.push(`LIMIT ${limit}`);

    const rows = db.prepare(parts.join(" ")).all(...params) as {
      id: string; name: string; cr: string | null; cr_numeric: number | null;
      type_key: string | null; size: string | null; environment: string | null;
    }[];
    res.json(rows.map((r) => ({
      id: r.id, name: r.name, cr: r.cr ?? r.cr_numeric ?? 0,
      type: r.type_key ?? "", environment: r.environment ?? "", size: r.size ?? "",
    })));
  });
}
