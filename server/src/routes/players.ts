// server/src/routes/players.ts
import { z } from "zod";
import type { Express, Request } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { removePlayerFromCampaign } from "../services/characterDeletion.js";
import { parseBody } from "../lib/validate.js";
import { rowToCampaignCharacter, CAMPAIGN_CHARACTER_COLS, parseJson, getCampaignCharacterRow } from "../lib/db.js";
import { ConditionInstanceSchema, OverridesSchema } from "../lib/schemas.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import { prepareUploadedImage } from "../lib/imageHelpers.js";
import { absolutizePublicUrlForRequest } from "../lib/publicUrl.js";
import { withAbsoluteImageUrl } from "../lib/routeImageUrl.js";
import { toCampaignCharacterDto } from "../lib/apiActors.js";
import {
  campaignLiveDbColumns,
  campaignSheetDbColumns,
  getLinkedCharacterIdForPlayer,
  writePlayerLiveState,
} from "../services/characters.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";

// What a campaign roster row may hold. These were unbounded integers, so a level of -5, an armour
// class of -1 or a Strength of 900 was stored as readily as anything else. The ranges are generous:
// they refuse nonsense, not homebrew.
const Level = z.number().int().min(1).max(30);
const HitPointMaximum = z.number().int().min(0).max(9999);
// Hit points do not go below zero in 5e - damage past zero leaves you at zero, making death saves.
// A client that sends a negative number has done the arithmetic without the floor, so this clamps
// rather than refusing a damage roll mid-fight.
const CurrentHitPoints = z.number().int().max(9999).transform((value) => Math.max(0, value));
const ArmorClass = z.number().int().min(0).max(50);
const Speed = z.number().int().min(0).max(500);
const AbilityScore = z.number().int().min(1).max(30);

const PlayerCreateBody = z.object({
  playerName: z.string().trim().optional(),
  characterName: z.string().trim().optional(),
  class: z.string().trim().optional(),
  species: z.string().trim().optional(),
  level: Level.optional(),
  hpMax: HitPointMaximum.optional(),
  hpCurrent: CurrentHitPoints.optional(),
  ac: ArmorClass.optional(),
  speed: Speed.optional(),
  str: AbilityScore.optional(),
  dex: AbilityScore.optional(),
  con: AbilityScore.optional(),
  int: AbilityScore.optional(),
  wis: AbilityScore.optional(),
  cha: AbilityScore.optional(),
  color: z.string().optional(),
});

const PlayerUpdateBody = z.object({
  playerName: z.string().trim().optional(),
  characterName: z.string().trim().optional(),
  class: z.string().trim().optional(),
  species: z.string().trim().optional(),
  level: Level.optional(),
  hpMax: HitPointMaximum.optional(),
  hpCurrent: CurrentHitPoints.optional(),
  ac: ArmorClass.optional(),
  speed: Speed.optional(),
  str: AbilityScore.optional(),
  dex: AbilityScore.optional(),
  con: AbilityScore.optional(),
  int: AbilityScore.optional(),
  wis: AbilityScore.optional(),
  cha: AbilityScore.optional(),
  conditions: z.array(ConditionInstanceSchema).max(100).optional(),
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
    return normalized as NonNullable<typeof existing.conditions>[number];
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
      ...(() => {
        // The stored speed is the base; conditions are applied when read (rowToCampaignCharacter).
        const speed = isLinkedProjection ? existing.baseSpeed : (update.speed ?? existing.baseSpeed);
        return speed != null ? { speed } : {};
      })(),
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

/**
 * How a party member looks to the rest of the party: health as a percentage rather than hit points,
 * AC with its bonus folded in. The list and the single-member view used to build this separately,
 * line for line, which is how two copies of a rule start to disagree.
 */
function toPartyMember(req: Request, row: Record<string, unknown>, includeCharacterData: boolean) {
  const actor = rowToCampaignCharacter(row);
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
    ...(includeCharacterData ? { characterData: partySheetData(parseJson(row.character_data_json, null)) } : {}),
  };
}

/**
 * The sheet as the party sees it: without the character's live state, which lives there too
 * (lib/playerRowsView.ts). Conditions are sent on their own, above; the bonuses carry temporary
 * hit points, which the party does not see (only how hurt someone is).
 */
function partySheetData(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const { sheetOverrides: _bonuses, conditions: _conditions, inspiration: _inspiration, ...sheet } = data as Record<string, unknown>;
  return sheet;
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

  function addConcentrationSpell(row: Record<string, unknown>, dto: ReturnType<typeof toCampaignCharacterDto>) {
    const cs = row.concentration_spell;
    if (
      typeof cs === "string"
      && cs
      && dto.live.conditions.some((condition) => condition.key === "concentration")
    ) dto.live.concentrationSpell = cs;
  }

  // MARK: - GET /api/campaigns/:campaignId/players
  app.get("/api/campaigns/:campaignId/players", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const includeSharedNotes = queryFlag(req.query.includeSharedNotes) || String(req.query.includeSharedNotes ?? "").trim() === "";
    const rows = db
      .prepare(`SELECT p.${CAMPAIGN_CHARACTER_COLS.split(", ").join(", p.")}, json_extract(uc.character_data_json, '$.concentrationSpell') AS concentration_spell FROM player_rows p LEFT JOIN user_characters uc ON uc.id = p.character_id WHERE p.campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map((row) => {
      const dto = toCampaignCharacterDto(rowToCampaignCharacter(row));
      addConcentrationSpell(row, dto);
      if (!includeSharedNotes) delete dto.sharedNotes;
      return withAbsoluteImageUrl(req, dto);
    }));
  });

  // MARK: - GET /api/campaigns/:campaignId/players/:playerId
  app.get("/api/campaigns/:campaignId/players/:playerId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const playerId = requireParam(req, res, "playerId");
    if (!campaignId || !playerId) return;
    const includeSharedNotes = queryFlag(req.query.includeSharedNotes) || String(req.query.includeSharedNotes ?? "").trim() === "";
    const row = db
      .prepare(`SELECT p.${CAMPAIGN_CHARACTER_COLS.split(", ").join(", p.")}, json_extract(uc.character_data_json, '$.concentrationSpell') AS concentration_spell FROM player_rows p LEFT JOIN user_characters uc ON uc.id = p.character_id WHERE p.campaign_id = ? AND p.id = ?`)
      .get(campaignId, playerId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const dto = toCampaignCharacterDto(rowToCampaignCharacter(row));
    addConcentrationSpell(row, dto);
    if (!includeSharedNotes) delete dto.sharedNotes;
    res.json(withAbsoluteImageUrl(req, dto));
  });

  // Player-facing party view — HP is obfuscated (percent only, no raw values).

  // MARK: - GET /api/campaigns/:campaignId/party
  app.get("/api/campaigns/:campaignId/party", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const includeCharacterData = queryFlag(req.query.includeCharacterData);

    const rows = db.prepare(`
      SELECT p.*, uc.character_data_json
      FROM player_rows p
      LEFT JOIN user_characters uc ON uc.id = p.character_id
      WHERE p.campaign_id = ?
    `).all(campaignId) as Record<string, unknown>[];

    const party = rows.map((p) => toPartyMember(req, p, includeCharacterData));

    res.json(party);
  });

  // MARK: - GET /api/campaigns/:campaignId/party/:playerId
  app.get("/api/campaigns/:campaignId/party/:playerId", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    const playerId = requireParam(req, res, "playerId");
    if (!campaignId || !playerId) return;

    const p = db.prepare(`
      SELECT p.*, uc.character_data_json
      FROM player_rows p
      LEFT JOIN user_characters uc ON uc.id = p.character_id
      WHERE p.campaign_id = ? AND p.id = ?
    `).get(campaignId, playerId) as Record<string, unknown> | undefined;

    if (!p) return res.status(404).json({ ok: false, message: "Not found" });

    res.json(toPartyMember(req, p, true));
  });

  // MARK: - POST /api/campaigns/:campaignId/players
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
      speed: p.speed ?? 30,
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
         live_json, created_at, updated_at)
      VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      liveCols.liveJson,
      t,
      t,
    );
    emitPlayerChange({ campaignId, action: "upsert", playerId: id, characterId: null });
    const row = getCampaignCharacterRow(db, id)!;
    res.json(withAbsoluteImageUrl(req, toCampaignCharacterDto(rowToCampaignCharacter(row))));
  });

  // MARK: - PUT /api/players/:playerId
  app.put("/api/players/:playerId", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = getCampaignCharacterRow(db, playerId);
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToCampaignCharacter(existingRow);
    const p = parseBody(PlayerUpdateBody, req);
    const t = now();
    const linkedCharacterId = getLinkedCharacterIdForPlayer(db, playerId);
    const isLinkedProjection = Boolean(linkedCharacterId);
    const next = resolvePlayerUpdateState(existing, p, isLinkedProjection);

    const sheetCols = campaignSheetDbColumns(next.sheet);
    db.transaction(() => {
      // A linked player's profile is its character sheet's (the DM does not edit it here), so only
      // a hand-made player's profile is written.
      if (!isLinkedProjection) db.prepare(`
        UPDATE players SET
          player_name=?, character_name=?, class_name=?, species=?, level=?, hp_max=?, ac=?, speed=?,
          str=?, dex=?, con=?, int=?, wis=?, cha=?, color=?, synced_ac=?, updated_at=?
        WHERE id=?
      `).run(
        sheetCols.playerName,
        sheetCols.characterName,
        sheetCols.className,
        sheetCols.species,
        sheetCols.level,
        sheetCols.hpMax,
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
        t,
        playerId
      );
      // HP, death saves, bonuses and conditions go to the player's one home (the linked sheet,
      // or this row for a hand-made player).
      writePlayerLiveState(db, playerId, next.live, t);
    })();

    emitPlayerChange({
      campaignId: existing.campaignId,
      action: "upsert",
      playerId,
      characterId: existing.characterId ?? null,
    });
    const updated = getCampaignCharacterRow(db, playerId)!;
    res.json(withAbsoluteImageUrl(req, toCampaignCharacterDto(rowToCampaignCharacter(updated))));
  });

  // A player's shared notes are edited through routes/sharedNotes.ts.

  // MARK: - DELETE /api/players/:playerId
  app.delete("/api/players/:playerId", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = getCampaignCharacterRow(db, playerId);
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToCampaignCharacter(existingRow);

    // The same teardown as a player leaving on their own: out of every encounter, off the roster,
    // portrait copy gone, and a linked character leaving its last campaign keeps its conditions.
    db.transaction(() => {
      removePlayerFromCampaign(ctx, { id: playerId, campaignId: existing.campaignId, characterId: existing.characterId ?? null });
    })();
    res.json({ ok: true });
  });

  // Upload player character image — resized to a thumbnail (max 400px, WebP).

  // MARK: - POST /api/players/:playerId/image
  app.post("/api/players/:playerId/image", dmOrAdmin(db), ctx.imageUpload.single("image"), async (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const row = db.prepare("SELECT campaign_id FROM player_rows WHERE id = ?").get(playerId) as { campaign_id: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const prepared = await prepareUploadedImage(req.file);
    if (!prepared.ok) return res.status(400).json({ ok: false, message: prepared.message });
    const thumbnail = prepared.image;

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });

    const filename = `${playerId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), thumbnail);

    const imageUrl = `/player-images/${filename}`;
    const t = now();
    db.prepare("UPDATE players SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?").run(imageUrl, t, t, playerId);
    emitPlayerChange({ campaignId: row.campaign_id, action: "upsert", playerId, characterId: null });
    res.json({ ok: true, imageUrl: absolutizePublicUrlForRequest(req, imageUrl) });
  });

  // Remove player character image.

  // MARK: - DELETE /api/players/:playerId/image
  app.delete("/api/players/:playerId/image", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const row = db.prepare("SELECT campaign_id FROM player_rows WHERE id = ?").get(playerId) as { campaign_id: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    const imgPath = ctx.path.join(imagesDir, `${playerId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }

    const t = now();
    db.prepare("UPDATE players SET image_url = NULL, image_updated_at = ?, updated_at = ? WHERE id = ?").run(t, t, playerId);
    emitPlayerChange({ campaignId: row.campaign_id, action: "upsert", playerId, characterId: null });
    res.json({ ok: true });
  });
}
