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
import { absolutizePublicUrlForRequest } from "../lib/publicUrl.js";
import { toCampaignCharacterDto } from "../lib/apiActors.js";
import {
  campaignLiveDbColumns,
  campaignSheetDbColumns,
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
    ...(rawOverrides.abilityScores ? { abilityScores: rawOverrides.abilityScores } : {}),
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
  const queryFlag = (value: unknown): boolean => {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
  };
  const emitPlayerChange = (args: { campaignId: string; action: "upsert" | "delete" | "refresh"; playerId?: string; characterId?: string | null }) => {
    ctx.broadcast("players:delta", {
      campaignId: args.campaignId,
      action: args.action,
      ...(args.playerId ? { playerId: args.playerId } : {}),
      ...(args.characterId !== undefined ? { characterId: args.characterId } : {}),
    });
  };

  const withAbsoluteImageUrl = <T extends { imageUrl?: string | null }>(req: Parameters<Express["get"]>[1] extends (...args: infer P) => any ? P[0] : never, value: T): T => ({
    ...value,
    ...(value.imageUrl !== undefined ? { imageUrl: absolutizePublicUrlForRequest(req, value.imageUrl) } : {}),
  });

  app.get("/api/campaigns/:campaignId/players", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const includeSharedNotes = queryFlag(req.query.includeSharedNotes) || String(req.query.includeSharedNotes ?? "").trim() === "";
      const rows = db
      .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map((row) => {
      const dto = toCampaignCharacterDto(rowToCampaignCharacter(row));
      if (!includeSharedNotes) delete dto.sharedNotes;
      return withAbsoluteImageUrl(req, dto);
    }));
  });

  app.get("/api/campaigns/:campaignId/players/:playerId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const playerId = requireParam(req, res, "playerId");
    if (!campaignId || !playerId) return;
    const includeSharedNotes = queryFlag(req.query.includeSharedNotes) || String(req.query.includeSharedNotes ?? "").trim() === "";
    const row = db
      .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE campaign_id = ? AND id = ?`)
      .get(campaignId, playerId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const dto = toCampaignCharacterDto(rowToCampaignCharacter(row));
    if (!includeSharedNotes) delete dto.sharedNotes;
    res.json(withAbsoluteImageUrl(req, dto));
  });

  // Player-facing party view — HP is obfuscated (percent only, no raw values).
  app.get("/api/campaigns/:campaignId/party", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const includeCharacterData = queryFlag(req.query.includeCharacterData);

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
        imageUrl: absolutizePublicUrlForRequest(req, actor.imageUrl ?? null),
        conditions: actor.conditions ?? [],
        ...(includeCharacterData ? { characterData: parseJson(p.character_data_json, null) } : {}),
      };
    });

    res.json(party);
  });

  app.get("/api/campaigns/:campaignId/party/:playerId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const playerId = requireParam(req, res, "playerId");
    if (!campaignId || !playerId) return;

    const p = db.prepare(`
      SELECT p.*, uc.character_data_json
      FROM players p
      LEFT JOIN user_characters uc ON uc.id = p.character_id
      WHERE p.campaign_id = ? AND p.id = ?
    `).get(campaignId, playerId) as Record<string, unknown> | undefined;

    if (!p) return res.status(404).json({ ok: false, message: "Not found" });

    const actor = rowToCampaignCharacter(p);
    const overrides = actor.overrides ?? DEFAULT_OVERRIDES;
    const effectiveHpMax = Math.max(1, actor.hpMax + (overrides.hpMaxBonus ?? 0));
    const hpPercent = Math.max(0, Math.min(100, Math.round((actor.hpCurrent / effectiveHpMax) * 100)));

    res.json({
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
      imageUrl: absolutizePublicUrlForRequest(req, actor.imageUrl ?? null),
      conditions: actor.conditions ?? [],
      characterData: parseJson(p.character_data_json, null),
    });
  });

  app.post("/api/campaigns/:campaignId/players", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const p = parseBody(PlayerCreateBody, req);
    const id = uid();
    const t = now();
    const sheet = {
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
    };
    const live = {
      hpCurrent: p.hpCurrent ?? p.hpMax ?? 10,
      overrides: { ...DEFAULT_OVERRIDES },
      conditions: [],
      deathSaves: { ...DEFAULT_DEATH_SAVES },
    };
    const sheetCols = campaignSheetDbColumns(sheet);
    const liveCols = campaignLiveDbColumns(live);
    db.prepare(`
      INSERT INTO players
        (id, campaign_id, user_id, character_id,
         player_name, character_name, class_name, species, level, hp_max, hp_current, ac, speed,
         str, dex, con, int, wis, cha, color, synced_ac, death_saves_success, death_saves_fail,
         sheet_json, live_json, created_at, updated_at)
      VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      sheetCols.playerName,
      sheetCols.characterName,
      sheetCols.className,
      sheetCols.species,
      sheetCols.level,
      sheetCols.hpMax,
      liveCols.hpCurrent,
      sheetCols.ac,
      sheetCols.speed,
      sheetCols.str,
      sheetCols.dex,
      sheetCols.con,
      sheetCols.int,
      sheetCols.wis,
      sheetCols.cha,
      sheetCols.color,
      sheetCols.syncedAc,
      liveCols.deathSavesSuccess,
      liveCols.deathSavesFail,
      sheetCols.sheetJson,
      liveCols.liveJson,
      t,
      t,
    );
    emitPlayerChange({ campaignId, action: "upsert", playerId: id, characterId: null });
    const row = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json(withAbsoluteImageUrl(req, toCampaignCharacterDto(rowToCampaignCharacter(row))));
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
    const sheetCols = campaignSheetDbColumns(next.sheet);
    const liveCols = campaignLiveDbColumns(next.live);

    db.prepare(`
      UPDATE players SET
        player_name=?, character_name=?, class_name=?, species=?, level=?, hp_max=?, hp_current=?, ac=?, speed=?,
        str=?, dex=?, con=?, int=?, wis=?, cha=?, color=?, synced_ac=?, death_saves_success=?, death_saves_fail=?,
        sheet_json=?, live_json=?, updated_at=?
      WHERE id=?
    `).run(
      sheetCols.playerName,
      sheetCols.characterName,
      sheetCols.className,
      sheetCols.species,
      sheetCols.level,
      sheetCols.hpMax,
      liveCols.hpCurrent,
      sheetCols.ac,
      sheetCols.speed,
      sheetCols.str,
      sheetCols.dex,
      sheetCols.con,
      sheetCols.int,
      sheetCols.wis,
      sheetCols.cha,
      sheetCols.color,
      sheetCols.syncedAc,
      liveCols.deathSavesSuccess,
      liveCols.deathSavesFail,
      sheetCols.sheetJson,
      liveCols.liveJson,
      t,
      playerId
    );

    emitPlayerChange({
      campaignId: existing.campaignId,
      action: "upsert",
      playerId,
      characterId: existing.characterId ?? null,
    });
    const updated = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(playerId) as Record<string, unknown>;
    res.json(withAbsoluteImageUrl(req, toCampaignCharacterDto(rowToCampaignCharacter(updated))));
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
    emitPlayerChange({
      campaignId: existing.campaignId,
      action: "upsert",
      playerId,
      characterId: existing.characterId ?? null,
    });
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
    const removedCombatants = db
      .prepare(`
        SELECT c.id, c.encounter_id
        FROM combatants c
        JOIN encounters e ON e.id = c.encounter_id
        WHERE c.base_type = 'player' AND c.base_id = ? AND e.campaign_id = ?
      `)
      .all(playerId, existing.campaignId) as { id: string; encounter_id: string }[];

    db.prepare(
      "DELETE FROM combatants WHERE base_type = 'player' AND base_id = ?"
    ).run(playerId);

    for (const { encounter_id, id } of removedCombatants) {
      ctx.broadcast("encounter:combatantsDelta", {
        encounterId: encounter_id,
        action: "delete",
        combatantId: id,
      });
    }

    db.prepare("DELETE FROM players WHERE id = ?").run(playerId);

    // Best-effort removal of player image.
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    const imgPath = ctx.path.join(imagesDir, `${playerId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }

    emitPlayerChange({
      campaignId: existing.campaignId,
      action: "delete",
      playerId,
      characterId: existing.characterId ?? null,
    });
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
    emitPlayerChange({ campaignId: row.campaign_id, action: "upsert", playerId, characterId: null });
    res.json({ ok: true, imageUrl: absolutizePublicUrlForRequest(req, imageUrl) });
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
    emitPlayerChange({ campaignId: row.campaign_id, action: "upsert", playerId, characterId: null });
    res.json({ ok: true });
  });
}
