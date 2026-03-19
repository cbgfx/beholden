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

  app.get("/api/campaigns/:campaignId/players", (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db
      .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToPlayer));
  });

  app.post("/api/campaigns/:campaignId/players", (req, res) => {
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

  app.put("/api/players/:playerId", (req, res) => {
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

  app.delete("/api/players/:playerId", (req, res) => {
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

    // Best-effort removal of player image.
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    const imgPath = ctx.path.join(imagesDir, `${playerId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }

    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    res.json({ ok: true });
  });

  // Upload player character image — resized to a thumbnail (max 400px, WebP).
  app.post("/api/players/:playerId/image", ctx.upload.single("image"), async (req, res) => {
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
    res.json({ ok: true, imageUrl });
  });

  // Remove player character image.
  app.delete("/api/players/:playerId/image", (req, res) => {
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
