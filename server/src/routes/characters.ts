// server/src/routes/characters.ts
// Player-owned characters: campaign-agnostic CRUD + campaign assignment.

import type { Express } from "express";
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
  characterSheetDbColumns,
  insertProjectedPlayerRow,
  mergeLiveStats,
  syncAssignedPlayerRows,
  updateProjectedPlayerRow,
  updateCampaignCharacterLive,
} from "../services/characters.js";
import { ACCEPTED_IMAGE_TYPES, resizeToWebP } from "../lib/imageHelpers.js";
import { absolutizePublicUrlForRequest } from "../lib/publicUrl.js";
import {
  AssignBody,
  CharacterCreateBody,
  CharacterUpdateBody,
  OverridesBody,
  UnassignBody,
  collectCampaignSharedNotes,
  requireOwnedCharacter,
  toCharacterSheetDtoInput,
} from "./characterRouteHelpers.js";

export function registerCharacterRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const emitPlayerChange = (args: { campaignId: string; action: "upsert" | "delete" | "refresh"; playerId?: string; characterId?: string | null }) => {
    ctx.broadcast("players:changed", { campaignId: args.campaignId });
    ctx.broadcast("players:delta", {
      campaignId: args.campaignId,
      action: args.action,
      ...(args.playerId ? { playerId: args.playerId } : {}),
      ...(args.characterId !== undefined ? { characterId: args.characterId } : {}),
    });
  };
  const normalizeAbilityScores = (value: unknown): { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number } | undefined => {
    if (!value || typeof value !== "object") return undefined;
    const raw = value as Record<string, unknown>;
    const next: { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number } = {};
    for (const key of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      const parsed = Math.floor(Number(raw[key]));
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 30) next[key] = parsed;
    }
    return Object.keys(next).length > 0 ? next : undefined;
  };

  const withAbsoluteImageUrl = <T extends { imageUrl?: string | null }>(req: Parameters<Express["get"]>[1] extends (...args: infer P) => any ? P[0] : never, value: T): T => ({
    ...value,
    ...(value.imageUrl !== undefined ? { imageUrl: absolutizePublicUrlForRequest(req, value.imageUrl) } : {}),
  });

  // List all user-owned characters with campaign assignment info
  app.get("/api/me/characters", requireAuth, (req, res) => {
    const userId = (req as any).user.userId;
    const chars = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE user_id = ? ORDER BY updated_at DESC`)
      .all(userId) as Record<string, unknown>[];

    const result = chars.map((c) => {
      const char = rowToCharacterSheet(c);
      const assignments = getAssignments(db, char.id);
      return withAbsoluteImageUrl(req, toCharacterSheetDto(
        toCharacterSheetDtoInput(
          mergeLiveStats(db, char, assignments),
          toCharacterCampaignAssignmentDto(assignmentsToJson(assignments)),
        ),
      ));
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

    res.json(
      withAbsoluteImageUrl(req, toCharacterSheetDto(
        toCharacterSheetDtoInput(
          merged,
          toCharacterCampaignAssignmentDto(assignmentsToJson(assignments)),
          collectCampaignSharedNotes(db, assignments, charId),
        ),
      )),
    );
  });

  // Create a new user-owned character (no campaign required)
  app.post("/api/me/characters", requireAuth, (req, res) => {
    const userId = (req as any).user.userId;
    const p = parseBody(CharacterCreateBody, req);
    const id = uid();
    const t = now();
    const sheetCols = characterSheetDbColumns({
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
    });

    db.prepare(`
      INSERT INTO user_characters
        (id, user_id, name, player_name, class_name, species, level, hp_max, hp_current, ac, speed,
         str_score, dex_score, con_score, int_score, wis_score, cha_score, color, death_saves_success, death_saves_fail,
         sheet_json, image_url, character_data_json, shared_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, '', ?, ?)
    `).run(
      id, userId, sheetCols.name, sheetCols.playerName, sheetCols.className, sheetCols.species, sheetCols.level,
      sheetCols.hpMax, sheetCols.hpCurrent, sheetCols.ac, sheetCols.speed,
      sheetCols.strScore, sheetCols.dexScore, sheetCols.conScore, sheetCols.intScore, sheetCols.wisScore, sheetCols.chaScore,
      sheetCols.color, sheetCols.deathSavesSuccess, sheetCols.deathSavesFail,
      sheetCols.sheetJson,
      p.characterData ? JSON.stringify(p.characterData) : null,
      t, t,
    );

    const row = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json(withAbsoluteImageUrl(req, toCharacterSheetDto({ ...rowToCharacterSheet(row), campaigns: [] })));
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
    const nextSheet = {
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
    };
    const sheetCols = characterSheetDbColumns(nextSheet);

    db.prepare(`
      UPDATE user_characters SET
        name=?, player_name=?, class_name=?, species=?, level=?, hp_max=?, hp_current=?, ac=?, speed=?,
        str_score=?, dex_score=?, con_score=?, int_score=?, wis_score=?, cha_score=?, color=?,
        death_saves_success=?, death_saves_fail=?, sheet_json=?, character_data_json=?, updated_at=?
      WHERE id=? AND user_id=?
    `).run(
      sheetCols.name, sheetCols.playerName, sheetCols.className, sheetCols.species, sheetCols.level, sheetCols.hpMax, sheetCols.hpCurrent,
      sheetCols.ac, sheetCols.speed, sheetCols.strScore, sheetCols.dexScore, sheetCols.conScore, sheetCols.intScore, sheetCols.wisScore,
      sheetCols.chaScore, sheetCols.color, sheetCols.deathSavesSuccess, sheetCols.deathSavesFail, sheetCols.sheetJson,
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
    syncAssignedPlayerRows(
      db,
      ctx.broadcast,
      charId,
      buildMirroredPlayerSnapshot(nextChar, p.syncedAc),
      t,
      userId,
      p.hpCurrent !== undefined ? { hpCurrent: p.hpCurrent } : undefined,
    );

    const updated = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(charId) as Record<string, unknown>;
    res.json(withAbsoluteImageUrl(req, toCharacterSheetDto({ ...rowToCharacterSheet(updated), campaigns: [] })));
  });

  // Player self-updates their linked campaign-character conditions.
  app.patch("/api/me/characters/:id/conditions", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, (req as any).user.userId, res)) return;

    const conditions = Array.isArray(req.body?.conditions) ? req.body.conditions : [];
    const t = now();

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(player_id) as Record<string, unknown>;
      const player = rowToCampaignCharacter(pRow);
      updateCampaignCharacterLive(db, player_id, player, { conditions }, t);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, conditions });
  });

  // Player self-updates death saves on both the sheet and any linked campaign characters.
  app.patch("/api/me/characters/:id/deathSaves", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, (req as any).user.userId, res)) return;

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
    const sheetCols = characterSheetDbColumns({
      ...buildCharacterSheetState(current),
      deathSaves,
    });
    db.prepare("UPDATE user_characters SET death_saves_success=?, death_saves_fail=?, sheet_json=?, updated_at=? WHERE id=?")
      .run(
        sheetCols.deathSavesSuccess,
        sheetCols.deathSavesFail,
        sheetCols.sheetJson,
        t,
        charId,
      );

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(player_id) as Record<string, unknown>;
      const player = rowToCampaignCharacter(pRow);
      updateCampaignCharacterLive(db, player_id, player, { deathSaves }, t);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
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
    const existingSheetOverrides = (ex.characterData?.sheetOverrides && typeof ex.characterData.sheetOverrides === "object")
      ? ex.characterData.sheetOverrides as Record<string, unknown>
      : undefined;
    const existingAbilityScores = normalizeAbilityScores(existingSheetOverrides?.abilityScores);
    const abilityScores = normalizeAbilityScores(parsed.abilityScores) ?? existingAbilityScores;
    const overrides = {
      tempHp: Math.max(0, Math.floor(Number(parsed.tempHp) || 0)),
      acBonus: Math.floor(Number(parsed.acBonus) || 0),
      hpMaxBonus: Math.floor(Number(parsed.hpMaxBonus) || 0),
      ...(abilityScores ? { abilityScores } : {}),
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
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, overrides });
  });

  // Toggle inspiration on linked campaign characters.
  app.patch("/api/me/characters/:id/inspiration", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, (req as any).user.userId, res)) return;

    const inspiration: boolean = typeof req.body?.inspiration === "boolean" ? req.body.inspiration : false;
    const t = now();

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
        .get(player_id) as Record<string, unknown> | undefined;
      if (!pRow) continue;
      const player = rowToCampaignCharacter(pRow);
      const overrides = { ...(player.overrides ?? DEFAULT_OVERRIDES), inspiration };
      updateCampaignCharacterLive(db, player_id, player, { overrides }, t);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }

    res.json({ ok: true, inspiration });
  });

  // Update shared notes (written to user_characters + synced to all players rows + broadcast)
  app.patch("/api/me/characters/:id/sharedNotes", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, (req as any).user.userId, res)) return;

    const sharedNotes: string = typeof req.body?.sharedNotes === "string" ? req.body.sharedNotes : "";
    const t = now();

    db.prepare("UPDATE user_characters SET shared_notes=?, updated_at=? WHERE id=?")
      .run(sharedNotes, t, charId);

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET shared_notes=?, updated_at=? WHERE id=?")
        .run(sharedNotes, t, player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }

    res.json({ ok: true, sharedNotes });
  });

  // Delete a user-owned character (cascades to character_campaigns)
  app.delete("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, (req as any).user.userId, res)) return;

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("DELETE FROM players WHERE id = ?").run(player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "delete", playerId: player_id, characterId: charId });
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
    const isAdmin = Boolean((req as any).user.isAdmin);

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
      // Verify user is a member of the campaign (admins are always allowed)
      if (!isAdmin) {
        const membership = db
          .prepare("SELECT id FROM campaign_membership WHERE campaign_id = ? AND user_id = ?")
          .get(campaignId, userId);
        if (!membership) continue;
      }

      const existing_link = db
        .prepare("SELECT id FROM players WHERE campaign_id = ? AND character_id = ?")
        .get(campaignId, charId) as { id: string } | undefined;

      if (existing_link?.id) {
        updateProjectedPlayerRow(db, existing_link.id, snapshot, t, userId);
        if (char.imageUrl) {
          db.prepare("UPDATE players SET image_url = ?, updated_at = ? WHERE id = ?").run(char.imageUrl, t, existing_link.id);
        }
        emitPlayerChange({ campaignId, action: "upsert", playerId: existing_link.id, characterId: charId });
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
      if (char.imageUrl) {
        db.prepare("UPDATE players SET image_url = ?, updated_at = ? WHERE id = ?").run(char.imageUrl, t, playerId);
      }

      emitPlayerChange({ campaignId, action: "upsert", playerId, characterId: charId });
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
      emitPlayerChange({ campaignId, action: "delete", playerId: link.id, characterId: charId });
    }

    res.json({ ok: true });
  });

  // Upload character portrait image.
  app.post("/api/me/characters/:id/image", requireAuth, ctx.upload.single("image"), async (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, (req as any).user.userId, res)) return;
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
    const t = now();
    db.prepare("UPDATE user_characters SET image_url = ?, updated_at = ? WHERE id = ?").run(imageUrl, t, charId);
    // Sync image to all campaign player rows linked to this character.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET image_url = ?, updated_at = ? WHERE id = ?").run(imageUrl, t, player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }
    res.json({ ok: true, imageUrl: absolutizePublicUrlForRequest(req, imageUrl) });
  });

  // Remove character portrait image.
  app.delete("/api/me/characters/:id/image", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, (req as any).user.userId, res)) return;
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "character-images");
    const imgPath = ctx.path.join(imagesDir, `${charId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }
    const t = now();
    db.prepare("UPDATE user_characters SET image_url = NULL, updated_at = ? WHERE id = ?").run(t, charId);
    // Sync image removal to all campaign player rows linked to this character.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET image_url = NULL, updated_at = ? WHERE id = ?").run(t, player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }
    res.json({ ok: true });
  });
}
