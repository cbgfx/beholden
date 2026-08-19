import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import type { StoredCombatState } from "../../server/userData.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import { dmOrAdmin, memberOrAdmin } from "../../middleware/campaignAuth.js";
import { rowToCampaignCharacter, rowToEncounterActor } from "../../lib/db.js";

import {
  ensureCombat,
  syncCombatantToPlayer,
  syncCombatantToBinderNpc,
  hydratePlayerCombatant,
  loadCombatants,
  updateEncounterActor,
  updateCombatant,
  sweepDependentConditions,
} from "../../services/combat.js";
import { DEFAULT_OVERRIDES } from "../../lib/defaults.js";
import { toEncounterActorDto } from "../../lib/apiActors.js";
import { CombatantUpdateBody, CombatStateBody } from "./helpers.js";
import { registerCombatAddCombatantRoutes } from "./addCombatants.js";
import { fulfillInitiativePrompt, registerCombatInitiativeRoutes } from "./initiative.js";
import { registerCombatXpRoutes } from "./xp.js";
import {
  applyCombatantTransition,
  detectEndedConcentration,
  expireConditionsAtRound,
  type EndedConcentration,
} from "../../services/combatTransitions.js";

export function registerCombatRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now } = ctx.helpers;

  // ── Encounter combatants (merged view) ────────────────────────────────────

  // MARK: - GET /api/encounters/:encounterId/combatants
  app.get("/api/encounters/:encounterId/combatants", memberOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    ensureCombat(db, encounterId);

    const rows = db.prepare(`
      SELECT c.*,
        p.id             AS p_id,
        p.campaign_id    AS p_campaign_id,
        p.user_id        AS p_user_id,
        p.character_id   AS p_character_id,
        p.player_name    AS p_player_name,
        p.character_name AS p_character_name,
        p.class_name     AS p_class_name,
        p.species        AS p_species,
        p.level          AS p_level,
        p.hp_max         AS p_hp_max,
        p.hp_current     AS p_hp_current,
        p.ac             AS p_ac,
        p.speed          AS p_speed,
        p.str            AS p_str,
        p.dex            AS p_dex,
        p.con            AS p_con,
        p.int            AS p_int,
        p.wis            AS p_wis,
        p.cha            AS p_cha,
        p.color          AS p_color,
        p.synced_ac      AS p_synced_ac,
        p.death_saves_success AS p_death_saves_success,
        p.death_saves_fail    AS p_death_saves_fail,
        p.live_json      AS p_live_json,
        p.image_url      AS p_image_url,
        p.image_updated_at AS p_image_updated_at,
        p.shared_notes   AS p_shared_notes,
        p.created_at     AS p_created_at,
        p.updated_at     AS p_updated_at
      FROM combatants c
      LEFT JOIN players p ON c.base_type = 'player' AND p.id = c.base_id
      WHERE c.encounter_id = ?
      ORDER BY COALESCE(c.sort, 9999), c.created_at
    `).all(encounterId) as Record<string, unknown>[];

    const merged = rows.map((row) => {
      const c = rowToEncounterActor(row);
      if (row.base_type !== "player" || row.p_id == null) return c;
      const player = rowToCampaignCharacter({
        id: row.p_id,
        campaign_id: row.p_campaign_id,
        user_id: row.p_user_id,
        character_id: row.p_character_id,
        player_name: row.p_player_name,
        character_name: row.p_character_name,
        class_name: row.p_class_name,
        species: row.p_species,
        level: row.p_level,
        hp_max: row.p_hp_max,
        hp_current: row.p_hp_current,
        ac: row.p_ac,
        speed: row.p_speed,
        str: row.p_str,
        dex: row.p_dex,
        con: row.p_con,
        int: row.p_int,
        wis: row.p_wis,
        cha: row.p_cha,
        color: row.p_color,
        synced_ac: row.p_synced_ac,
        death_saves_success: row.p_death_saves_success,
        death_saves_fail: row.p_death_saves_fail,
        live_json: row.p_live_json,
        image_url: row.p_image_url,
        image_updated_at: row.p_image_updated_at,
        shared_notes: row.p_shared_notes,
        created_at: row.p_created_at,
        updated_at: row.p_updated_at,
      });
      return {
        ...c,
        name: player.characterName,
        playerName: player.playerName,
        label: c.label || player.characterName,
        hpCurrent: player.hpCurrent,
        hpMax: player.hpMax,
        ac: player.ac,
        conditions: player.conditions ?? [],
        overrides: player.overrides ?? DEFAULT_OVERRIDES,
        ...(player.deathSaves ?? c.deathSaves ? { deathSaves: player.deathSaves ?? c.deathSaves } : {}),
      };
    });

    res.json(merged.map((actor) => toEncounterActorDto(actor)));
  });

  // MARK: - GET /api/encounters/:encounterId/combatants/:combatantId
  app.get("/api/encounters/:encounterId/combatants/:combatantId", memberOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const combatantId = requireParam(req, res, "combatantId");
    if (!combatantId) return;
    ensureCombat(db, encounterId);

    const row = db.prepare(`
      SELECT c.*,
        p.id             AS p_id,
        p.campaign_id    AS p_campaign_id,
        p.user_id        AS p_user_id,
        p.character_id   AS p_character_id,
        p.player_name    AS p_player_name,
        p.character_name AS p_character_name,
        p.class_name     AS p_class_name,
        p.species        AS p_species,
        p.level          AS p_level,
        p.hp_max         AS p_hp_max,
        p.hp_current     AS p_hp_current,
        p.ac             AS p_ac,
        p.speed          AS p_speed,
        p.str            AS p_str,
        p.dex            AS p_dex,
        p.con            AS p_con,
        p.int            AS p_int,
        p.wis            AS p_wis,
        p.cha            AS p_cha,
        p.color          AS p_color,
        p.synced_ac      AS p_synced_ac,
        p.death_saves_success AS p_death_saves_success,
        p.death_saves_fail    AS p_death_saves_fail,
        p.live_json      AS p_live_json,
        p.image_url      AS p_image_url,
        p.image_updated_at AS p_image_updated_at,
        p.shared_notes   AS p_shared_notes,
        p.created_at     AS p_created_at,
        p.updated_at     AS p_updated_at
      FROM combatants c
      LEFT JOIN players p ON c.base_type = 'player' AND p.id = c.base_id
      WHERE c.encounter_id = ? AND c.id = ?
      LIMIT 1
    `).get(encounterId, combatantId) as Record<string, unknown> | undefined;

    if (!row) return res.status(404).json({ ok: false, message: "Combatant not found" });

    const c = rowToEncounterActor(row);
    if (row.base_type !== "player" || row.p_id == null) {
      return res.json(toEncounterActorDto(c));
    }
    const player = rowToCampaignCharacter({
      id: row.p_id,
      campaign_id: row.p_campaign_id,
      user_id: row.p_user_id,
      character_id: row.p_character_id,
      player_name: row.p_player_name,
      character_name: row.p_character_name,
      class_name: row.p_class_name,
      species: row.p_species,
      level: row.p_level,
      hp_max: row.p_hp_max,
      hp_current: row.p_hp_current,
      ac: row.p_ac,
      speed: row.p_speed,
      str: row.p_str,
      dex: row.p_dex,
      con: row.p_con,
      int: row.p_int,
      wis: row.p_wis,
      cha: row.p_cha,
      color: row.p_color,
      synced_ac: row.p_synced_ac,
      death_saves_success: row.p_death_saves_success,
      death_saves_fail: row.p_death_saves_fail,
      live_json: row.p_live_json,
      image_url: row.p_image_url,
      image_updated_at: row.p_image_updated_at,
      shared_notes: row.p_shared_notes,
      created_at: row.p_created_at,
      updated_at: row.p_updated_at,
    });
    return res.json(toEncounterActorDto({
      ...c,
      name: player.characterName,
      playerName: player.playerName,
      label: c.label || player.characterName,
      hpCurrent: player.hpCurrent,
      hpMax: player.hpMax,
      ac: player.ac,
      conditions: player.conditions ?? [],
      overrides: player.overrides ?? DEFAULT_OVERRIDES,
      ...(player.deathSaves ?? c.deathSaves ? { deathSaves: player.deathSaves ?? c.deathSaves } : {}),
    }));
  });

  // ── Persisted combat state (round + active combatant) ─────────────────────

  // MARK: - GET /api/encounters/:encounterId/combatState
  app.get("/api/encounters/:encounterId/combatState", memberOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    ensureCombat(db, encounterId);

    const encRow = db
      .prepare("SELECT combat_round, combat_active_combatant_id FROM encounters WHERE id = ?")
      .get(encounterId) as { combat_round: number | null; combat_active_combatant_id: string | null } | undefined;

    const roundVal = Number(encRow?.combat_round);
    const state: StoredCombatState = {
      round: Number.isFinite(roundVal) && roundVal >= 1 ? roundVal : 1,
      activeCombatantId: (encRow?.combat_active_combatant_id ?? null) as string | null,
    };

    res.json(state);
  });

  // MARK: - PUT /api/encounters/:encounterId/combatState
  app.put("/api/encounters/:encounterId/combatState", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    ensureCombat(db, encounterId);

    const body = parseBody(CombatStateBody, req);
    const t = now();

    const before = db
      .prepare("SELECT combat_active_combatant_id FROM encounters WHERE id = ?")
      .get(encounterId) as { combat_active_combatant_id: string | null } | undefined;
    const previousActiveCombatantId = before?.combat_active_combatant_id ?? null;

    db.prepare(
      "UPDATE encounters SET combat_round=COALESCE(?,combat_round), combat_active_combatant_id=?, updated_at=? WHERE id=?"
    ).run(body.round ?? null, body.activeCombatantId ?? null, t, encounterId);

    ctx.broadcast("encounter:combatStateChanged", { encounterId });

    const updated = db
      .prepare("SELECT combat_round, combat_active_combatant_id FROM encounters WHERE id = ?")
      .get(encounterId) as { combat_round: number; combat_active_combatant_id: string | null };
    const state: StoredCombatState = {
      round: updated.combat_round,
      activeCombatantId: updated.combat_active_combatant_id,
    };

    // Server-authoritative reaction reset for the incoming active combatant. This mirrors the
    // existing client-side effect in CombatView.tsx (which still runs too, harmlessly), but no
    // longer depends on the DM's browser tab being open/connected for the round to actually
    // advance the reaction state.
    const turnAdvancedTo = state.activeCombatantId && state.activeCombatantId !== previousActiveCombatantId
      ? state.activeCombatantId
      : null;

    const endedConcentrations: EndedConcentration[] = [];

    for (const combatant of loadCombatants(db, encounterId).map((entry) => hydratePlayerCombatant(db, entry))) {
      const conditions = expireConditionsAtRound(combatant.conditions, state.round);
      const conditionsChanged = conditions.length !== combatant.conditions.length;
      const enteringTurn = combatant.id === turnAdvancedTo;
      if (!conditionsChanged && !(enteringTurn && combatant.usedReaction)) continue;
      // applyCombatantTransition re-forces usedReaction back to true if the combatant is (still)
      // incapacitated, so requesting false here is safe even for a downed combatant.
      const next = applyCombatantTransition(
        { ...combatant, conditions, ...(enteringTurn ? { usedReaction: false } : {}), updatedAt: t },
        combatant,
      );
      const ended = detectEndedConcentration(next.id, combatant.conditions, next.conditions);
      if (ended) endedConcentrations.push(ended);
      updateEncounterActor(db, next, t);
      const synced = syncCombatantToPlayer(db, next, t);
      const syncedBinderNpc = syncCombatantToBinderNpc(db, next, t);
      if (synced) {
        if (ended && synced.characterId) {
          db.prepare(`
            UPDATE user_characters
            SET character_data_json = json_set(COALESCE(character_data_json, '{}'), '$.concentrationSpell', NULL), updated_at = ?
            WHERE id = ?
          `).run(t, synced.characterId);
        }
        ctx.broadcast("players:delta", {
          campaignId: synced.campaignId,
          action: "upsert",
          playerId: next.baseId,
        });
      }
      if (syncedBinderNpc) {
        for (const campaignId of syncedBinderNpc.campaignIds) {
          ctx.broadcast("inpcs:delta", { campaignId, action: "refresh" });
        }
        for (const syncedEncounterId of syncedBinderNpc.encounterIds) {
          if (syncedEncounterId === encounterId) continue;
          ctx.broadcast("encounter:combatantsDelta", { encounterId: syncedEncounterId, action: "refresh" });
        }
      }
      ctx.broadcast("encounter:combatantsDelta", {
        encounterId,
        action: "upsert",
        combatantId: next.id,
        combatant: toEncounterActorDto(next),
      });
    }

    // A condition's own expiry timer can land on the caster's "concentration" condition itself
    // (the DM UI allows setting one on any condition) — sweep dependents for each ended session
    // only after every combatant's own expiry/reset pass has been persisted.
    for (const ended of endedConcentrations) {
      sweepDependentConditions(db, ctx.broadcast, encounterId, ended, t, ended.casterId);
    }

    res.json({ ok: true, ...state });
  });

  // ── Add all campaign players ──────────────────────────────────────────────
  registerCombatAddCombatantRoutes(app, ctx);

  // ── Update combatant ──────────────────────────────────────────────────────
  app.put(
    "/api/encounters/:encounterId/combatants/:combatantId",
    dmOrAdmin(db),
    (req, res) => {
      const encounterId = requireParam(req, res, "encounterId");
      if (!encounterId) return;
      const combatantId = requireParam(req, res, "combatantId");
      if (!combatantId) return;

      const body = parseBody(CombatantUpdateBody, req);
      const t = now();

      const result = updateCombatant(db, ctx.broadcast, encounterId, combatantId, body, t);
      if (!result) return res.status(404).json({ ok: false, message: "Not found" });
      const { next, synced } = result;

      if (body.initiative != null) {
        fulfillInitiativePrompt(ctx, next, synced?.campaignId ?? null);
      }

      res.json(toEncounterActorDto(next));
    }
  );

  // ── Delete combatant ──────────────────────────────────────────────────────
  app.delete(
    "/api/encounters/:encounterId/combatants/:combatantId",
    dmOrAdmin(db),
    (req, res) => {
      const encounterId = requireParam(req, res, "encounterId");
      if (!encounterId) return;
      const combatantId = requireParam(req, res, "combatantId");
      if (!combatantId) return;

      const row = db
        .prepare("SELECT id FROM combatants WHERE id = ? AND encounter_id = ?")
        .get(combatantId, encounterId);
      if (!row) return res.status(404).json({ ok: false, message: "Combatant not found" });

      db.prepare("DELETE FROM combatants WHERE id = ? AND encounter_id = ?").run(
        combatantId,
        encounterId
      );
      ctx.broadcast("encounter:combatantsDelta", { encounterId, action: "delete", combatantId });
      res.json({ ok: true });
    }
  );

  registerCombatInitiativeRoutes(app, ctx);
  registerCombatXpRoutes(app, ctx);
}
