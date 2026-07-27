// server/src/routes/characters.ts
// Player-owned characters: campaign-agnostic CRUD + campaign assignment.

import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { cleanStoredImageUrl, normalizeCharacterSheetForStorage, rowToCharacterSheet, CHARACTER_SHEET_COLS } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { toCharacterCampaignAssignmentDto, toCharacterSheetDto } from "../lib/apiActors.js";
import {
  getAssignments,
  getAssignmentsForCharacters,
  getCharacterSheetOverrides,
  assignmentsToJson,
  getAssignedPlayers,
  buildCampaignCharacterLiveState,
  buildMirroredPlayerSnapshot,
  characterSheetDbColumns,
  insertProjectedPlayerRow,
  mergeLiveStats,
  syncAssignedPlayerRows,
  updateProjectedPlayerRow,
} from "../services/characters.js";
import { ACCEPTED_IMAGE_TYPES, resizeToWebP } from "../lib/imageHelpers.js";
import { absolutizePublicUrlForRequest } from "../lib/publicUrl.js";
import { withAbsoluteImageUrl } from "../lib/routeImageUrl.js";
import {
  syncLinkedMortalAgeFromCharacter,
  syncLinkedMortalPortraitFromCharacter,
} from "../services/binders/linkedCharacterSync.js";
import { preserveProficienciesOnLevelUp } from "../lib/levelUpProficiencies.js";
import {
  AssignBody,
  CharacterCreateBody,
  CharacterUpdateBody,
  UnassignBody,
  collectCampaignSharedNotes,
  requireOwnedCharacter,
  toCharacterSheetDtoInput,
  makeEmitPlayerChange,
} from "./characterRouteHelpers.js";
import { registerCharacterFieldPatchRoutes } from "./characterFieldPatchRoutes.js";

export function registerCharacterRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;
  const accountNameFor = (userId: string): string => {
    const user = db.prepare("SELECT name FROM users WHERE id = ?").get(userId) as { name: string } | undefined;
    return String(user?.name ?? "").trim() || "Player";
  };
  const emitPlayerChange = makeEmitPlayerChange(ctx);

  registerCharacterFieldPatchRoutes(app, ctx);

  // List all user-owned characters with campaign assignment info
  app.get("/api/me/characters", requireAuth, (req, res) => {
    const userId = req.user!.userId;
    const chars = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE user_id = ? ORDER BY updated_at DESC`)
      .all(userId) as Record<string, unknown>[];

    const sheets = chars.map((c) => rowToCharacterSheet(c));
    const assignmentsByChar = getAssignmentsForCharacters(db, sheets.map((s) => s.id));
    const result = sheets.map((char) => {
      const assignments = assignmentsByChar.get(char.id) ?? [];
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
    const userId = req.user!.userId;
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

  app.patch("/api/me/characters/:id/activity", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const body = parseBody(z.object({ isActive: z.boolean() }).strict(), req);
    const result = db.prepare(`
      UPDATE user_characters
      SET is_active = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(body.isActive ? 1 : 0, now(), charId, req.user!.userId);
    if (result.changes === 0) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, isActive: body.isActive });
  });

  // Create a new user-owned character (no campaign required)
  app.post("/api/me/characters", requireAuth, (req, res) => {
    const userId = req.user!.userId;
    const ownerName = accountNameFor(userId);
    const p = parseBody(CharacterCreateBody, req);
    const id = uid();
    const t = now();
    const normalized = normalizeCharacterSheetForStorage({
      name: p.name,
      playerName: ownerName,
      ruleset: p.ruleset,
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
    }, p.characterData ?? null);
    const sheetCols = characterSheetDbColumns(normalized.sheet);

    db.prepare(`
      INSERT INTO user_characters
        (id, user_id, name, player_name, ruleset, class_name, species, level, hp_max, hp_current, ac, speed,
         str_score, dex_score, con_score, int_score, wis_score, cha_score, color, death_saves_success, death_saves_fail,
         image_url, character_data_json, shared_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, '', ?, ?)
    `).run(
      id, userId, sheetCols.name, sheetCols.playerName, sheetCols.ruleset, sheetCols.className, sheetCols.species, sheetCols.level,
      sheetCols.hpMax, sheetCols.hpCurrent, sheetCols.ac, sheetCols.speed,
      sheetCols.strScore, sheetCols.dexScore, sheetCols.conScore, sheetCols.intScore, sheetCols.wisScore, sheetCols.chaScore,
      sheetCols.color, sheetCols.deathSavesSuccess, sheetCols.deathSavesFail,
      normalized.characterData ? JSON.stringify(normalized.characterData) : null,
      t, t,
    );

    const row = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json(withAbsoluteImageUrl(req, toCharacterSheetDto({ ...rowToCharacterSheet(row), campaigns: [] })));
  });

  // Update a user-owned character
  app.put("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = req.user!.userId;
    const ownerName = accountNameFor(userId);
    const existing = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    const p = parseBody(CharacterUpdateBody, req);
    const t = now();
    const ex = rowToCharacterSheet(existing);
    const requestedCharacterData =
      p.characterData !== undefined
        ? (p.characterData === null ? null : { ...(ex.characterData ?? {}), ...p.characterData })
        : ex.characterData;
    const mergedCharacterData = preserveProficienciesOnLevelUp(
      ex.characterData,
      requestedCharacterData,
      p.level !== undefined && p.level > ex.level,
    );
    const nextSheet = {
      name: p.name ?? ex.name,
      playerName: ownerName,
      ruleset: ex.ruleset,
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
    const normalized = normalizeCharacterSheetForStorage(nextSheet, mergedCharacterData);
    const hasSyncedDerivedStats = p.syncedHpMax !== undefined || p.syncedAc !== undefined;
    let characterDataForStorage = hasSyncedDerivedStats
      ? {
          ...(normalized.characterData ?? {}),
          ...(p.syncedHpMax !== undefined ? { derivedHpMax: p.syncedHpMax } : {}),
          ...(p.syncedAc !== undefined ? { derivedAc: p.syncedAc } : {}),
        }
      : normalized.characterData;
    if (Number(normalized.sheet.hpCurrent) <= 0 && characterDataForStorage?.concentrationSpell) {
      characterDataForStorage = { ...characterDataForStorage, concentrationSpell: null };
    }
    const finalNormalized = normalizeCharacterSheetForStorage(
      normalized.sheet,
      characterDataForStorage,
    );
    const sheetCols = characterSheetDbColumns(finalNormalized.sheet);

    db.prepare(`
      UPDATE user_characters SET
        name=?, player_name=?, class_name=?, species=?, level=?, hp_max=?, hp_current=?, ac=?, speed=?,
        str_score=?, dex_score=?, con_score=?, int_score=?, wis_score=?, cha_score=?, color=?,
        death_saves_success=?, death_saves_fail=?, character_data_json=?, updated_at=?
      WHERE id=? AND user_id=?
    `).run(
      sheetCols.name, sheetCols.playerName, sheetCols.className, sheetCols.species, sheetCols.level, sheetCols.hpMax, sheetCols.hpCurrent,
      sheetCols.ac, sheetCols.speed, sheetCols.strScore, sheetCols.dexScore, sheetCols.conScore, sheetCols.intScore, sheetCols.wisScore,
      sheetCols.chaScore, sheetCols.color, sheetCols.deathSavesSuccess, sheetCols.deathSavesFail,
      characterDataForStorage ? JSON.stringify(characterDataForStorage) : null,
      t, charId, userId
    );
    if (p.characterData !== undefined && Object.prototype.hasOwnProperty.call(p.characterData ?? {}, "age")) {
      syncLinkedMortalAgeFromCharacter(db, charId, characterDataForStorage, t);
    }

    const nextChar = {
      ...ex,
      ...finalNormalized.sheet,
      characterData: characterDataForStorage,
    };
    const sheetOverrides = getCharacterSheetOverrides(nextChar);
    syncAssignedPlayerRows(
      db,
      ctx.broadcast,
      charId,
      buildMirroredPlayerSnapshot(nextChar, p.syncedAc, p.syncedSpeed, p.syncedHpMax),
      t,
      userId,
      p.hpCurrent !== undefined || sheetOverrides
        ? {
            ...(p.hpCurrent !== undefined ? { hpCurrent: p.hpCurrent } : {}),
            ...(sheetOverrides ? { overrides: sheetOverrides } : {}),
          }
        : undefined,
    );

    const updated = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`).get(charId) as Record<string, unknown>;
    res.json(withAbsoluteImageUrl(req, toCharacterSheetDto({ ...rowToCharacterSheet(updated), campaigns: [] })));
  });

  // Delete a user-owned character (cascades to character_campaigns)
  app.delete("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;

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
    const userId = req.user!.userId;
    const isAdmin = Boolean(req.user!.isAdmin);

    const existing = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });
    const char = rowToCharacterSheet(existing);
    const cleanImageUrl = cleanStoredImageUrl(existing.image_url);

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
        if (cleanImageUrl) {
          db.prepare("UPDATE players SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?")
            .run(cleanImageUrl, existing.image_updated_at ?? t, t, existing_link.id);
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
      if (cleanImageUrl) {
        db.prepare("UPDATE players SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?")
          .run(cleanImageUrl, existing.image_updated_at ?? t, t, playerId);
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
    const userId = req.user!.userId;

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
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;
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
    db.prepare("UPDATE user_characters SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?").run(imageUrl, t, t, charId);
    // Sync image to all campaign player rows linked to this character.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?").run(imageUrl, t, t, player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }
    syncLinkedMortalPortraitFromCharacter(db, charId, imageUrl, t);
    res.json({ ok: true, imageUrl: absolutizePublicUrlForRequest(req, imageUrl) });
  });

  // Remove character portrait image.
  app.delete("/api/me/characters/:id/image", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "character-images");
    const imgPath = ctx.path.join(imagesDir, `${charId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }
    const t = now();
    db.prepare("UPDATE user_characters SET image_url = NULL, image_updated_at = ?, updated_at = ? WHERE id = ?").run(t, t, charId);
    // Sync image removal to all campaign player rows linked to this character.
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET image_url = NULL, image_updated_at = ?, updated_at = ? WHERE id = ?").run(t, t, player_id);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }
    syncLinkedMortalPortraitFromCharacter(db, charId, null, t);
    res.json({ ok: true });
  });
}
