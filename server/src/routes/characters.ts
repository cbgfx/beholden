// server/src/routes/characters.ts
// Player-owned characters: campaign-agnostic CRUD + campaign assignment.

import { z } from "zod";
import type { Express, Response } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { rowToUserCharacter, USER_CHARACTER_COLS } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "../lib/defaults.js";
import { normalizeCharacterData } from "../lib/characterData.js";
import {
  type Assignment,
  getAssignments,
  assignmentsToJson,
  getAssignedPlayers,
  broadcastPlayerCombatantChanges,
  mergeLiveStats,
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
      .prepare(`SELECT ${USER_CHARACTER_COLS} FROM user_characters WHERE user_id = ? ORDER BY updated_at DESC`)
      .all(userId) as Record<string, unknown>[];

    const result = chars.map((c) => {
      const char = rowToUserCharacter(c);
      const assignments = getAssignments(db, char.id);
      return { ...mergeLiveStats(db, char, assignments), campaigns: assignmentsToJson(assignments) };
    });

    res.json(result);
  });

  // Get a single user-owned character
  app.get("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = (req as any).user.userId;
    const row = db
      .prepare(`SELECT ${USER_CHARACTER_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });

    const char = rowToUserCharacter(row);
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

    res.json({
      ...merged,
      campaignSharedNotes: JSON.stringify(campaignNotes),
      campaigns: assignmentsToJson(assignments),
    });
  });

  // Create a new user-owned character (no campaign required)
  app.post("/api/me/characters", requireAuth, (req, res) => {
    const userId = (req as any).user.userId;
    const p = parseBody(CharacterCreateBody, req);
    const id = uid();
    const t = now();

    db.prepare(`
      INSERT INTO user_characters
        (id, user_id, name, player_name, class_name, species, level,
         hp_max, hp_current, ac, speed,
         str_score, dex_score, con_score, int_score, wis_score, cha_score,
         color, character_data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId,
      p.name,
      p.playerName ?? "",
      p.className ?? "",
      p.species ?? "",
      p.level ?? 1,
      p.hpMax ?? 0,
      p.hpCurrent ?? p.hpMax ?? 0,
      p.ac ?? 10,
      p.speed ?? 30,
      p.strScore ?? null, p.dexScore ?? null, p.conScore ?? null,
      p.intScore ?? null, p.wisScore ?? null, p.chaScore ?? null,
      p.color ?? null,
      p.characterData ? JSON.stringify(normalizeCharacterData(p.characterData)) : null,
      t, t
    );

    const row = db.prepare(`SELECT ${USER_CHARACTER_COLS} FROM user_characters WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json({ ...rowToUserCharacter(row), campaigns: [] });
  });

  // Update a user-owned character
  app.put("/api/me/characters/:id", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = (req as any).user.userId;
    const existing = db
      .prepare(`SELECT ${USER_CHARACTER_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    const p = parseBody(CharacterUpdateBody, req);
    const t = now();
    const ex = rowToUserCharacter(existing);

    db.prepare(`
      UPDATE user_characters SET
        name=?, player_name=?, class_name=?, species=?, level=?,
        hp_max=?, hp_current=?, ac=?, speed=?,
        str_score=?, dex_score=?, con_score=?, int_score=?, wis_score=?, cha_score=?,
        color=?, character_data_json=?, updated_at=?
      WHERE id=? AND user_id=?
    `).run(
      p.name ?? ex.name,
      p.playerName ?? ex.playerName,
      p.className ?? ex.className,
      p.species ?? ex.species,
      p.level ?? ex.level,
      p.hpMax ?? ex.hpMax,
      p.hpCurrent ?? ex.hpCurrent,
      p.ac ?? ex.ac,
      p.speed ?? ex.speed,
      p.strScore !== undefined ? p.strScore : ex.strScore,
      p.dexScore !== undefined ? p.dexScore : ex.dexScore,
      p.conScore !== undefined ? p.conScore : ex.conScore,
      p.intScore !== undefined ? p.intScore : ex.intScore,
      p.wisScore !== undefined ? p.wisScore : ex.wisScore,
      p.chaScore !== undefined ? p.chaScore : ex.chaScore,
      p.color !== undefined ? p.color : ex.color,
      p.characterData !== undefined
        ? (p.characterData === null
          ? null
          : JSON.stringify(normalizeCharacterData({ ...(ex.characterData ?? {}), ...p.characterData })))
        : existing.character_data_json,
      t, charId, userId
    );

    // Sync all assigned campaign players rows with updated stats
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare(`
        UPDATE players SET
          character_name=?, class=?, species=?, level=?,
          hp_max=?, hp_current=?, ac=?, speed=?,
          str=?, dex=?, con=?, int=?, wis=?, cha=?,
          color=?, updated_at=?
        WHERE id=?
      `).run(
        p.name ?? ex.name,
        p.className ?? ex.className,
        p.species ?? ex.species,
        p.level ?? ex.level,
        p.hpMax ?? ex.hpMax,
        p.hpCurrent ?? ex.hpCurrent,
        p.ac ?? ex.ac,
        p.speed ?? ex.speed,
        p.strScore !== undefined ? p.strScore : ex.strScore,
        p.dexScore !== undefined ? p.dexScore : ex.dexScore,
        p.conScore !== undefined ? p.conScore : ex.conScore,
        p.intScore !== undefined ? p.intScore : ex.intScore,
        p.wisScore !== undefined ? p.wisScore : ex.wisScore,
        p.chaScore !== undefined ? p.chaScore : ex.chaScore,
        p.color !== undefined ? p.color : ex.color,
        t, player_id
      );
      ctx.broadcast("players:changed", { campaignId: campaign_id });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    const updated = db.prepare(`SELECT ${USER_CHARACTER_COLS} FROM user_characters WHERE id = ?`).get(charId) as Record<string, unknown>;
    res.json(rowToUserCharacter(updated));
  });

  // Player self-updates their own conditions (writes to players.conditions_json + broadcasts)
  app.patch("/api/me/characters/:id/conditions", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;

    const conditions = Array.isArray(req.body?.conditions) ? req.body.conditions : [];
    const conditionsJson = JSON.stringify(conditions);
    const t = now();

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET conditions_json=?, updated_at=? WHERE id=?")
        .run(conditionsJson, t, player_id);
      ctx.broadcast("players:changed", { campaignId: campaign_id });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, conditions });
  });

  // Player self-updates death saves (writes to both user_characters + players rows, broadcasts)
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

    db.prepare("UPDATE user_characters SET death_saves_json=?, updated_at=? WHERE id=?")
      .run(deathSavesJson, t, charId);

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      db.prepare("UPDATE players SET death_saves_json=?, updated_at=? WHERE id=?")
        .run(deathSavesJson, t, player_id);
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
      .prepare(`SELECT ${USER_CHARACTER_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });

    const ex = rowToUserCharacter(existing);
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
      db.prepare("UPDATE players SET overrides_json = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(overrides), t, player_id);
      ctx.broadcast("players:changed", { campaignId: campaign_id });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, overrides });
  });

  // Toggle inspiration (writes to linked players overrides_json + broadcasts)
  app.patch("/api/me/characters/:id/inspiration", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireUserChar(charId, (req as any).user.userId, res)) return;

    const inspiration: boolean = typeof req.body?.inspiration === "boolean" ? req.body.inspiration : false;
    const t = now();

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const row = db.prepare("SELECT overrides_json FROM players WHERE id = ?")
        .get(player_id) as { overrides_json: string } | undefined;
      const overrides = JSON.parse(row?.overrides_json || "{}") as Record<string, unknown>;
      overrides.inspiration = inspiration;
      db.prepare("UPDATE players SET overrides_json=?, updated_at=? WHERE id=?")
        .run(JSON.stringify(overrides), t, player_id);
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

    // CASCADE handles character_campaigns deletion
    db.prepare("DELETE FROM user_characters WHERE id = ?").run(charId);
    res.json({ ok: true });
  });

  // Assign character to one or more campaigns
  app.post("/api/me/characters/:id/assign", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = (req as any).user.userId;

    const existing = db
      .prepare(`SELECT ${USER_CHARACTER_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, userId) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Not found" });
    const char = rowToUserCharacter(existing);

    const { campaignIds } = parseBody(AssignBody, req);
    const t = now();
    const results: { campaignId: string; playerId: string }[] = [];

    for (const campaignId of campaignIds) {
      // Verify user is a member of the campaign
      const membership = db
        .prepare("SELECT id FROM campaign_membership WHERE campaign_id = ? AND user_id = ?")
        .get(campaignId, userId);
      if (!membership) continue;

      // Check if already assigned
      const existing_link = db
        .prepare("SELECT id, player_id FROM character_campaigns WHERE character_id = ? AND campaign_id = ?")
        .get(charId, campaignId) as { id: string; player_id: string | null } | undefined;

      if (existing_link?.player_id) {
        // Already assigned — sync stats instead
        db.prepare(`
          UPDATE players SET
            character_name=?, class=?, species=?, level=?,
            hp_max=?, hp_current=?, ac=?, speed=?,
            str=?, dex=?, con=?, int=?, wis=?, cha=?,
            color=?, user_id=?, updated_at=?
          WHERE id=?
        `).run(
          char.name, char.className, char.species, char.level,
          char.hpMax, char.hpCurrent, char.ac, char.speed,
          char.strScore, char.dexScore, char.conScore,
          char.intScore, char.wisScore, char.chaScore,
          char.color, userId, t, existing_link.player_id
        );
        ctx.broadcast("players:changed", { campaignId });
        results.push({ campaignId, playerId: existing_link.player_id });
        continue;
      }

      // Create a players row for this campaign
      const playerId = uid();
      db.prepare(`
        INSERT INTO players
          (id, campaign_id, user_id, player_name, character_name, class, species, level,
           hp_max, hp_current, ac, speed, str, dex, con, int, wis, cha, color,
           overrides_json, conditions_json, death_saves_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        playerId, campaignId, userId,
        char.playerName || "Player",
        char.name,
        char.className || "Class",
        char.species || "Species",
        char.level,
        char.hpMax, char.hpCurrent, char.ac, char.speed,
        char.strScore, char.dexScore, char.conScore,
        char.intScore, char.wisScore, char.chaScore,
        char.color,
        JSON.stringify(DEFAULT_OVERRIDES),
        JSON.stringify([]),
        JSON.stringify(DEFAULT_DEATH_SAVES),
        t, t
      );

      // Upsert character_campaigns link
      if (existing_link) {
        db.prepare("UPDATE character_campaigns SET player_id = ? WHERE id = ?").run(playerId, existing_link.id);
      } else {
        db.prepare(`
          INSERT INTO character_campaigns (id, character_id, campaign_id, player_id)
          VALUES (?, ?, ?, ?)
        `).run(uid(), charId, campaignId, playerId);
      }

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
      .prepare("SELECT id, player_id FROM character_campaigns WHERE character_id = ? AND campaign_id = ?")
      .get(charId, campaignId) as { id: string; player_id: string | null } | undefined;

    if (link?.player_id) {
      db.prepare("DELETE FROM players WHERE id = ?").run(link.player_id);
      ctx.broadcast("players:changed", { campaignId });
    }

    if (link) {
      db.prepare("DELETE FROM character_campaigns WHERE id = ?").run(link.id);
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
