// Player self-service PATCH endpoints that update a single field on a user-owned character
// sheet and sync it out to any linked campaign-character (players) rows.

import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../../server/context.js";
import type { StoredConditionInstance } from "../../server/userData.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import { rowToCampaignCharacter, rowToCharacterSheet, CHARACTER_SHEET_COLS, getCampaignCharacterRow } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { DEFAULT_OVERRIDES } from "../../lib/defaults.js";
import {
  getAssignedPlayers,
  broadcastPlayerCombatantChanges,
  buildCharacterSheetState,
  characterSheetDbColumns,
  updateCampaignCharacterLive,
} from "../../services/characters.js";
import { ConditionInstanceSchema } from "../../lib/schemas.js";
import { applyConditionConsequences, conditionsBreakConcentration, detectEndedConcentration, shouldClearTrackedConcentration } from "../../services/combatTransitions.js";
import { sweepDependentConditions } from "../../services/combat.js";
import { hasZeroSpeedCondition, SLOW_SPEED_PENALTY } from "@beholden/shared/domain/conditions";
import { OverridesBody, requireOwnedCharacter, makeEmitPlayerChange } from "./helpers.js";

const ConditionsBody = z.object({
  conditions: z.array(ConditionInstanceSchema).max(100),
});

function normalizeAbilityScores(value: unknown): { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const next: { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number } = {};
  for (const key of ["str", "dex", "con", "int", "wis", "cha"] as const) {
    const parsed = Math.floor(Number(raw[key]));
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 30) next[key] = parsed;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function registerCharacterFieldPatchRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now } = ctx.helpers;
  const emitPlayerChange = makeEmitPlayerChange(ctx);

  // Player self-updates their linked campaign-character conditions.

  // MARK: - PATCH /api/me/characters/:id/conditions
  app.patch("/api/me/characters/:id/conditions", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;

    const parsed = parseBody(ConditionsBody, req);
    let conditions: StoredConditionInstance[] = parsed.conditions.map((condition) => {
      const { casterId, hexAbility, concentrationId, ...rest } = condition;
      return {
        ...rest,
        key: condition.key,
        ...(casterId !== undefined ? { casterId } : {}),
        ...(hexAbility !== undefined ? { hexAbility } : {}),
        ...(concentrationId !== undefined ? { concentrationId } : {}),
      };
    });
    const charSheetRow = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ?`)
      .get(charId) as Record<string, unknown> | undefined;
    if (!charSheetRow) return res.status(404).json({ ok: false, message: "Not found" });
    const charSheet = rowToCharacterSheet(charSheetRow);
    const baseSpeed = charSheet.speed;
    conditions = applyConditionConsequences({
      hpCurrent: charSheet.hpCurrent,
      conditions,
    });
    if (conditionsBreakConcentration(conditions)) {
      conditions = conditions.filter((condition) => condition.key !== "concentration");
    }
    if (shouldClearTrackedConcentration(conditions)) {
      db.prepare(`
        UPDATE user_characters
        SET character_data_json = json_set(COALESCE(character_data_json, '{}'), '$.concentrationSpell', NULL)
        WHERE id = ?
      `).run(charId);
    }

    const t = now();

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = getCampaignCharacterRow(db, player_id)!;
      const player = rowToCampaignCharacter(pRow);
      const previousConditions: StoredConditionInstance[] = Array.isArray(player.conditions) ? player.conditions : [];

      let newSpeed = baseSpeed;
      const hasSlow = conditions.some(c => c.key === "slow");
      if (hasZeroSpeedCondition(conditions)) {
        newSpeed = 0;
      } else if (hasSlow) {
        newSpeed = Math.max(0, baseSpeed - SLOW_SPEED_PENALTY);
      }
      if (newSpeed !== player.speed) {
        db.prepare("UPDATE players SET speed = ?, updated_at = ? WHERE id = ?").run(newSpeed, t, player_id);
      }

      updateCampaignCharacterLive(db, player_id, player, { conditions }, t);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);

      // If this player's combatant(s) just lost concentration, strip dependent conditions
      // (Hexed/Marked/etc.) elsewhere in the same encounter that were owned by that session.
      const combatantRows = db.prepare(
        `SELECT id, encounter_id FROM combatants WHERE base_type = 'player' AND base_id = ?`
      ).all(player_id) as { id: string; encounter_id: string }[];
      for (const { id: combatantId, encounter_id: combatantEncounterId } of combatantRows) {
        const ended = detectEndedConcentration(combatantId, previousConditions, conditions);
        if (ended) sweepDependentConditions(db, ctx.broadcast, combatantEncounterId, ended, t, combatantId);
      }
    }

    res.json({ ok: true, conditions });
  });

  // Player self-updates death saves on both the sheet and any linked campaign characters.

  // MARK: - PATCH /api/me/characters/:id/deathSaves
  app.patch("/api/me/characters/:id/deathSaves", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;

    const { success = 0, fail = 0 } = (req.body ?? {}) as { success?: number; fail?: number };
    const deathSaves = {
      success: Math.min(3, Math.max(0, Math.floor(Number(success) || 0))),
      fail:    Math.min(3, Math.max(0, Math.floor(Number(fail)    || 0))),
    };
    const t = now();

    const currentRow = db
      .prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters WHERE id = ? AND user_id = ?`)
      .get(charId, req.user!.userId) as Record<string, unknown>;
    const current = rowToCharacterSheet(currentRow);
    const sheetCols = characterSheetDbColumns({
      ...buildCharacterSheetState(current),
      deathSaves,
    });
    db.prepare("UPDATE user_characters SET death_saves_success=?, death_saves_fail=?, updated_at=? WHERE id=?")
      .run(sheetCols.deathSavesSuccess, sheetCols.deathSavesFail, t, charId);

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = getCampaignCharacterRow(db, player_id)!;
      const player = rowToCampaignCharacter(pRow);
      updateCampaignCharacterLive(db, player_id, player, { deathSaves }, t);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, deathSaves });
  });

  // Player self-updates character sheet overrides.

  // MARK: - PATCH /api/me/characters/:id/overrides
  app.patch("/api/me/characters/:id/overrides", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    const userId = req.user!.userId;
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
    const abilityScores = parsed.abilityScores === undefined
      ? existingAbilityScores
      : normalizeAbilityScores(parsed.abilityScores);
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
      const pRow = getCampaignCharacterRow(db, player_id)!;
      const player = rowToCampaignCharacter(pRow);
      updateCampaignCharacterLive(db, player_id, player, {
        overrides: {
          ...overrides,
          inspiration: player.overrides?.inspiration ?? false,
        },
      }, t);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }

    res.json({ ok: true, overrides });
  });

  // Toggle inspiration on linked campaign characters.

  // MARK: - PATCH /api/me/characters/:id/inspiration
  app.patch("/api/me/characters/:id/inspiration", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;

    const inspiration: boolean = typeof req.body?.inspiration === "boolean" ? req.body.inspiration : false;
    const t = now();

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      const pRow = getCampaignCharacterRow(db, player_id);
      if (!pRow) continue;
      const player = rowToCampaignCharacter(pRow);
      const overrides = { ...(player.overrides ?? DEFAULT_OVERRIDES), inspiration };
      updateCampaignCharacterLive(db, player_id, player, { overrides }, t);
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
    }

    res.json({ ok: true, inspiration });
  });

  // Update shared notes (written to user_characters + synced to all players rows + broadcast)

  // MARK: - PATCH /api/me/characters/:id/sharedNotes
  app.patch("/api/me/characters/:id/sharedNotes", requireAuth, (req, res) => {
    const charId = requireParam(req, res, "id");
    if (!charId) return;
    if (!requireOwnedCharacter(db, charId, req.user!.userId, res)) return;

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
}
