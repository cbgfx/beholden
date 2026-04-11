// server/src/routes/compendium/spells.ts

import type { Express, RequestHandler } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../shared/validate.js";
import { SpellBody, buildSpellRecord } from "./helpers.js";
import { backfillMonsterSpellRefs } from "../../services/compendium/normalizeMonsterSpellRefs.js";

export function registerSpellRoutes(app: Express, ctx: ServerContext, anyDm: RequestHandler) {
  const { db } = ctx;

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

  app.get("/api/spells/search", (req, res) => {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 500);
    const includeTextRaw = String(req.query.includeText ?? "").trim().toLowerCase();
    const includeText = includeTextRaw === "1" || includeTextRaw === "true" || includeTextRaw === "yes";
    const excludeSpecialRaw = String(req.query.excludeSpecial ?? "").trim().toLowerCase();
    const excludeSpecial =
      excludeSpecialRaw === "1" || excludeSpecialRaw === "true" || excludeSpecialRaw === "yes";
    const levelRaw = String(req.query.level ?? "").trim();
    const level = levelRaw === "" ? null : Number(levelRaw);
    const maxLevelRaw = String(req.query.maxLevel ?? "").trim();
    const maxLevel = maxLevelRaw === "" ? null : Number(maxLevelRaw);
    const classesFilter = String(req.query.classes ?? "").trim();
    const schoolFilter = String(req.query.school ?? "").trim();
    const ritualRaw = String(req.query.ritual ?? "").trim().toLowerCase();
    const ritualOnly = ritualRaw === "1" || ritualRaw === "true" || ritualRaw === "yes";

    const parts: string[] = [
      "SELECT id, name, level, school, ritual, concentration, components, classes, data_json FROM compendium_spells WHERE 1=1",
    ];
    const params: unknown[] = [];

    if (q) { parts.push("AND (name LIKE ? OR name_key LIKE ?)"); const like = `%${q}%`; params.push(like, like); }
    if (level != null && Number.isFinite(level)) { parts.push("AND level = ?"); params.push(level); }
    const minLevelRaw = String(req.query.minLevel ?? "").trim();
    const minLevel = minLevelRaw === "" ? null : Number(minLevelRaw);
    if (minLevel != null && Number.isFinite(minLevel)) { parts.push("AND level >= ?"); params.push(minLevel); }
    if (maxLevel != null && Number.isFinite(maxLevel)) { parts.push("AND level <= ?"); params.push(maxLevel); }
    if (classesFilter) {
      const cls = classesFilter.split(",").map(s => s.trim()).filter(Boolean);
      const orParts = cls.map(() => "classes LIKE ?");
      parts.push(`AND (${orParts.join(" OR ")})`);
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
        params.push(...uniqueSchools.map((school) => `%${school}%`));
      }
    }
    if (ritualOnly) {
      parts.push("AND ritual = 1");
    }
    if (excludeSpecial) {
      // Hide non-spell option rows (kept in table for other game systems).
      parts.push("AND classes NOT LIKE ?");
      parts.push("AND classes NOT LIKE ?");
      parts.push("AND classes NOT LIKE ?");
      parts.push("AND classes NOT LIKE ?");
      params.push("%Eldritch Invocations%");
      params.push("%Maneuver Options%");
      params.push("%Metamagic Options%");
      params.push("%Infusion%");
    }
    parts.push("ORDER BY level NULLS LAST, name COLLATE NOCASE");
    parts.push(`LIMIT ${limit}`);

    const rows = db.prepare(parts.join(" ")).all(...params) as {
      id: string; name: string; level: number | null; school: string | null;
      ritual: number; concentration: number; components: string | null; classes: string | null; data_json: string;
    }[];
    res.json(rows.map((row) => {
      const s = JSON.parse(row.data_json);
      const out: Record<string, unknown> = {
        id: row.id, name: row.name, level: row.level, school: row.school,
        time: s.time ?? null,
        ritual: row.ritual === 1, concentration: row.concentration === 1,
        components: row.components ?? s.components ?? null,
        classes: row.classes ?? s.classes ?? null,
      };
      if (includeText) {
        const textArr: string[] = Array.isArray(s.text) ? s.text : (s.text ? [s.text] : []);
        out.text = textArr.join("\n") || null;
      }
      return out;
    }));
  });

  app.get("/api/spells/:spellId", (req, res) => {
    const spellId = requireParam(req, res, "spellId");
    if (!spellId) return;
    const row = db
      .prepare("SELECT data_json FROM compendium_spells WHERE id = ?")
      .get(spellId) as { data_json: string } | undefined;
    if (!row)
      return res.status(404).json({ ok: false, message: "Spell not found in compendium" });
    res.json(JSON.parse(row.data_json));
  });

  app.post("/api/spells", anyDm, (req, res) => {
    const b = parseBody(SpellBody, req);
    const nameKey = b.name.toLowerCase().replace(/\s+/g, " ");
    const id = `s_${nameKey.replace(/\s/g, "_")}`;
    const { name, levelVal, schoolVal, isRitual, isConcentration, componentsVal, classesVal, data } =
      buildSpellRecord(id, b);
    db.prepare(
      "INSERT OR REPLACE INTO compendium_spells (id, name, name_key, level, school, ritual, concentration, components, classes, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, name, nameKey, levelVal, schoolVal, isRitual, isConcentration, componentsVal, classesVal, JSON.stringify(data));
    backfillMonsterSpellRefs(db);
    ctx.broadcast("compendium:changed", { spellCreated: id });
    res.json({ ok: true, id });
  });

  app.put("/api/spells/:spellId", anyDm, (req, res) => {
    const spellId = requireParam(req, res, "spellId");
    if (!spellId) return;
    if (!db.prepare("SELECT id FROM compendium_spells WHERE id = ?").get(spellId))
      return res.status(404).json({ ok: false, message: "Spell not found" });
    const b = parseBody(SpellBody, req);
    const { name, nameKey, levelVal, schoolVal, isRitual, isConcentration, componentsVal, classesVal, data } =
      buildSpellRecord(spellId, b);
    db.prepare(
      "UPDATE compendium_spells SET name = ?, name_key = ?, level = ?, school = ?, ritual = ?, concentration = ?, components = ?, classes = ?, data_json = ? WHERE id = ?"
    ).run(name, nameKey, levelVal, schoolVal, isRitual, isConcentration, componentsVal, classesVal, JSON.stringify(data), spellId);
    backfillMonsterSpellRefs(db);
    ctx.broadcast("compendium:changed", { spellUpdated: spellId });
    res.json({ ok: true });
  });

  app.delete("/api/spells/:spellId", anyDm, (req, res) => {
    const spellId = requireParam(req, res, "spellId");
    if (!spellId) return;
    db.prepare("DELETE FROM compendium_spells WHERE id = ?").run(spellId);
    backfillMonsterSpellRefs(db);
    ctx.broadcast("compendium:changed", { spellDeleted: spellId });
    res.json({ ok: true });
  });
}
