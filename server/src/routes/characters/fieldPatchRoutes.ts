// Player self-service PATCH endpoints that update a single field of a character's live state.
// The sheet is its one home: campaigns and fights read it from there (lib/playerRowsView.ts), so
// these write the sheet only and then tell them to read again.

import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../../server/context.js";
import type { StoredConditionInstance } from "../../server/userData.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import { rowToCharacterSheet, CHARACTER_SHEET_COLS } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  getAssignedPlayers,
  broadcastPlayerCombatantChanges,
  sheetOwnLiveState,
  buildCharacterSheetState,
  characterSheetDbColumns,
} from "../../services/characters.js";
import { ConditionInstanceSchema } from "../../lib/schemas.js";
import { detectEndedConcentration, resolveConditionTransition, shouldClearTrackedConcentration } from "../../services/combatTransitions.js";
import { sweepDependentConditions } from "../../services/combat.js";
import { OverridesBody, requireOwnedCharacter, makeEmitPlayerChange, spellStateRevOf } from "./helpers.js";

const ConditionsBody = z.object({
  conditions: z.array(ConditionInstanceSchema).max(100),
  previousConditions: z.array(ConditionInstanceSchema).max(100).optional(),
});

// A bonus stacked on the character's score (Permanent Buffs), not the
// absolute score -- can legitimately be negative, so only finite/non-zero is
// filtered here, not an absolute 1-30 range (that clamp applies to the
// resulting score, computed client-side).
function normalizeAbilityScores(value: unknown): { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const next: { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number } = {};
  for (const key of ["str", "dex", "con", "int", "wis", "cha"] as const) {
    const parsed = Math.floor(Number(raw[key]));
    if (Number.isFinite(parsed) && parsed !== 0 && Math.abs(parsed) <= 30) next[key] = parsed;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function registerCharacterFieldPatchRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now } = ctx.helpers;
  const emitPlayerChange = makeEmitPlayerChange(ctx);

  // The character's live state changed on its sheet: tell every campaign it plays in, and every
  // fight it stands in, to read it again. A notification only - there is nothing to copy.
  const announceLiveChange = (charId: string) => {
    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);
    }
  };

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
    // The sheet is the one home of the character's conditions, in or out of any campaign.
    const previousConditions = sheetOwnLiveState(charSheet).conditions;
    if (parsed.previousConditions && JSON.stringify(previousConditions) !== JSON.stringify(parsed.previousConditions)) {
      return res.status(409).json({ ok: false, code: "conditions-conflict", message: "Conditions changed elsewhere. Reload and try again." });
    }
    conditions = resolveConditionTransition({
      hpCurrent: charSheet.hpCurrent,
      conditions,
      stampMissingConcentration: true,
    });
    if (shouldClearTrackedConcentration(conditions)) {
      db.prepare(`
        UPDATE user_characters
        SET character_data_json = json_set(COALESCE(character_data_json, '{}'), '$.concentrationSpell', NULL)
        WHERE id = ?
      `).run(charId);
    }

    const t = now();
    // Written once, to the sheet. Every campaign and fight the character is in reads it from there
    // (lib/playerRowsView.ts); speed under a condition is worked out when read.
    db.prepare("UPDATE user_characters SET live_json = json_set(live_json, '$.conditions', json(?)), updated_at = ? WHERE id = ?")
      .run(JSON.stringify(conditions), t, charId);

    for (const { player_id, campaign_id } of getAssignedPlayers(db, charId)) {
      emitPlayerChange({ campaignId: campaign_id, action: "upsert", playerId: player_id, characterId: charId });
      broadcastPlayerCombatantChanges(db, ctx.broadcast, player_id);

      // If this character's combatant(s) just lost concentration, strip dependent conditions
      // (Hexed/Marked/etc.) elsewhere in the same encounter that were owned by that session.
      const combatantRows = db.prepare(
        `SELECT id, encounter_id FROM combatants WHERE base_type = 'player' AND base_id = ?`
      ).all(player_id) as { id: string; encounter_id: string }[];
      for (const { id: combatantId, encounter_id: combatantEncounterId } of combatantRows) {
        const ended = detectEndedConcentration(combatantId, previousConditions, conditions);
        if (ended) sweepDependentConditions(db, ctx.broadcast, combatantEncounterId, ended, t, combatantId);
      }
    }

    const updatedCharacterData = JSON.parse((db
      .prepare("SELECT character_data_json FROM user_characters WHERE id = ?")
      .pluck()
      .get(charId) as string | null) ?? "{}") as Record<string, unknown>;
    res.json({ ok: true, conditions, spellStateRev: spellStateRevOf(updatedCharacterData) });
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
    // Written once, to the sheet; campaigns and fights read it from there.
    db.prepare("UPDATE user_characters SET death_saves_success=?, death_saves_fail=?, updated_at=? WHERE id=?")
      .run(sheetCols.deathSavesSuccess, sheetCols.deathSavesFail, t, charId);
    announceLiveChange(charId);

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
    const existingSheetOverrides = (ex.live?.overrides && typeof ex.live.overrides === "object")
      ? ex.live.overrides as unknown as Record<string, unknown>
      : undefined;
    const existingAbilityScores = normalizeAbilityScores(existingSheetOverrides?.abilityScores);
    const existingPermanent = existingSheetOverrides?.permanent && typeof existingSheetOverrides.permanent === "object"
      ? existingSheetOverrides.permanent as Record<string, boolean>
      : undefined;
    const abilityScores = parsed.abilityScores === undefined
      ? existingAbilityScores
      : normalizeAbilityScores(parsed.abilityScores);
    const overrides = {
      tempHp: Math.max(0, Math.floor(Number(parsed.tempHp) || 0)),
      acBonus: Math.floor(Number(parsed.acBonus) || 0),
      hpMaxBonus: Math.floor(Number(parsed.hpMaxBonus) || 0),
      ...(abilityScores ? { abilityScores } : {}),
      ...(parsed.permanent ?? existingPermanent ? { permanent: parsed.permanent ?? existingPermanent } : {}),
    };
    const t = now();

    // Written once, to the sheet's live state (keeping its inspiration); campaigns and fights read
    // it from there.
    const nextOverrides = { ...overrides, inspiration: existingSheetOverrides?.inspiration === true };
    db.prepare("UPDATE user_characters SET live_json = json_set(live_json, '$.overrides', json(?)), updated_at = ? WHERE id = ? AND user_id = ?")
      .run(JSON.stringify(nextOverrides), t, charId, userId);
    announceLiveChange(charId);

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
    // Written once, to the sheet; campaigns and fights read it from there.
    // json_set does not create a missing parent object, so the bonuses object is built if absent.
    db.prepare(`
      UPDATE user_characters
      SET live_json = json_set(live_json, '$.overrides',
            json_set(COALESCE(json_extract(live_json, '$.overrides'), json('{}')), '$.inspiration', json(?))),
          updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(inspiration), t, charId);
    announceLiveChange(charId);

    res.json({ ok: true, inspiration });
  });

  // Shared notes are handled in routes/sharedNotes.ts, alongside the DM's side of them.
}
