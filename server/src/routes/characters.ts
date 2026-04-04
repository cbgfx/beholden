// server/src/routes/characters.ts
// Player-owned characters: campaign-agnostic CRUD + campaign assignment.

import { z } from "zod";
import type { Express, Response } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { rowToCampaignCharacter, rowToCharacterSheet, CAMPAIGN_CHARACTER_COLS, CHARACTER_SHEET_COLS } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import { toCharacterCampaignAssignmentDto, toCharacterSheetDto } from "../lib/apiActors.js";
import {
  type Assignment,
  getAssignments,
  assignmentsToJson,
  getAssignedPlayers,
  broadcastPlayerCombatantChanges,
  buildCampaignCharacterLiveState,
  buildCampaignCharacterLive,
  buildCharacterSheetState,
  buildMirroredPlayerSnapshot,
  insertProjectedPlayerRow,
  mergeLiveStats,
  serializeCampaignCharacterLive,
  serializeCharacterSheetState,
  syncAssignedPlayerRows,
  updateProjectedPlayerRow,
  updateCampaignCharacterLive,
} from "../services/characters.js";
import { ACCEPTED_IMAGE_TYPES, resizeToWebP } from "../lib/imageHelpers.js";
import { absolutizePublicUrl } from "../lib/publicUrl.js";

const CharacterBodyBase = z.object({
  name: z.string().trim().min(1).optional(),
  playerName: z.string().trim().optional(),
  className: z.string().trim().optional(),
  species: z.string().trim().optional(),
  level: z.number().int().min(1).max(20).optional(),
  hpMax: z.number().int().min(0).optional(),
  hpCurrent: z.number().int().min(0).optional(),
  ac: z.number().int().optional(),
  speed: z.number().int().optional(),
  strScore: z.number().int().min(1).max(30).nullable().optional(),
  dexScore: z.number().int().min(1).max(30).nullable().optional(),
  conScore: z.number().int().min(1).max(30).nullable().optional(),
  intScore: z.number().int().min(1).max(30).nullable().optional(),
  wisScore: z.number().int().min(1).max(30).nullable().optional(),
  chaScore: z.number().int().min(1).max(30).nullable().optional(),
  color: z.string().optional(),
  characterData: z.record(z.unknown()).nullable().optional(),
});

// For create: name is required; for update: name is optional (patch semantics)
const CharacterCreateBody = CharacterBodyBase.extend({ name: z.string().trim().min(1) });
const CharacterUpdateBody = CharacterBodyBase;

const AssignBody = z.object({
  campaignIds: z.array(z.string()).min(1),
});

const UnassignBody = z.object({
  campaignId: z.string(),
});

const OverridesBody = z.object({
  tempHp: z.number().int(),
  acBonus: z.number().int(),
  hpMaxBonus: z.number().int(),
});

function toCharacterSheetDtoInput(
  character: {
    id: string;
    userId: string;
    name: string;
    playerName: string;
    className: string;
    species: string;
    level: number;
    hpMax: number;
    hpCurrent: number;
    ac: number;
    speed: number;
    strScore: number | null;
    dexScore: number | null;
    conScore: number | null;
    intScore: number | null;
    wisScore: number | null;
    chaScore: number | null;
    color: string | null;
    imageUrl: string | null;
    characterData: Record<string, unknown> | null;
    sharedNotes: string;
    createdAt: number;
    updatedAt: number;
    deathSaves?: { success: number; fail: number } | undefined;
    conditions?: Array<Record<string, unknown>> | undefined;
    overrides?: { tempHp: number; acBonus: number; hpMaxBonus: number; inspiration?: boolean } | undefined;
  },
  campaigns: ReturnType<typeof toCharacterCampaignAssignmentDto>,
  campaignSharedNotes?: string,
) {
  return {
    id: character.id,
    userId: character.userId,
    name: character.name,
    playerName: character.playerName,
    className: character.className,
    species: character.species,
    level: character.level,
    hpMax: character.hpMax,
    hpCurrent: character.hpCurrent,
    ac: character.ac,
    speed: character.speed,
    strScore: character.strScore,
    dexScore: character.dexScore,
    conScore: character.conScore,
    intScore: character.intScore,
    wisScore: character.wisScore,
    chaScore: character.chaScore,
    color: character.color,
    imageUrl: character.imageUrl,
    characterData: character.characterData,
    sharedNotes: character.sharedNotes ?? "",
    campaigns,
    ...(character.conditions ? { conditions: character.conditions } : {}),
    ...(character.overrides ? { overrides: character.overrides } : {}),
    ...(character.deathSaves ? { deathSaves: character.deathSaves } : {}),
    ...(campaignSharedNotes !== undefined ? { campaignSharedNotes } : {}),
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
  };
}

export function registerCharacterRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  /** Verifies ownership of a user_characters row. Returns null and sends 404 if not found. */
  function requireUserChar(charId: string, userId: string, res: Response): { id: string } | null {
    const row = db.prepare("SELECT id FROM user_characters WHERE id = ? AND user_id = ?")
      .get(charId, userId) as { id: string } | undefined;
    if (!row) { res.status(404).json({ ok: false, message: "Not found" }); return null; }
    return row;
  }

  // List all user-owned characters with campaign assignment info
  app.get("/api/me/characters", requireAuth, (req, res) => {
    const userId = (req as any).user.userId;
    const chars = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE user_id = ? ORDER BY updated_at DESC`)
      .all(userId) as Record<string, unknown>[];

    const result = chars.map((c) => {
      const char = rowToCharacterSheet(c);
      const assignments = getAssignments(db, char.id);
      return toCharacterSheetDto(
        toCharacterSheetDtoInput(
          mergeLiveStats(db, char, assignments),
          toCharacterCampaignAssignmentDto(assignmentsToJson(assignments)),
        ),
      );
    });

    res.json(result);
  });

  // Get a single user-owned character
  app.get("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = (req as any).user.userId;
    const row = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });

    const char = rowToCharacterSheet(row);
    const assignments = getAssignments(db, char.id);
    const merged = mergeLiveStats(db, char, assignments);

    // Collect campaign-level shared notes as a separate field (read-only for player)
    const campaignNotes: unknown[] = [];
    for (const a of assignments) {
      const camp = db.prepare("SELECT shared_notes FROM campaigns WHERE id = ?")
        .get(a.campaign_id) as { shared_notes: string | null } | undefined;
      if (camp?.shared_notes) {
        try { campaignNotes.push(...(JSON.parse(camp.shared_notes) as unknown[])); } catch { /* ignore */ }
      }
    }

    res.json(
      toCharacterSheetDto(
        toCharacterSheetDtoInput(
          merged,
          toCharacterCampaignAssignmentDto(assignmentsToJson(assignments)),
          JSON.stringify(campaignNotes),
        ),
      ),
    );
  });

  // Create a new user-owned character (no campaign required)
  app.post("/api/me/characters", requireAuth, (req, res) => {
    const userId = (req as any).user.userId;
    const p = parseBody(CharacterCreateBody, req);
    const id = uid();
    const t = now();

    db.prepare(`
      INSERT INTO user_characters
        (id, user_id, sheet_json, image_url, character_data_json, shared_notes, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, '', ?, ?)
    `).run(
      id, userId,
      serializeCharacterSheetState({
        name: p.name,
        playerName: p.playerName ?? "",
        className: p.className ?? "",
        species: p.species ?? "",
        level: p.level ?? 1,
        hpMax: p.hpMax ?? 0,
        hpCurrent: p.hpCurrent ?? p.hpMax ?? 0,
        ac: p.ac ?? 10,
        speed: p.speed ?? 30,
        strScore: p.strScore ?? null,
        dexScore: p.dexScore ?? null,
        conScore: p.conScore ?? null,
        intScore: p.intScore ?? null,
        wisScore: p.wisScore ?? null,
        chaScore: p.chaScore ?? null,
        color: p.color ?? null,
      }),
      p.characterData ? JSON.stringify(p.characterData) : null,
      t, t,
    );

    const row = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json(toCharacterSheetDto({ ...rowToCharacterSheet(row), campaigns: [] }));
  });

  // Update a user-owned character
  app.put("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = (req as any).user.userId;
    const existing = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    const p = parseBody(CharacterUpdateBody, req);
    const t = now();
    const ex = rowToCharacterSheet(existing);

    db.prepare(`
      UPDATE user_characters SET
        sheet_json=?, character_data_json=?, updated_at=?
      WHERE id=? AND user_id=?
    `).run(
      serializeCharacterSheetState({
        name: p.name ?? ex.name,
        playerName: p.playerName ?? ex.playerName,
        className: p.className ?? ex.className,
        species: p.species ?? ex.species,
        level: p.level ?? ex.level,
        hpMax: p.hpMax ?? ex.hpMax,
        hpCurrent: p.hpCurrent ?? ex.hpCurrent,
        ac: p.ac ?? ex.ac,
        speed: p.speed ?? ex.speed,
        strScore: p.strScore !== undefined ? p.strScore : ex.strScore,
        dexScore: p.dexScore !== undefined ? p.dexScore : ex.dexScore,
        conScore: p.conScore !== undefined ? p.conScore : ex.conScore,
        intScore: p.intScore !== undefined ? p.intScore : ex.intScore,
        wisScore: p.wisScore !== undefined ? p.wisScore : ex.wisScore,
        chaScore: p.chaScore !== undefined ? p.chaScore : ex.chaScore,
        color: p.color !== undefined ? p.color : ex.color,
        ...(ex.deathSaves ? { deathSaves: ex.deathSaves } : {}),
      }),
      p.characterData !== undefined
        ? (p.characterData === null
          ? null
          : JSON.stringify({ ...(ex.characterData ?? {}), ...p.characterData }))
        : existing.character_data_json,
      t, charId, userId
    );

    const nextChar = {
      ...ex,
      name: p.name ?? ex.name,
      playerName: p.playerName ?? ex.playerName,
      className: p.className ?? ex.className,
      species: p.species ?? ex.species,
      level: p.level ?? ex.level,
      hpMax: p.hpMax ?? ex.hpMax,
      hpCurrent: p.hpCurrent ?? ex.hpCurrent,
      ac: p.ac ?? ex.ac,
      speed: p.speed ?? ex.speed,
      strScore: p.strScore !== undefined ? p.strScore : ex.strScore,
      dexScore: p.dexScore !== undefined ? p.dexScore : ex.dexScore,
      conScore: p.conScore !== undefined ? p.conScore : ex.conScore,
      intScore: p.intScore !== undefined ? p.intScore : ex.intScore,
      wisScore: p.wisScore !== undefined ? p.wisScore : ex.wisScore,
      chaScore: p.chaScore !== undefined ? p.chaScore : ex.chaScore,
      color: p.color !== undefined ? p.color : ex.color,
    };
    syncAssignedPlayerRows(db, ctx.broadcast, charId, buildMirroredPlayerSnapshot(nextChar), t, userId);

    const updated = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(charId) as Record<string, unknown>;
    res.json(toCharacterSheetDto({ ...rowToCharacterSheet(updated), campaigns: [] }));
  });

  // Player self-updates their linked campaign-character conditions.
  app.patch("/api/me/characters/:id/conditions", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;

    const conditions = Array.isArray(req.body?.conditions) ? req.body.conditions : [];
    const t = now();

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(player_id) as Record<string, unknown>;
      const player = rowToCampaignCharacter(pRow);
      updateCampaignCharacterLive(db, player_id, player, { conditions }, t);
      ctx.broadcast("players:changed", { campaignId: campaign_id });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, conditions });
  });

  // Player self-updates death saves on both the sheet and any linked campaign characters.
  app.patch("/api/me/characters/:id/deathSaves", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;

    const { success = 0, fail = 0 } = (req.body ?? {}) as { success?: number; fail?: number };
    const deathSaves = {
      success: Math.min(3, Math.max(0, Math.floor(Number(success) || 0))),
      fail:    Math.min(3, Math.max(0, Math.floor(Number(fail)    || 0))),
    };
    const deathSavesJson = JSON.stringify(deathSaves);
    const t = now();

    const currentRow = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, (req as any).user.userId) as Record<string, unknown>;
    const current = rowToCharacterSheet(currentRow);
    db.prepare("UPDATE user_characters SET sheet_json=?, updated_at=? WHERE id=?")
      .run(
        serializeCharacterSheetState({
          ...buildCharacterSheetState(current),
          deathSaves,
        }),
        t,
        charId,
      );

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(player_id) as Record<string, unknown>;
      const player = rowToCampaignCharacter(pRow);
      updateCampaignCharacterLive(db, player_id, player, { deathSaves }, t);
      ctx.broadcast("players:changed", { campaignId: campaign_id });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, deathSaves });
  });

  // Player self-updates character sheet overrides.
  app.patch("/api/me/characters/:id/overrides", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = (req as any).user.userId;
    const existing = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    const ex = rowToCharacterSheet(existing);
    const parsed = parseBody(OverridesBody, req);
    const overrides = {
      tempHp: Math.max(0, Math.floor(Number(parsed.tempHp) || 0)),
      acBonus: Math.floor(Number(parsed.acBonus) || 0),
      hpMaxBonus: Math.floor(Number(parsed.hpMaxBonus) || 0),
    };
    const t = now();

    const nextCharacterData = {
      ...(ex.characterData ?? {}),
      sheetOverrides: overrides,
    };
    db.prepare("UPDATE user_characters SET character_data_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(JSON.stringify(nextCharacterData), t, charId, userId);

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(player_id) as Record<string, unknown>;
      const player = rowToCampaignCharacter(pRow);
      updateCampaignCharacterLive(db, player_id, player, { overrides }, t);
      ctx.broadcast("players:changed", { campaignId: campaign_id });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, overrides });
  });

  // Toggle inspiration on linked campaign characters.
  app.patch("/api/me/characters/:id/inspiration", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;

    const inspiration: boolean = typeof req.body?.inspiration === "boolean" ? req.body.inspiration : false;
    const t = now();

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
        .get(player_id) as Record<string, unknown> | undefined;
      if (!pRow) continue;
      const player = rowToCampaignCharacter(pRow);
      const overrides = { ...(player.overrides ?? DEFAULT_OVERRIDES), inspiration };
      updateCampaignCharacterLive(db, player_id, player, { overrides }, t);
      ctx.broadcast("players:changed", { campaignId: campaign_id });
    }

    res.json({ ok: true, inspiration });
  });

  // Update shared notes (written to user_characters + synced to all players rows + broadcast)
  app.patch("/api/me/characters/:id/sharedNotes", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;

    const sharedNotes: string = typeof req.body?.sharedNotes === "string" ? req.body.sharedNotes : "";
    const t = now();

    db.prepare("UPDATE user_characters SET shared_notes=?, updated_at=? WHERE id=?")
      .run(sharedNotes, t, charId);

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET shared_notes=?, updated_at=? WHERE id=?")
        .run(sharedNotes, t, player_id);
      ctx.broadcast("players:changed", { campaignId: campaign_id });
    }

    res.json({ ok: true, sharedNotes });
  });

  // Delete a user-owned character (cascades to character_campaigns)
  app.delete("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("DELETE FROM players WHERE id = ?").run(player_id);
      ctx.broadcast("players:changed", { campaignId: campaign_id });
    }

    // Linked campaign characters are deleted alongside the sheet.
    db.prepare("DELETE FROM user_characters WHERE id = ?").run(charId);
    res.json({ ok: true });
  });

  // Assign character to one or more campaigns
  app.post("/api/me/characters/:id/assign", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = (req as any).user.userId;

    const existing = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });
    const char = rowToCharacterSheet(existing);

    const { campaignIds } = parseBody(AssignBody, req);
    const t = now();
    const results: { campaignId: string; playerId: string }[] = [];
    const snapshot = buildMirroredPlayerSnapshot(char);

    for (const campaignId of campaignIds) {
      // Verify user is a member of the campaign
      const membership = db
        .prepare("SELECT id FROM campaign_membership WHERE campaign_id = ? AND user_id = ?")
        .get(campaignId, userId);
      if (!membership) continue;

      const existing_link = db
        .prepare("SELECT id FROM players WHERE campaign_id = ? AND character_id = ?")
        .get(campaignId, charId) as { id: string } | undefined;

      if (existing_link?.id) {
        updateProjectedPlayerRow(db, existing_link.id, snapshot, t, userId);
        ctx.broadcast("players:changed", { campaignId });
        results.push({ campaignId, playerId: existing_link.id });
        continue;
      }

      const playerId = uid();
      insertProjectedPlayerRow(db, {
        playerId,
        campaignId,
        characterId: charId,
        snapshot,
        liveState: buildCampaignCharacterLiveState(char),
        createdAt: t,
        updatedAt: t,
        userId,
      });

      ctx.broadcast("players:changed", { campaignId });
      results.push({ campaignId, playerId });
    }

    res.json({ ok: true, results });
  });

  // Unassign character from a campaign
  app.post("/api/me/characters/:id/unassign", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = (req as any).user.userId;

    const existing = db
      .prepare("SELECT id FROM user_characters WHERE id = ? AND user_id = ?")
      .get(charId, userId) as { id: string } | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    const { campaignId } = parseBody(UnassignBody, req);

    const link = db
      .prepare("SELECT id FROM players WHERE character_id = ? AND campaign_id = ?")
      .get(charId, campaignId) as { id: string } | undefined;

    if (link?.id) {
      db.prepare("DELETE FROM players WHERE id = ?").run(link.id);
      ctx.broadcast("players:changed", { campaignId });
    }

    res.json({ ok: true });
  });

  // Upload character portrait image.
  app.post("/api/me/characters/:id/image", requireAuth, ctx.upload.single("image"), async (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;
    if (!req.file) return res.status(400).json({ ok: false, message: "No file" });
    if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ ok: false, message: "Unsupported image type" });
    }
    let thumbnail: Buffer;
    try { thumbnail = await resizeToWebP(req.file.buffer); }
    catch { return res.status(400).json({ ok: false, message: "Could not process image" }); }

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "character-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });
    const filename = `${charId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), thumbnail);
    const imageUrl = `/character-images/${filename}`;
    db.prepare("UPDATE user_characters SET image_url = ?, updated_at = ? WHERE id = ?").run(imageUrl, now(), charId);
    res.json({ ok: true, imageUrl: absolutizePublicUrl(imageUrl) });
  });

  // Remove character portrait image.
  app.delete("/api/me/characters/:id/image", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "character-images");
    const imgPath = ctx.path.join(imagesDir, `${charId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }
    db.prepare("UPDATE user_characters SET image_url = NULL, updated_at = ? WHERE id = ?").run(now(), charId);
    res.json({ ok: true });
  });
}
