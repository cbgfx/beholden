import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { requireAdmin, requireAnyDm, requireAuth } from "../middleware/auth.js";
import { parseFeat } from "../lib/featParser.js";
import { parseBackgroundProficiencies } from "../lib/proficiencyConstants.js";

// ── Schemas ───────────────────────────────────────────────────────────────────

const BlockSchema = z.object({ name: z.string(), text: z.string() });

const MonsterBody = z.object({
  name: z.string().trim().min(1),
  cr: z.string().trim().nullable().optional(),
  typeFull: z.string().trim().nullable().optional(),
  size: z.string().trim().nullable().optional(),
  environment: z.string().trim().nullable().optional(),
  ac: z.string().trim().nullable().optional(),
  hp: z.string().trim().nullable().optional(),
  speed: z.string().trim().nullable().optional(),
  str: z.number().nullable().optional(),
  dex: z.number().nullable().optional(),
  con: z.number().nullable().optional(),
  int: z.number().nullable().optional(),
  wis: z.number().nullable().optional(),
  cha: z.number().nullable().optional(),
  save: z.string().trim().nullable().optional(),
  skill: z.string().trim().nullable().optional(),
  senses: z.string().trim().nullable().optional(),
  languages: z.string().trim().nullable().optional(),
  immune: z.string().trim().nullable().optional(),
  resist: z.string().trim().nullable().optional(),
  vulnerable: z.string().trim().nullable().optional(),
  conditionImmune: z.string().trim().nullable().optional(),
  trait:     z.array(BlockSchema).optional(),
  action:    z.array(BlockSchema).optional(),
  reaction:  z.array(BlockSchema).optional(),
  legendary: z.array(BlockSchema).optional(),
});

const ItemBody = z.object({
  name: z.string().trim().min(1),
  rarity: z.string().trim().nullable().optional(),
  type: z.string().trim().nullable().optional(),
  attunement: z.boolean().optional(),
  magic: z.boolean().optional(),
  weight: z.number().nullable().optional(),
  value: z.number().nullable().optional(),
  dmg1: z.string().trim().nullable().optional(),
  dmg2: z.string().trim().nullable().optional(),
  dmgType: z.string().trim().nullable().optional(),
  properties: z.array(z.string()).optional(),
  modifiers: z.array(z.object({ category: z.string(), text: z.string() })).optional(),
  text: z.union([z.string(), z.array(z.string())]).optional(),
});

const SpellBody = z.object({
  name: z.string().trim().min(1),
  level: z.number().int().min(0).max(9).nullable().optional(),
  school: z.string().trim().nullable().optional(),
  time: z.string().trim().nullable().optional(),
  range: z.string().trim().nullable().optional(),
  components: z.string().trim().nullable().optional(),
  duration: z.string().trim().nullable().optional(),
  classes: z.string().trim().nullable().optional(),
  ritual: z.boolean().optional(),
  text: z.union([z.string(), z.array(z.string())]).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCrToNumeric(cr: string | null): number | null {
  if (!cr) return null;
  const s = cr.trim();
  if (s.includes("/")) {
    const parts = s.split("/").map(Number);
    const [n, d] = [parts[0] ?? 0, parts[1] ?? 0];
    return d ? n / d : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBlocks(v: unknown): Array<{ name: string; text: string }> {
  if (!Array.isArray(v)) return [];
  return (v as Array<Record<string, unknown>>)
    .filter((b) => b && typeof b === "object")
    .map((b) => ({ name: String(b.name ?? b.title ?? ""), text: String(b.text ?? b.description ?? "") }));
}

type MonsterBodyType = z.infer<typeof MonsterBody>;

function buildMonsterRecord(id: string, b: MonsterBodyType) {
  const name = b.name;
  const nameKey = name.toLowerCase().replace(/\s+/g, " ");
  const cr = b.cr?.trim() || null;
  const typeFull = b.typeFull?.trim() || null;
  const typeKey = typeFull ? (typeFull.trim().split(/\s+/)[0] ?? "").toLowerCase() : null;
  const size = b.size?.trim() || null;
  const environment = b.environment?.trim() || null;
  const numField = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? v : null);
  const data = {
    id, name, nameKey, name_key: nameKey,
    cr, typeFull, type_full: typeFull,
    typeKey, type_key: typeKey,
    size, environment,
    ac: b.ac?.trim() || null,
    hp: b.hp?.trim() || null,
    speed: b.speed?.trim() || null,
    str: numField(b.str), dex: numField(b.dex), con: numField(b.con),
    int: numField(b.int), wis: numField(b.wis), cha: numField(b.cha),
    save:            b.save?.trim()            || null,
    skill:           b.skill?.trim()           || null,
    senses:          b.senses?.trim()          || null,
    languages:       b.languages?.trim()       || null,
    immune:          b.immune?.trim()          || null,
    resist:          b.resist?.trim()          || null,
    vulnerable:      b.vulnerable?.trim()      || null,
    conditionImmune: b.conditionImmune?.trim() || null,
    trait:     toBlocks(b.trait),
    action:    toBlocks(b.action),
    reaction:  toBlocks(b.reaction),
    legendary: toBlocks(b.legendary),
    spellcasting: [], spells: [],
  };
  return { name, nameKey, cr, crNumeric: parseCrToNumeric(cr), typeKey, typeFull, size, environment, data };
}

type ItemBodyType = z.infer<typeof ItemBody>;

function buildItemRecord(id: string, b: ItemBodyType) {
  const name = b.name;
  const nameKey = name.toLowerCase().replace(/\s+/g, " ");
  const rarityVal = b.rarity?.trim().toLowerCase() || null;
  const typeVal   = b.type?.trim() || null;
  const typeKeyVal = typeVal ? typeVal.toLowerCase().replace(/\s+/g, "_") : null;
  const attunement = b.attunement ? 1 : 0;
  const magic      = b.magic      ? 1 : 0;
  const textArr = Array.isArray(b.text)
    ? b.text
    : typeof b.text === "string" ? [b.text] : [];
  const data = {
    id, name, nameKey, name_key: nameKey,
    rarity: rarityVal, type: typeVal, typeKey: typeKeyVal, type_key: typeKeyVal,
    attunement, magic,
    weight: b.weight ?? null,
    value: b.value ?? null,
    dmg1: b.dmg1?.trim() || null,
    dmg2: b.dmg2?.trim() || null,
    dmgType: b.dmgType?.trim() || null,
    properties: b.properties ?? [],
    modifiers: b.modifiers ?? [],
    text: textArr,
  };
  return { name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, data };
}

function baseItemName(name: string): string | null {
  return String(name).replace(/\s+\[2024\]\s*$/i, "").trim() || null;
}

type SpellBodyType = z.infer<typeof SpellBody>;

function buildSpellRecord(id: string, b: SpellBodyType) {
  const name = b.name;
  const nameKey = name.toLowerCase().replace(/\s+/g, " ");
  const levelVal = b.level ?? null;
  const schoolVal     = b.school?.trim()     || null;
  const componentsVal = b.components?.trim() || null;
  const durationVal   = b.duration?.trim()   || null;
  const classesVal    = b.classes?.trim()    || null;
  const isRitual        = b.ritual ? 1 : 0;
  const isConcentration = /concentration/i.test(durationVal ?? "") ? 1 : 0;
  const data = {
    id, name, nameKey, name_key: nameKey,
    baseName: name, baseKey: nameKey.replace(/\s/g, "_"), base_key: nameKey.replace(/\s/g, "_"),
    level: levelVal, school: schoolVal,
    ritual: isRitual, concentration: isConcentration,
    time:       b.time?.trim()  || null,
    range:      b.range?.trim() || null,
    components: componentsVal,
    duration:   durationVal,
    classes:    classesVal,
    text: Array.isArray(b.text) ? b.text : typeof b.text === "string" ? [b.text] : [],
  };
  return { name, nameKey, levelVal, schoolVal, isRitual, isConcentration, componentsVal, classesVal, data };
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerCompendiumRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const anyDm = requireAnyDm(db);

  // --- Monsters ------------------------------------------------------------
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

  // --- Items ---------------------------------------------------------------
  app.get("/api/compendium/items", (_req, res) => {
    const rawRows = db
      .prepare("SELECT id, name, rarity, type, type_key, attunement, magic FROM compendium_items ORDER BY name COLLATE NOCASE")
      .all() as { id: string; name: string; rarity: string | null; type: string | null; type_key: string | null; attunement: number; magic: number; }[];
    const rarityByBaseName = new Map<string, string>();
    for (const row of rawRows) {
      const baseName = baseItemName(row.name);
      if (row.rarity && baseName) rarityByBaseName.set(baseName, row.rarity);
    }
    res.json(rawRows.map((r) => {
      const baseName = baseItemName(r.name);
      return {
        id: r.id, name: r.name,
        rarity: r.rarity ?? (baseName ? rarityByBaseName.get(baseName) ?? null : null),
        type: r.type ?? null, typeKey: r.type_key ?? null,
        attunement: Boolean(r.attunement), magic: Boolean(r.magic),
      };
    }));
  });

  app.get("/api/compendium/items/:itemId", (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    const row = db
      .prepare("SELECT id, name, name_key, rarity, type, type_key, attunement, magic, data_json FROM compendium_items WHERE id = ?")
      .get(itemId) as Record<string, unknown> | undefined;
    if (!row)
      return res.status(404).json({ ok: false, message: "Item not found in compendium" });
    const it = JSON.parse(row.data_json as string);
    const rowBaseName = baseItemName(String(row.name));
    const fallbackRarity = row.rarity == null && rowBaseName
      ? ((db.prepare("SELECT rarity FROM compendium_items WHERE name = ?").get(rowBaseName) as { rarity: string | null } | undefined)?.rarity ?? null)
      : null;
    res.json({
      id: row.id, name: row.name, nameKey: row.name_key ?? null,
      rarity: row.rarity ?? fallbackRarity, type: row.type ?? null, typeKey: row.type_key ?? null,
      attunement: Boolean(row.attunement), magic: Boolean(row.magic),
      weight: it.weight ?? null,
      value: it.value ?? null,
      dmg1: it.dmg1 ?? null,
      dmg2: it.dmg2 ?? null,
      dmgType: it.dmgType ?? null,
      properties: it.properties ?? [],
      modifiers: it.modifiers ?? [],
      text: Array.isArray(it.text) ? it.text : (it.text ? [it.text] : []),
    });
  });

  app.post("/api/compendium/items", anyDm, (req, res) => {
    const b = parseBody(ItemBody, req);
    const id = `i_${b.name.toLowerCase().replace(/\s+/g, "_")}`;
    const { name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, data } = buildItemRecord(id, b);
    db.prepare("INSERT OR REPLACE INTO compendium_items (id, name, name_key, rarity, type, type_key, attunement, magic, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, JSON.stringify(data));
    ctx.broadcast("compendium:changed", { itemCreated: id });
    res.json({ ok: true, id });
  });

  app.put("/api/compendium/items/:itemId", anyDm, (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    if (!db.prepare("SELECT id FROM compendium_items WHERE id = ?").get(itemId))
      return res.status(404).json({ ok: false, message: "Item not found" });
    const b = parseBody(ItemBody, req);
    const { name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, data } = buildItemRecord(itemId, b);
    db.prepare("UPDATE compendium_items SET name = ?, name_key = ?, rarity = ?, type = ?, type_key = ?, attunement = ?, magic = ?, data_json = ? WHERE id = ?")
      .run(name, nameKey, rarityVal, typeVal, typeKeyVal, attunement, magic, JSON.stringify(data), itemId);
    ctx.broadcast("compendium:changed", { itemUpdated: itemId });
    res.json({ ok: true });
  });

  app.delete("/api/compendium/items/:itemId", anyDm, (req, res) => {
    const itemId = requireParam(req, res, "itemId");
    if (!itemId) return;
    db.prepare("DELETE FROM compendium_items WHERE id = ?").run(itemId);
    ctx.broadcast("compendium:changed", { itemDeleted: itemId });
    res.json({ ok: true });
  });

  // --- Monster search -------------------------------------------------------
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

  // --- Spells --------------------------------------------------------------
  app.get("/api/spells/search", (req, res) => {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 500);
    const levelRaw = String(req.query.level ?? "").trim();
    const level = levelRaw === "" ? null : Number(levelRaw);
    // maxLevel: for Warlock-style "up to slot level N" queries
    const maxLevelRaw = String(req.query.maxLevel ?? "").trim();
    const maxLevel = maxLevelRaw === "" ? null : Number(maxLevelRaw);
    // classes: comma-separated list of class names to filter by (OR logic)
    const classesFilter = String(req.query.classes ?? "").trim();

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
      // Support comma-separated OR: "Warlock,Warlock [2024]"
      const cls = classesFilter.split(",").map(s => s.trim()).filter(Boolean);
      const orParts = cls.map(() => "classes LIKE ?");
      parts.push(`AND (${orParts.join(" OR ")})`);
      params.push(...cls.map(c => `%${c}%`));
    }
    parts.push("ORDER BY level NULLS LAST, name COLLATE NOCASE");
    parts.push(`LIMIT ${limit}`);

    const rows = db.prepare(parts.join(" ")).all(...params) as {
      id: string; name: string; level: number | null; school: string | null;
      ritual: number; concentration: number; components: string | null; classes: string | null; data_json: string;
    }[];
    res.json(rows.map((row) => {
      const s = JSON.parse(row.data_json);
      const textArr: string[] = Array.isArray(s.text) ? s.text : (s.text ? [s.text] : []);
      return {
        id: row.id, name: row.name, level: row.level, school: row.school,
        time: s.time ?? null,
        ritual: row.ritual === 1, concentration: row.concentration === 1,
        components: row.components ?? s.components ?? null,
        classes: row.classes ?? s.classes ?? null,
        text: textArr.join("\n") || null,
      };
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
    ctx.broadcast("compendium:changed", { spellUpdated: spellId });
    res.json({ ok: true });
  });

  app.delete("/api/spells/:spellId", anyDm, (req, res) => {
    const spellId = requireParam(req, res, "spellId");
    if (!spellId) return;
    db.prepare("DELETE FROM compendium_spells WHERE id = ?").run(spellId);
    ctx.broadcast("compendium:changed", { spellDeleted: spellId });
    res.json({ ok: true });
  });

  // --- Classes ---------------------------------------------------------------
  app.get("/api/compendium/classes", requireAuth, (_req, res) => {
    const rows = db.prepare("SELECT id, name, hd FROM compendium_classes ORDER BY name COLLATE NOCASE").all() as { id: string; name: string; hd: number | null }[];
    res.json(rows);
  });

  app.get("/api/compendium/classes/:id", requireAuth, (req, res) => {
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_classes WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json(JSON.parse(row.data_json));
  });

  // --- Races -----------------------------------------------------------------
  app.get("/api/compendium/races", requireAuth, (_req, res) => {
    const rows = db.prepare("SELECT id, name, size, speed FROM compendium_races ORDER BY name COLLATE NOCASE").all() as { id: string; name: string; size: string | null; speed: number | null }[];
    res.json(rows);
  });

  app.get("/api/compendium/races/:id", requireAuth, (req, res) => {
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_races WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json(JSON.parse(row.data_json));
  });

  // --- Backgrounds -----------------------------------------------------------
  app.get("/api/compendium/backgrounds", requireAuth, (_req, res) => {
    const rows = db.prepare("SELECT id, name FROM compendium_backgrounds ORDER BY name COLLATE NOCASE").all() as { id: string; name: string }[];
    res.json(rows);
  });

  app.get("/api/compendium/backgrounds/:id", requireAuth, (req, res) => {
    const id = requireParam(req, res, "id");
    if (!id) return;
    const row = db.prepare("SELECT data_json FROM compendium_backgrounds WHERE id = ?").get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const bg = JSON.parse(row.data_json);
    const featEntries = Array.isArray(bg.proficiencies?.feats) ? bg.proficiencies.feats : [];
    const needsBgParsing =
      !bg.proficiencies ||
      featEntries.some((feat: unknown) =>
        typeof feat === "string" ||
        !feat ||
        typeof feat !== "object" ||
        !("parsed" in feat)
      );
    if (needsBgParsing) {
      bg.proficiencies = parseBackgroundProficiencies({
        proficiency: bg.proficiency,
        trait: bg.traits,
      });
    }
    res.json(bg);
  });

  // --- Feats -----------------------------------------------------------------
  app.get("/api/compendium/feats", requireAuth, (_req, res) => {
    const rows = db.prepare("SELECT id, name FROM compendium_feats ORDER BY name COLLATE NOCASE").all() as { id: string; name: string }[];
    res.json(rows);
  });

  app.get("/api/compendium/feats/:featId", requireAuth, (req, res) => {
    const featId = requireParam(req, res, "featId");
    if (!featId) return;
    const row = db.prepare("SELECT data_json FROM compendium_feats WHERE id = ?").get(featId) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Feat not found" });
    const feat = JSON.parse(row.data_json);
    if (!feat.parsed) {
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
    }
    res.json(feat);
  });

  // --- Admin / import -------------------------------------------------------
  app.delete("/api/compendium", requireAdmin, (_req, res) => {
    db.transaction(() => {
      db.prepare("DELETE FROM compendium_monsters").run();
      db.prepare("DELETE FROM compendium_items").run();
      db.prepare("DELETE FROM compendium_spells").run();
      db.prepare("DELETE FROM compendium_classes").run();
      db.prepare("DELETE FROM compendium_races").run();
      db.prepare("DELETE FROM compendium_backgrounds").run();
      db.prepare("DELETE FROM compendium_feats").run();
    })();
    ctx.broadcast("compendium:changed", { cleared: true });
    res.json({ ok: true });
  });

  app.post("/api/compendium/import/xml", requireAdmin, ctx.upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });
    const xml = req.file.buffer.toString("utf-8");
    const out = ctx.helpers.importCompendiumXml({ xml });
    ctx.broadcast("compendium:changed", { imported: out.imported, total: out.total });
    res.json({
      ok: true,
      imported: out.imported,
      total: out.total,
      classes: out.classes ?? 0,
      races: out.races ?? 0,
      backgrounds: out.backgrounds ?? 0,
      feats: out.feats ?? 0,
    });
  });
}
