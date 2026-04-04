// server/src/routes/players.ts
import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { rowToCampaignCharacter, CAMPAIGN_CHARACTER_COLS, parseJson } from "../lib/db.js";
import { ConditionInstanceSchema, OverridesSchema } from "../lib/schemas.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import { ACCEPTED_IMAGE_TYPES, resizeToWebP } from "../lib/imageHelpers.js";
import { absolutizePublicUrl } from "../lib/publicUrl.js";
import {
  serializeCampaignCharacterLive,
  serializeCampaignCharacterSheet,
  getLinkedCharacterIdForPlayer,
} from "../services/characters.js";
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

function resolvePlayerUpdateState(
  existing: ReturnType<typeof rowToCampaignCharacter>,
  update: z.input<typeof PlayerUpdateBody>,
  isLinkedProjection: boolean,
) {
  const deathSaves = update.deathSaves ?? existing.deathSaves ?? DEFAULT_DEATH_SAVES;
  const conditions = (update.conditions ?? existing.conditions ?? []).map((condition) => {
    const normalized: Record<string, unknown> = { ...condition };
    if (condition.casterId === undefined) delete normalized.casterId;
    else normalized.casterId = condition.casterId ?? null;
    return normalized as typeof existing.conditions extends Array<infer T> ? T : never;
  });
  const rawOverrides = update.overrides ?? existing.overrides ?? DEFAULT_OVERRIDES;
  const overrides = {
    tempHp: rawOverrides.tempHp ?? DEFAULT_OVERRIDES.tempHp,
    acBonus: rawOverrides.acBonus ?? DEFAULT_OVERRIDES.acBonus,
    hpMaxBonus: rawOverrides.hpMaxBonus ?? DEFAULT_OVERRIDES.hpMaxBonus,
    ...(rawOverrides.inspiration !== undefined ? { inspiration: rawOverrides.inspiration } : {}),
  };

  return {
    sheet: {
      playerName: isLinkedProjection ? existing.playerName : (update.playerName ?? existing.playerName),
      characterName: isLinkedProjection ? existing.characterName : (update.characterName ?? existing.characterName),
      level: isLinkedProjection ? existing.level : (update.level ?? existing.level),
      class: isLinkedProjection ? existing.class : (update.class ?? existing.class),
      species: isLinkedProjection ? existing.species : (update.species ?? existing.species),
      hpMax: isLinkedProjection ? existing.hpMax : (update.hpMax ?? existing.hpMax),
      ac: isLinkedProjection ? existing.ac : (update.ac ?? existing.ac),
      ...(existing.speed != null ? { speed: existing.speed } : {}),
      str: isLinkedProjection ? (existing.str ?? 10) : (update.str ?? existing.str ?? 10),
      dex: isLinkedProjection ? (existing.dex ?? 10) : (update.dex ?? existing.dex ?? 10),
      con: isLinkedProjection ? (existing.con ?? 10) : (update.con ?? existing.con ?? 10),
      int: isLinkedProjection ? (existing.int ?? 10) : (update.int ?? existing.int ?? 10),
      wis: isLinkedProjection ? (existing.wis ?? 10) : (update.wis ?? existing.wis ?? 10),
      cha: isLinkedProjection ? (existing.cha ?? 10) : (update.cha ?? existing.cha ?? 10),
      ...(existing.color !== undefined ? { color: existing.color } : {}),
    },
    live: {
      hpCurrent: update.hpCurrent ?? existing.hpCurrent,
      conditions,
      overrides,
      deathSaves,
    },
  };
}

export function registerPlayerRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/players", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
      const rows = db
      .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToCampaignCharacter));
  });

  // Player-facing party view — HP is obfuscated (percent only, no raw values).
  app.get("/api/campaigns/:campaignId/party", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;

    const rows = db.prepare(`
      SELECT p.*, uc.character_data_json
      FROM players p
      LEFT JOIN user_characters uc ON uc.id = p.character_id
      WHERE p.campaign_id = ?
    `).all(campaignId) as Record<string, unknown>[];

    const party = rows.map((p) => {
      const actor = rowToCampaignCharacter(p);
      const overrides = actor.overrides ?? DEFAULT_OVERRIDES;
      const effectiveHpMax = Math.max(1, actor.hpMax + (overrides.hpMaxBonus ?? 0));
      const hpPercent = Math.max(0, Math.min(100, Math.round((actor.hpCurrent / effectiveHpMax) * 100)));
      return {
        id: actor.id,
        userId: actor.userId,
        playerName: actor.playerName,
        characterName: actor.characterName,
        className: actor.class,
        species: actor.species,
        level: actor.level,
        hpPercent,
        ac: actor.ac + (overrides.acBonus ?? 0),
        speed: actor.speed ?? null,
        strScore: actor.str ?? null,
        dexScore: actor.dex ?? null,
        conScore: actor.con ?? null,
        intScore: actor.int ?? null,
        wisScore: actor.wis ?? null,
        chaScore: actor.cha ?? null,
        color: actor.color ?? null,
        imageUrl: actor.imageUrl ?? null,
        conditions: actor.conditions ?? [],
        characterData: parseJson(p.character_data_json, null),
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
        (id, campaign_id, user_id, character_id, sheet_json, live_json, created_at, updated_at)
      VALUES (?, ?, NULL, NULL, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      serializeCampaignCharacterSheet({
        playerName: p.playerName || "Player",
        characterName: p.characterName || "Character",
        class: p.class || "Class",
        species: p.species || "Species",
        level: p.level ?? 1,
        hpMax: p.hpMax ?? 10,
        ac: p.ac ?? 10,
        str: p.str ?? 10,
        dex: p.dex ?? 10,
        con: p.con ?? 10,
        int: p.int ?? 10,
        wis: p.wis ?? 10,
        cha: p.cha ?? 10,
        color: p.color ?? "green",
      }),
      serializeCampaignCharacterLive({
        hpCurrent: p.hpCurrent ?? p.hpMax ?? 10,
        overrides: { ...DEFAULT_OVERRIDES },
        conditions: [],
        deathSaves: { ...DEFAULT_DEATH_SAVES },
      }),
      t,
      t,
    );
    ctx.broadcast("players:changed", { campaignId });
    const row = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json(rowToCampaignCharacter(row));
  });

  app.put("/api/players/:playerId", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db
      .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
      .get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToCampaignCharacter(existingRow);
    const p = parseBody(PlayerUpdateBody, req);
    const t = now();
    const linkedCharacterId = getLinkedCharacterIdForPlayer(db, playerId);
    const isLinkedProjection = Boolean(linkedCharacterId);
    const next = resolvePlayerUpdateState(existing, p, isLinkedProjection);

    db.prepare(`
      UPDATE players SET
        sheet_json=?, live_json=?, updated_at=?
      WHERE id=?
    `).run(
      serializeCampaignCharacterSheet(next.sheet),
      serializeCampaignCharacterLive(next.live),
      t,
      playerId
    );

    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    const updated = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(playerId) as Record<string, unknown>;
    res.json(rowToCampaignCharacter(updated));
  });

  // DM can update a player's shared notes (edit/delete individual notes).
  app.patch("/api/players/:playerId/sharedNotes", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const sharedNotes: string = typeof req.body?.sharedNotes === "string" ? req.body.sharedNotes : "";
    const t = now();
    db.prepare("UPDATE players SET shared_notes = ?, updated_at = ? WHERE id = ?").run(sharedNotes, t, playerId);
    const existing = rowToCampaignCharacter(existingRow);
    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    res.json({ ok: true, sharedNotes });
  });

  app.delete("/api/players/:playerId", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db
      .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
      .get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToCampaignCharacter(existingRow);

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
