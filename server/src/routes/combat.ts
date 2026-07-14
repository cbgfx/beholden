import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import type { StoredEncounterActor, StoredCombatState, StoredConditionInstance, StoredOverrides } from "../server/userData.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import { rowToCampaignCharacter, rowToEncounterActor, CAMPAIGN_CHARACTER_COLS, ENCOUNTER_ACTOR_COLS } from "../lib/db.js";

import {
  ensureCombat,
  insertCombatant,
  createPlayerCombatant,
  syncCombatantToPlayer,
  hydratePlayerCombatant,
  loadCombatants,
  updateEncounterActor,
  sweepDependentConditions,
} from "../services/combat.js";
import { addMonsterCombatants } from "../services/combat.addMonster.js";
import { DEFAULT_OVERRIDES } from "../lib/defaults.js";
import { toEncounterActorDto } from "../lib/apiActors.js";
import {
  AddInpcBody,
  AddMonsterBody,
  AddPlayerBody,
  CombatantUpdateBody,
  CombatStateBody,
} from "./combatRouteHelpers.js";
import { fulfillInitiativePrompt, registerCombatInitiativeRoutes } from "./combatInitiative.js";
import { registerCombatXpRoutes } from "./combatXp.js";
import { concentrationSaveDc } from "@beholden/shared/domain/conditions";
import { resolveActorDamage, resolveActorHealing } from "@beholden/shared/domain/actors";
import {
  applyCombatantTransition,
  detectEndedConcentration,
  expireConditionsAtRound,
  shouldBreakConcentration,
  type EndedConcentration,
} from "../services/combatTransitions.js";

export function registerCombatRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now, uid } = ctx.helpers;

  // ── Encounter combatants (merged view) ────────────────────────────────────
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
  app.post("/api/encounters/:encounterId/combatants/addPlayers", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare("SELECT campaign_id FROM encounters WHERE id = ?")
      .get(encounterId) as { campaign_id: string } | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });

    ensureCombat(db, encounterId);

    const players = (
      db.prepare(`
        SELECT ${CAMPAIGN_CHARACTER_COLS}
        FROM players
        WHERE campaign_id = ?
          AND id NOT IN (
            SELECT base_id FROM combatants
            WHERE encounter_id = ? AND base_type = 'player'
          )
      `).all(encRow.campaign_id, encounterId) as Record<string, unknown>[]
    ).map(rowToCampaignCharacter);

    const t = now();
    let added = 0;
    db.transaction(() => {
      for (const p of players) {
        insertCombatant(db, createPlayerCombatant({ encounterId, player: p, t }));
        added++;
      }
    })();

    ctx.broadcast("encounter:combatantsDelta", { encounterId, action: "refresh" });
    res.json({ ok: true, added });
  });

  // ── Add single player ─────────────────────────────────────────────────────
  app.post("/api/encounters/:encounterId/combatants/addPlayer", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare("SELECT campaign_id FROM encounters WHERE id = ?")
      .get(encounterId) as { campaign_id: string } | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });

    const { playerId } = parseBody(AddPlayerBody, req);
    const pRow = db
      .prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`)
      .get(playerId) as Record<string, unknown> | undefined;
    if (!pRow)
      return res.status(404).json({ ok: false, message: "Player not found" });
    const p = rowToCampaignCharacter(pRow);
    if (p.campaignId !== encRow.campaign_id)
      return res.status(400).json({ ok: false, message: "Player not in campaign" });

    ensureCombat(db, encounterId);

    const already = db
      .prepare(
        "SELECT id FROM combatants WHERE encounter_id=? AND base_type='player' AND base_id=?"
      )
      .get(encounterId, playerId);
    if (already) return res.json({ ok: true, added: 0, already: true });

    const t = now();
    const created = createPlayerCombatant({ encounterId, player: p, t });
    insertCombatant(db, created);
    ctx.broadcast("encounter:combatantsDelta", {
      encounterId,
      action: "upsert",
      combatantId: created.id,
      combatant: toEncounterActorDto(created),
    });
    res.json({ ok: true, added: 1 });
  });

  // ── Add monster ───────────────────────────────────────────────────────────
  app.post("/api/encounters/:encounterId/combatants/addMonster", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare("SELECT id FROM encounters WHERE id = ?")
      .get(encounterId) as { id: string } | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });

    const body = parseBody(AddMonsterBody, req);
    const monRow = db
      .prepare("SELECT name, data_json FROM compendium_monsters WHERE id = ?")
      .get(body.monsterId) as { name: string; data_json: string } | undefined;
    if (!monRow)
      return res.status(404).json({ ok: false, message: "Monster not found in compendium" });

    const created = addMonsterCombatants(db, encounterId, uid, now(), {
      monsterId: body.monsterId,
      monsterName: monRow.name,
      monsterBlob: JSON.parse(monRow.data_json),
      qty: body.qty ?? 1,
      friendly: body.friendly ?? false,
      labelBase: body.labelBase?.trim() ?? "",
      acOverride: body.ac != null && Number.isFinite(body.ac) ? body.ac : null,
      acDetails: body.acDetails ?? null,
      hpMaxOverride: body.hpMax != null && Number.isFinite(body.hpMax) ? body.hpMax : null,
      hpDetails: body.hpDetails ?? null,
      attackOverrides: body.attackOverrides ?? null,
    });

    for (const combatant of created) {
      ctx.broadcast("encounter:combatantsDelta", {
        encounterId,
        action: "upsert",
        combatantId: combatant.id,
        combatant: toEncounterActorDto(combatant),
      });
    }
    res.json({ ok: true, created });
  });

  // ── Add iNPC ──────────────────────────────────────────────────────────────
  app.post("/api/encounters/:encounterId/combatants/addInpc", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare("SELECT id FROM encounters WHERE id = ?")
      .get(encounterId) as { id: string } | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });

    const { inpcId } = parseBody(AddInpcBody, req);
    const iRow = db
      .prepare("SELECT id, name, label, friendly, hp_max, hp_current, hp_details, ac, ac_details FROM inpcs WHERE id = ?")
      .get(inpcId) as Record<string, unknown> | undefined;
    if (!iRow)
      return res.status(404).json({ ok: false, message: "iNPC not found" });

    const friendly = Boolean(iRow.friendly);
    const t = now();

    ensureCombat(db, encounterId);

    const c: StoredEncounterActor = {
      id: uid(),
      encounterId,
      baseType: "inpc",
      baseId: inpcId,
      name: iRow.name as string,
      label: (iRow.label as string | null) || (iRow.name as string),
      initiative: null,
      friendly,
      color: friendly ? "lightgreen" : "red",
      overrides: { ...DEFAULT_OVERRIDES },
      hpCurrent: Number(iRow.hp_current ?? iRow.hp_max ?? 1),
      hpMax: Number(iRow.hp_max ?? 1),
      hpDetails: (iRow.hp_details as string | null) ?? null,
      ac: Number(iRow.ac ?? 10),
      acDetails: (iRow.ac_details as string | null) ?? null,
      attackOverrides: null,
      conditions: [],
      createdAt: t,
      updatedAt: t,
    };
    insertCombatant(db, c);

    ctx.broadcast("encounter:combatantsDelta", {
      encounterId,
      action: "upsert",
      combatantId: c.id,
      combatant: toEncounterActorDto(c),
    });
    res.json({ ok: true, created: c });
  });

  // ── Update combatant ──────────────────────────────────────────────────────
  app.put(
    "/api/encounters/:encounterId/combatants/:combatantId",
    dmOrAdmin(db),
    (req, res) => {
      const encounterId = requireParam(req, res, "encounterId");
      if (!encounterId) return;
      const combatantId = requireParam(req, res, "combatantId");
      if (!combatantId) return;

      const existingRow = db
        .prepare(`SELECT ${ENCOUNTER_ACTOR_COLS} FROM combatants WHERE id = ? AND encounter_id = ?`)
        .get(combatantId, encounterId) as Record<string, unknown> | undefined;
      if (!existingRow)
        return res.status(404).json({ ok: false, message: "Not found" });

      const existing = hydratePlayerCombatant(db, rowToEncounterActor(existingRow));
      const body = parseBody(CombatantUpdateBody, req);
      const t = now();

      // Resolve damage/heal against `existing`, which was just re-read (and, for player-type
      // combatants, re-hydrated from the live `players` row) in this request — never against
      // whatever the client had cached when it computed its own preview. This is what keeps a
      // concurrent change (e.g. the player granting themselves temp HP) from being silently
      // overwritten by a damage request that was resolved against stale data.
      const resolvedHpDelta = body.hpDelta
        ? (body.hpDelta.kind === "heal"
            ? resolveActorHealing(existing, body.hpDelta.amount)
            : resolveActorDamage(existing, body.hpDelta.amount))
        : null;

      const deathSaves = body.deathSaves
        ? {
            success: Math.max(0, Math.floor(body.deathSaves.success)),
            fail: Math.max(0, Math.floor(body.deathSaves.fail)),
          }
        : existing.deathSaves;

      const requestedHp = resolvedHpDelta?.hpCurrent ?? body.hpCurrent ?? existing.hpCurrent;
      const requestedConditions = (resolvedHpDelta?.conditions ?? body.conditions ?? existing.conditions ?? []) as StoredConditionInstance[];
      const losesConcentration = shouldBreakConcentration({ hpCurrent: requestedHp, conditions: requestedConditions });

      const merged: StoredEncounterActor = {
        ...existing,
        label: body.label ?? existing.label,
        initiative: body.initiative !== undefined ? body.initiative : (existing.initiative ?? null),
        friendly: body.friendly ?? existing.friendly,
        color: body.color ?? existing.color,
        hpCurrent: requestedHp,
        hpMax: body.hpMax ?? existing.hpMax,
        hpDetails: body.hpDetails !== undefined ? body.hpDetails : existing.hpDetails,
        ac: body.ac ?? existing.ac,
        acDetails: body.acDetails !== undefined ? body.acDetails : existing.acDetails,
        attackOverrides: body.attackOverrides !== undefined ? (body.attackOverrides as unknown | null) : existing.attackOverrides,
        overrides: (resolvedHpDelta?.overrides ?? body.overrides ?? existing.overrides) as StoredOverrides,
        conditions: requestedConditions,
        ...(deathSaves !== undefined ? { deathSaves } : {}),
        usedReaction: body.usedReaction ?? existing.usedReaction ?? false,
        usedLegendaryActions: body.usedLegendaryActions ?? existing.usedLegendaryActions ?? 0,
        usedLegendaryResistances: body.usedLegendaryResistances ?? existing.usedLegendaryResistances ?? 0,
        usedSpellSlots: body.usedSpellSlots ?? existing.usedSpellSlots ?? {},
        updatedAt: t,
      };
      const next = applyCombatantTransition(merged, existing);

      updateEncounterActor(db, next, t);

      // Sync player record for player-type combatants
      const synced = syncCombatantToPlayer(db, next, t);
      if (synced) {
        if (losesConcentration && synced.characterId) {
          db.prepare(`
            UPDATE user_characters
            SET character_data_json = json_set(COALESCE(character_data_json, '{}'), '$.concentrationSpell', NULL), updated_at = ?
            WHERE id = ?
          `).run(t, synced.characterId);
        }
        ctx.broadcast("players:delta", {
          campaignId: synced.campaignId,
          action: next.baseType === "player" ? "upsert" : "refresh",
          ...(next.baseType === "player" ? { playerId: next.baseId } : {}),
        });
        // Notify a concentrating player that they need to make a CON save
        if (
          synced.characterId &&
          (resolvedHpDelta || body.hpCurrent !== undefined) &&
          existing.hpCurrent !== null &&
          requestedHp !== null &&
          requestedHp < existing.hpCurrent &&
          existing.conditions.some((c) => c.key === "concentration")
        ) {
          ctx.broadcast("concentration:check", {
            campaignId: synced.campaignId,
            encounterId,
            characterId: synced.characterId,
            characterName: existing.label || existing.name,
            dc: concentrationSaveDc(existing.hpCurrent - requestedHp),
          });
        }
      }

      ctx.broadcast("encounter:combatantsDelta", {
        encounterId,
        action: "upsert",
        combatantId: next.id,
        combatant: toEncounterActorDto(next),
      });

      const ended = detectEndedConcentration(next.id, existing.conditions, next.conditions);
      if (ended) sweepDependentConditions(db, ctx.broadcast, encounterId, ended, t, next.id);

      // Applying a concentration-dependent effect records the spell on a linked player caster.
      // This keeps the player sheet and combat HUD label aligned with the authoritative ownership.
      for (const condition of next.conditions) {
        const spellName = condition.key === "hexed"
          ? "Hex"
          : condition.key === "marked"
            ? "Hunter's Mark"
            : null;
        if (!spellName || !condition.casterId) continue;
        const wasPresent = existing.conditions.some((previous) =>
          previous.key === condition.key
          && previous.casterId === condition.casterId
          && previous.hexAbility === condition.hexAbility
        );
        if (wasPresent) continue;
        const casterPlayer = db.prepare(`
          SELECT p.character_id, p.campaign_id
          FROM combatants c
          JOIN players p ON p.id = c.base_id
          WHERE c.id = ? AND c.encounter_id = ? AND c.base_type = 'player'
          LIMIT 1
        `).get(condition.casterId, encounterId) as { character_id: string | null; campaign_id: string } | undefined;
        if (!casterPlayer?.character_id) continue;
        db.prepare(`
          UPDATE user_characters
          SET character_data_json = json_set(COALESCE(character_data_json, '{}'), '$.concentrationSpell', ?), updated_at = ?
          WHERE id = ?
        `).run(spellName, t, casterPlayer.character_id);
        ctx.broadcast("players:delta", {
          campaignId: casterPlayer.campaign_id,
          action: "refresh",
          characterId: casterPlayer.character_id,
        });
      }

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
