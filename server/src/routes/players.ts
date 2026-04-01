// server/src/routes/players.ts
import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { rowToPlayer, PLAYER_COLS } from "../lib/db.js";
import { ConditionInstanceSchema, OverridesSchema } from "../lib/schemas.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import { ACCEPTED_IMAGE_TYPES, resizeToWebP } from "../lib/imageHelpers.js";
import { absolutizePublicUrl } from "../lib/publicUrl.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";

const PlayerCreateBody = z.object({
  playerName: z.string().trim().optional(),
  characterName: z.string().trim().optional(),
  class: z.string().trim().optional(),
  species: z.string().trim().optional(),
  level: z.number().int().optional(),
  hpMax: z.number().int().optional(),
  hpCurrent: z.number().int().optional(),
  ac: z.number().int().optional(),
  str: z.number().int().optional(),
  dex: z.number().int().optional(),
  con: z.number().int().optional(),
  int: z.number().int().optional(),
  wis: z.number().int().optional(),
  cha: z.number().int().optional(),
  color: z.string().optional(),
});

const PlayerUpdateBody = z.object({
  playerName: z.string().trim().optional(),
  characterName: z.string().trim().optional(),
  class: z.string().trim().optional(),
  species: z.string().trim().optional(),
  level: z.number().int().optional(),
  hpMax: z.number().int().optional(),
  hpCurrent: z.number().int().optional(),
  ac: z.number().int().optional(),
  str: z.number().int().optional(),
  dex: z.number().int().optional(),
  con: z.number().int().optional(),
  int: z.number().int().optional(),
  wis: z.number().int().optional(),
  cha: z.number().int().optional(),
  conditions: z.array(ConditionInstanceSchema).optional(),
  overrides: OverridesSchema.optional(),
  deathSaves: z.object({
    success: z.number().int().min(0).max(3),
    fail: z.number().int().min(0).max(3),
  }).optional(),
});

export function registerPlayerRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/players", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db
      .prepare(`
        SELECT p.id, p.campaign_id, p.user_id, p.player_name, p.character_name,
               p.class, p.species, p.level, p.hp_max, p.hp_current, p.ac, p.speed,
               p.str, p.dex, p.con, p.int, p.wis, p.cha, p.color,
               COALESCE(p.image_url, uc.image_url) AS image_url,
               p.overrides_json, p.conditions_json, p.death_saves_json,
               p.shared_notes, p.created_at, p.updated_at
        FROM players p
        LEFT JOIN character_campaigns cc ON cc.player_id = p.id AND cc.campaign_id = p.campaign_id
        LEFT JOIN user_characters uc ON uc.id = cc.character_id
        WHERE p.campaign_id = ?
      `)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToPlayer));
  });

  // Player-facing party view — HP is obfuscated (percent only, no raw values).
  app.get("/api/campaigns/:campaignId/party", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const rows = db.prepare(`
      SELECT p.id, p.user_id, p.player_name, p.character_name, p.class, p.species,
             p.level, p.hp_max, p.hp_current, p.ac, p.speed,
             p.str, p.dex, p.con, p.int, p.wis, p.cha,
             p.color, COALESCE(p.image_url, uc.image_url) AS image_url,
             p.overrides_json, p.conditions_json,
             uc.character_data_json
      FROM players p
      LEFT JOIN character_campaigns cc ON cc.player_id = p.id AND cc.campaign_id = p.campaign_id
      LEFT JOIN user_characters uc ON uc.id = cc.character_id
      WHERE p.campaign_id = ?
    `).all(campaignId) as Record<string, unknown>[];

    const party = rows.map((p) => {
      const overrides = JSON.parse(String(p.overrides_json || '{"tempHp":0,"acBonus":0,"hpMaxBonus":0}')) as
        { tempHp: number; acBonus: number; hpMaxBonus: number };
      const effectiveHpMax = Math.max(1, Number(p.hp_max) + (overrides.hpMaxBonus ?? 0));
      const hpPercent = Math.max(0, Math.min(100, Math.round((Number(p.hp_current) / effectiveHpMax) * 100)));
      return {
        id: p.id,
        userId: p.user_id,
        playerName: p.player_name,
        characterName: p.character_name,
        className: p.class,
        species: p.species,
        level: Number(p.level),
        hpPercent,
        ac: Number(p.ac) + (overrides.acBonus ?? 0),
        speed: p.speed != null ? Number(p.speed) : null,
        strScore: p.str != null ? Number(p.str) : null,
        dexScore: p.dex != null ? Number(p.dex) : null,
        conScore: p.con != null ? Number(p.con) : null,
        intScore: p.int != null ? Number(p.int) : null,
        wisScore: p.wis != null ? Number(p.wis) : null,
        chaScore: p.cha != null ? Number(p.cha) : null,
        color: p.color ?? null,
        imageUrl: p.image_url ?? null,
        conditions: JSON.parse(String(p.conditions_json || "[]")),
        characterData: p.character_data_json ? JSON.parse(String(p.character_data_json)) : null,
      };
    });

    res.json(party);
  });

  app.post("/api/campaigns/:campaignId/players", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const p = parseBody(PlayerCreateBody, req);
    const id = uid();
    const t = now();
    db.prepare(`
      INSERT INTO players
        (id, campaign_id, player_name, character_name, class, species, level,
         hp_max, hp_current, ac, str, dex, con, int, wis, cha, color,
         overrides_json, conditions_json, death_saves_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      p.playerName || "Player",
      p.characterName || "Character",
      p.class || "Class",
      p.species || "Species",
      p.level ?? 1,
      p.hpMax ?? 10,
      p.hpCurrent ?? p.hpMax ?? 10,
      p.ac ?? 10,
      p.str ?? 10,
      p.dex ?? 10,
      p.con ?? 10,
      p.int ?? 10,
      p.wis ?? 10,
      p.cha ?? 10,
      p.color ?? "green",
      JSON.stringify(DEFAULT_OVERRIDES),
      JSON.stringify([]),
      JSON.stringify(DEFAULT_DEATH_SAVES),
      t,
      t
    );
    ctx.broadcast("players:changed", { campaignId });
    const row = db.prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json(rowToPlayer(row));
  });

  app.put("/api/players/:playerId", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db
      .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`)
      .get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToPlayer(existingRow);
    const p = parseBody(PlayerUpdateBody, req);
    const t = now();

    const deathSaves = p.deathSaves ?? existing.deathSaves ?? DEFAULT_DEATH_SAVES;
    const conditions = p.conditions ?? existing.conditions ?? [];
    const overrides = p.overrides ?? existing.overrides ?? DEFAULT_OVERRIDES;

    const playerName = p.playerName ?? existing.playerName;
    const characterName = p.characterName ?? existing.characterName;
    const level = p.level ?? existing.level;
    const cls = p.class ?? existing.class;
    const species = p.species ?? existing.species;
    const hpMax = p.hpMax ?? existing.hpMax;
    const hpCurrent = p.hpCurrent ?? existing.hpCurrent;
    const ac = p.ac ?? existing.ac;
    const str = p.str ?? existing.str ?? 10;
    const dex = p.dex ?? existing.dex ?? 10;
    const con = p.con ?? existing.con ?? 10;
    const int_ = p.int ?? existing.int ?? 10;
    const wis = p.wis ?? existing.wis ?? 10;
    const cha = p.cha ?? existing.cha ?? 10;

    db.prepare(`
      UPDATE players SET
        player_name=?, character_name=?, class=?, species=?, level=?,
        hp_max=?, hp_current=?, ac=?, str=?, dex=?, con=?, int=?, wis=?, cha=?,
        overrides_json=?, conditions_json=?, death_saves_json=?, updated_at=?
      WHERE id=?
    `).run(
      playerName, characterName, cls, species, level,
      hpMax, hpCurrent, ac, str, dex, con, int_, wis, cha,
      JSON.stringify(overrides),
      JSON.stringify(conditions),
      JSON.stringify(deathSaves),
      t,
      playerId
    );

    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    const updated = db.prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`).get(playerId) as Record<string, unknown>;
    res.json(rowToPlayer(updated));
  });

  // DM can update a player's shared notes (edit/delete individual notes).
  app.patch("/api/players/:playerId/sharedNotes", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db.prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`).get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const sharedNotes: string = typeof req.body?.sharedNotes === "string" ? req.body.sharedNotes : "";
    const t = now();
    db.prepare("UPDATE players SET shared_notes = ?, updated_at = ? WHERE id = ?").run(sharedNotes, t, playerId);
    const existing = rowToPlayer(existingRow);
    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    res.json({ ok: true, sharedNotes });
  });

  app.delete("/api/players/:playerId", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db
      .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`)
      .get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToPlayer(existingRow);

    // Remove player-type combatants from all encounters in this campaign
    const affectedEncounters = db
      .prepare(`
        SELECT DISTINCT c.encounter_id
        FROM combatants c
        JOIN encounters e ON e.id = c.encounter_id
        WHERE c.base_type = 'player' AND c.base_id = ? AND e.campaign_id = ?
      `)
      .all(playerId, existing.campaignId) as { encounter_id: string }[];

    db.prepare(
      "DELETE FROM combatants WHERE base_type = 'player' AND base_id = ?"
    ).run(playerId);

    for (const { encounter_id } of affectedEncounters) {
      ctx.broadcast("encounter:combatantsChanged", { encounterId: encounter_id });
    }

    db.prepare("DELETE FROM players WHERE id = ?").run(playerId);

    // If this was a web-player character, clear the character_campaigns link so
    // the player can re-join the campaign later without issues.
    db.prepare("DELETE FROM character_campaigns WHERE player_id = ?").run(playerId);

    // Best-effort removal of player image.
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    const imgPath = ctx.path.join(imagesDir, `${playerId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }

    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    res.json({ ok: true });
  });

  // Upload player character image — resized to a thumbnail (max 400px, WebP).
  app.post("/api/players/:playerId/image", dmOrAdmin(db), ctx.upload.single("image"), async (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const row = db.prepare("SELECT campaign_id FROM players WHERE id = ?").get(playerId) as { campaign_id: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    if (!req.file) return res.status(400).json({ ok: false, message: "No file" });

    if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ ok: false, message: "Unsupported image type" });
    }

    let thumbnail: Buffer;
    try {
      thumbnail = await resizeToWebP(req.file.buffer);
    } catch {
      return res.status(400).json({ ok: false, message: "Could not process image" });
    }

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });

    const filename = `${playerId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), thumbnail);

    const imageUrl = `/player-images/${filename}`;
    db.prepare("UPDATE players SET image_url = ?, updated_at = ? WHERE id = ?").run(imageUrl, now(), playerId);
    ctx.broadcast("players:changed", { campaignId: row.campaign_id });
    res.json({ ok: true, imageUrl: absolutizePublicUrl(imageUrl) });
  });

  // Remove player character image.
  app.delete("/api/players/:playerId/image", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const row = db.prepare("SELECT campaign_id FROM players WHERE id = ?").get(playerId) as { campaign_id: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    const imgPath = ctx.path.join(imagesDir, `${playerId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }

    db.prepare("UPDATE players SET image_url = NULL, updated_at = ? WHERE id = ?").run(now(), playerId);
    ctx.broadcast("players:changed", { campaignId: row.campaign_id });
    res.json({ ok: true });
  });
}
