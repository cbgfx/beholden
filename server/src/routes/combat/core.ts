import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import type { StoredCombatState } from "../../server/userData.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import { dmOrAdmin, memberOrAdmin } from "../../middleware/campaignAuth.js";
import { MERGED_COMBATANT_SELECT, rowToMergedCombatant } from "./mergedCombatant.js";

import {
  ensureCombat,
  syncCombatantToPlayer,
  syncCombatantToInpc,
  hydratePlayerCombatant,
  loadCombatants,
  updateEncounterActor,
  updateCombatant,
  sweepDependentConditions,
} from "../../services/combat.js";
import { toEncounterActorDto } from "../../lib/apiActors.js";
import { CombatantUpdateBody, CombatStateBody } from "./helpers.js";
import { removeCombatant } from "../../services/combat.removal.js";
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

  // The roster carries what a monster really has: its hit points, its AC, its conditions. The
  // player's own view of a fight (GET /api/me/characters/:id/combat-status) deliberately reports
  // enemies as Down, Bloodied or Damaged instead, and the party view rounds HP to a percentage -
  // so handing any member the raw numbers here contradicted the two endpoints built to hide them.
  // Neither player app has ever asked for this.

  // MARK: - GET /api/encounters/:encounterId/combatants
  app.get("/api/encounters/:encounterId/combatants", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    ensureCombat(db, encounterId);

    const rows = db.prepare(`
      ${MERGED_COMBATANT_SELECT}
      WHERE c.encounter_id = ?
      ORDER BY COALESCE(c.sort, 9999), c.created_at
    `).all(encounterId) as Record<string, unknown>[];

    const merged = rows.map(rowToMergedCombatant);

    res.json(merged.map((actor) => toEncounterActorDto(actor)));
  });

  // MARK: - GET /api/encounters/:encounterId/combatants/:combatantId
  app.get("/api/encounters/:encounterId/combatants/:combatantId", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const combatantId = requireParam(req, res, "combatantId");
    if (!combatantId) return;
    ensureCombat(db, encounterId);

    const row = db.prepare(`
      ${MERGED_COMBATANT_SELECT}
      WHERE c.encounter_id = ? AND c.id = ?
      LIMIT 1
    `).get(encounterId, combatantId) as Record<string, unknown> | undefined;

    if (!row) return res.status(404).json({ ok: false, message: "Combatant not found" });

    return res.json(toEncounterActorDto(rowToMergedCombatant(row)));
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

    // Whose turn it is has to be someone in this fight. Anything else leaves the encounter pointing
    // at a row that is not in its initiative order, which every client then papers over differently.
    if (body.activeCombatantId) {
      const inThisFight = db
        .prepare("SELECT 1 FROM combatants WHERE id = ? AND encounter_id = ?")
        .get(body.activeCombatantId, encounterId);
      if (!inThisFight) {
        return res.status(400).json({ ok: false, message: "That combatant is not in this encounter." });
      }
    }

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
      // Legendary actions (not resistances -- those recharge on a long rest,
      // not each turn) are regained at the start of the legendary creature's
      // own turn, same trigger as the reaction reset just below.
      const hasSpentLegendaryActions = (combatant.usedLegendaryActions ?? 0) > 0;
      if (!conditionsChanged && !(enteringTurn && (combatant.usedReaction || hasSpentLegendaryActions))) continue;
      // applyCombatantTransition re-forces usedReaction back to true if the combatant is (still)
      // incapacitated, so requesting false here is safe even for a downed combatant.
      const next = applyCombatantTransition(
        { ...combatant, conditions, ...(enteringTurn ? { usedReaction: false, usedLegendaryActions: 0 } : {}), updatedAt: t },
        combatant,
      );
      const ended = detectEndedConcentration(next.id, combatant.conditions, next.conditions);
      if (ended) endedConcentrations.push(ended);
      updateEncounterActor(db, next, t);
      const synced = syncCombatantToPlayer(db, next, t);
      const syncedBinderNpc = syncCombatantToInpc(db, next, t);
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

      if (body.conditions && body.previousConditions) {
        const current = loadCombatants(db, encounterId)
          .map((entry) => hydratePlayerCombatant(db, entry))
          .find((entry) => entry.id === combatantId);
        if (current && JSON.stringify(current.conditions) !== JSON.stringify(body.previousConditions)) {
          return res.status(409).json({ ok: false, code: "conditions-conflict", message: "Conditions changed elsewhere. Reload and try again." });
        }
      }

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

      const removedCombatant = loadCombatants(db, encounterId)
        .map((entry) => hydratePlayerCombatant(db, entry))
        .find((entry) => entry.id === combatantId);
      if (!removedCombatant) return res.status(404).json({ ok: false, message: "Combatant not found" });

      // Hands the turn on, ends anything they were sustaining on others, and tells the clients.
      const { turnHandedTo } = removeCombatant(db, ctx.broadcast, encounterId, combatantId, now());
      res.json({ ok: true, ...(turnHandedTo ? { combat: turnHandedTo } : {}) });
    }
  );

  registerCombatInitiativeRoutes(app, ctx);
  registerCombatXpRoutes(app, ctx);
}
