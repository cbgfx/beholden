import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";

export function registerCompendiumRoutes(app: Express, ctx: ServerContext) {
  // --- Monsters ------------------------------------------------------------
  app.get("/api/compendium/monsters/:monsterId", (req, res) => {
    const monsterId = requireParam(req, res, "monsterId");
    if (!monsterId) return;
    const m = ctx.compendium.state.monsters.find((x) => x.id === monsterId)
    if (!m) return res.status(404).json({ ok: false, message: "Monster not found in compendium" });

    res.json({
      id: m.id,
      name: m.name,
      nameKey: m.nameKey,
      cr: m.cr ?? null,
      xp: m.xp ?? null,
      typeFull: m.typeFull ?? null,
      typeKey: m.typeKey ?? null,
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

  // Lightweight index for the full compendium list (used by Monster Picker).
  app.get("/api/compendium/monsters", (_req, res) => {
    const rows = ctx.compendium.state.monsters.map((m: any) => {
      const raw = m;
      const rawCr = raw?.cr ?? raw?.challenge_rating;
      const mCr = m?.cr;

      const cr =
        typeof rawCr === "string" && rawCr.trim().includes("/")
          ? rawCr.trim()
          : rawCr ??
            (typeof mCr === "string" && mCr.trim().includes("/") ? mCr.trim() : mCr) ??
            0;

      const env = (() => {
        const v = raw?.environment ?? raw?.environments ?? m?.environment;
        if (Array.isArray(v)) return v.join(", ");
        if (typeof v === "string") return v;
        return "";
      })();

      const type = (() => {
        const v = raw?.type ?? m?.type;
        if (typeof v === "string") return v;
        if (v && typeof v === "object" && typeof v.type === "string") return v.type;
        return "";
      })();

      return { id: m.id, name: m.name, cr, type, environment: env };
    });

    res.json(rows);
  });

  // --- Items ---------------------------------------------------------------
  app.get("/api/compendium/items", (_req, res) => {
    const rows = ctx.compendium.state.items.map((it) => ({
      id: it.id,
      name: it.name,
      rarity: it.rarity ?? null,
      type: it.type ?? null,
      typeKey: it.typeKey ?? null,
      attunement: Boolean(it.attunement),
      magic: Boolean(it.magic),
    }));
    res.json(rows);
  });

  app.get("/api/compendium/items/:itemId", (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const it = ctx.compendium.state.items.find((x) => x.id === itemId);
    if (!it) return res.status(404).json({ ok: false, message: "Item not found in compendium" });
    res.json({
      id: it.id,
      name: it.name,
      nameKey: it.nameKey,
      rarity: it.rarity ?? null,
      type: it.type ?? null,
      typeKey: it.typeKey ?? null,
      attunement: Boolean(it.attunement),
      magic: Boolean(it.magic),
      text: it.text ?? "",
    });
  });

  // --- Monster search ------------------------------------------------------
  app.get("/api/compendium/search", (req, res) => {
    const q = req.query.q ?? "";
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
    const filters = {
      crMin: req.query.crMin != null ? Number(req.query.crMin) : null,
      crMax: req.query.crMax != null ? Number(req.query.crMax) : null,
      types: req.query.types ? String(req.query.types).split(",").filter(Boolean) : null,
      sizes: req.query.sizes ? String(req.query.sizes).split(",").filter(Boolean) : null,
      environments: req.query.env ? String(req.query.env).split(",").filter(Boolean) : null,
    };
    res.json(ctx.compendium.searchMonsters(String(q), filters, limit));
  });

  // --- Spells --------------------------------------------------------------
  app.get("/api/spells/search", (req, res) => {
    const qRaw = String(req.query.q ?? "").trim();
    const q = qRaw.toLowerCase();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 500);
    const levelRaw = String(req.query.level ?? "").trim();
    const level = levelRaw === "" ? null : Number(levelRaw);

    const out: any[] = [];
    for (const s of ctx.compendium.state.spells) {
      if (level != null && Number.isFinite(level)) {
        if (Number(s?.level ?? -999) !== level) continue;
      }

      if (q) {
        const hay = `${s.name} ${s.baseName ?? ""}`.toLowerCase();
        const keyHay = `${s.nameKey ?? ""} ${s.baseKey ?? ""}`;
        if (!hay.includes(q) && !String(keyHay).includes(q)) continue;
      }

      out.push({ id: s.id, name: s.name, level: s.level, school: s.school, time: s.time });
    }

    out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    res.json(out.slice(0, limit));
  });

  app.get("/api/spells/:spellId", (req, res) => {
    const spellId = requireParam(req, res, "spellId");
    if (!spellId) return;
    const s = ctx.compendium.state.spells.find((x: any) => x.id === spellId);
    if (!s) return res.status(404).json({ ok: false, message: "Spell not found in compendium" });
    res.json(s);
  });

  // --- Admin / import ------------------------------------------------------
  app.delete("/api/compendium", (_req, res) => {
    ctx.compendium.clear();
    ctx.broadcast("compendium:changed", { cleared: true });
    res.json({ ok: true });
  });

  app.post("/api/compendium/import/xml", ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });

    const xml = req.file.buffer.toString("utf-8");
    const out = ctx.helpers.importCompendiumXml({ xml });

    ctx.broadcast("compendium:changed", { imported: out.imported, total: out.total });
    res.json({ ok: true, imported: out.imported, total: out.total });
  });
}
