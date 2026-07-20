import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { parseStoredGrandEntry } from "../../services/compendium/storedCompendium.js";

const KINDS = new Set(["invocation", "maneuver", "metamagic"]);

export function registerClassTalentRoutes(app: Express, ctx: ServerContext, _anyDm: RequestHandler) {
  const { db } = ctx;

  app.get("/api/class-talents/search", (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 300 });
    const q = String(req.query.q ?? "").trim();
    const kind = String(req.query.kind ?? "").trim().toLowerCase();
    const includeText = String(req.query.includeText ?? "") === "1";
    const limit = Math.min(250, Math.max(1, Number(req.query.limit) || 150));
    if (kind && !KINDS.has(kind)) return res.status(400).json({ message: "Unknown class talent kind." });

    const where: string[] = [];
    const params: unknown[] = [];
    if (kind) { where.push("kind = ?"); params.push(kind); }
    if (q) { where.push("(name LIKE ? OR name_key LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
    const sql = `SELECT id, name, kind, data_json FROM compendium_class_talents${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY name COLLATE NOCASE LIMIT ${limit}`;
    const rows = db.prepare(sql).all(...params) as Array<{ id: string; name: string; kind: string; data_json: string }>;
    return res.json(rows.map((row) => {
      const entry = parseStoredGrandEntry("classTalents", row.data_json);
      return {
        id: row.id,
        ruleset: entry.ruleset,
        name: row.name,
        kind: row.kind,
        level: 0,
        prerequisite: entry.prerequisite ?? null,
        repeatable: entry.repeatable === true,
        effects: entry.effects ?? [],
        ...(includeText ? { text: Array.isArray(entry.description) ? entry.description.join("\n") : "" } : {}),
      };
    }));
  });
}
