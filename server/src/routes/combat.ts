import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import type { StoredEncounterActor, StoredCombatState, StoredConditionInstance, StoredOverrides } from "../server/userData.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import { rowToCampaignCharacter, rowToEncounterActor, CAMPAIGN_CHARACTER_COLS, ENCOUNTER_ACTOR_COLS } from "../lib/db.js";
import { extractLeadingNumber, extractDetails } from "../lib/text.js";
import {
  ensureCombat,
  insertCombatant,
  createPlayerCombatant,
  nextLabelNumber,
  syncCombatantToPlayer,
  hydratePlayerCombatant,
  updateEncounterActor,
} from "../services/combat.js";
import {
  ConditionInstanceSchema,
  AttackOverrideSchema,
  OverridesSchema,
} from "../lib/schemas.js";
import { DEFAULT_OVERRIDES } from "../lib/defaults.js";

const CombatStateBody = z.object({
  round: z.number().int().min(1).optional(),
  activeCombatantId: z.string().nullable().optional(),
});

const AddPlayerBody = z.object({
  playerId: z.string(),
});

const AddMonsterBody = z.object({
  monsterId: z.string(),
  qty: z.number().int().min(1).max(20).default(1),
  friendly: z.boolean().default(false),
  labelBase: z.string().optional(),
  ac: z.number().optional(),
  acDetails: z.string().nullable().optional(),
  hpMax: z.number().optional(),
  hpDetails: z.string().nullable().optional(),
  attackOverrides: AttackOverrideSchema.optional(),
});

const AddInpcBody = z.object({
  inpcId: z.string(),
});

const CombatantUpdateBody = z.object({
  label: z.string().optional(),
  initiative: z.number().nullable().optional(),
  friendly: z.boolean().optional(),
  color: z.string().optional(),
  hpCurrent: z.number().optional(),
  hpMax: z.number().optional(),
  hpDetails: z.string().nullable().optional(),
  ac: z.number().optional(),
  acDetails: z.string().nullable().optional(),
  attackOverrides: AttackOverrideSchema.optional(),
  overrides: OverridesSchema.optional(),
  conditions: z.array(ConditionInstanceSchema).optional(),
  deathSaves: z.object({ success: z.number(), fail: z.number() }).optional(),
  usedReaction: z.boolean().optional(),
  usedLegendaryActions: z.number().int().min(0).optional(),
  usedLegendaryResistances: z.number().int().min(0).optional(),
  usedSpellSlots: z.record(z.number()).optional(),
});

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
        p.sheet_json     AS p_sheet_json,
        p.live_json      AS p_live_json,
        p.image_url      AS p_image_url,
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
        sheet_json: row.p_sheet_json,
        live_json: row.p_live_json,
        image_url: row.p_image_url,
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
        deathSaves: player.deathSaves ?? c.deathSaves,
        overrides: player.overrides ?? DEFAULT_OVERRIDES,
      };
    });

    res.json(merged);
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

    ctx.broadcast("encounter:combatantsChanged", { encounterId });
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
    insertCombatant(db, createPlayerCombatant({ encounterId, player: p, t }));
    ctx.broadcast("encounter:combatantsChanged", { encounterId });
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
    const { monsterId, qty = 1, friendly = false } = body;
    const labelBase = body.labelBase?.trim() ?? "";
    const acOverride = body.ac != null && Number.isFinite(body.ac) ? body.ac : null;
    const acDetails = body.acDetails ?? null;
    const hpMaxOverride = body.hpMax != null && Number.isFinite(body.hpMax) ? body.hpMax : null;
    const hpDetails = body.hpDetails ?? null;
    const attackOverrides = body.attackOverrides ?? null;

    const monRow = db
      .prepare("SELECT data_json FROM compendium_monsters WHERE id = ?")
      .get(monsterId) as { data_json: string } | undefined;
    if (!monRow)
      return res.status(404).json({ ok: false, message: "Monster not found in compendium" });

    const m = JSON.parse(monRow.data_json);

    const mHp = m?.hp as any;
    const mAc = m?.ac as any;
    const defaultAc = extractLeadingNumber(mAc);
    const defaultHp = extractLeadingNumber(mHp?.average ?? mHp);
    const defaultAcDetails = extractDetails(mAc);
    const defaultHpDetails = mHp?.formula ?? mHp?.roll ?? null;

    ensureCombat(db, encounterId);
    const t = now();

    const baseName = m.name;
    const effectiveLabelBase = labelBase || baseName;
    let n: number = nextLabelNumber(db, encounterId, effectiveLabelBase);

    const created: StoredEncounterActor[] = [];
    db.transaction(() => {
      for (let i = 0; i < qty; i++) {
        const label =
          qty === 1 ? effectiveLabelBase : `${effectiveLabelBase} ${n++}`;
        const hpMax =
          hpMaxOverride != null && Number.isFinite(hpMaxOverride)
            ? hpMaxOverride
            : (defaultHp ?? null);
        const ac =
          acOverride != null && Number.isFinite(acOverride)
            ? acOverride
            : (defaultAc ?? null);

        const c: StoredEncounterActor = {
          id: uid(),
          encounterId,
          baseType: "monster",
          baseId: monsterId,
          name: baseName,
          label,
          initiative: null,
          friendly,
          color: friendly ? "lightgreen" : "red",
          overrides: { ...DEFAULT_OVERRIDES },
          hpCurrent: hpMax,
          hpMax,
          hpDetails:
            hpDetails != null
              ? hpDetails
              : defaultHpDetails != null
              ? String(defaultHpDetails)
              : null,
          ac,
          acDetails:
            acDetails != null
              ? acDetails
              : defaultAcDetails != null
              ? String(defaultAcDetails)
              : null,
          attackOverrides: attackOverrides ?? null,
          conditions: [],
          createdAt: t,
          updatedAt: t,
        };
        insertCombatant(db, c);
        created.push(c);
      }
    })();

    ctx.broadcast("encounter:combatantsChanged", { encounterId });
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

    ctx.broadcast("encounter:combatantsChanged", { encounterId });
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

      const deathSaves = body.deathSaves
        ? {
            success: Math.max(0, Math.floor(body.deathSaves.success)),
            fail: Math.max(0, Math.floor(body.deathSaves.fail)),
          }
        : existing.deathSaves;

      const next: StoredEncounterActor = {
        ...existing,
        label: body.label ?? existing.label,
        initiative: body.initiative !== undefined ? body.initiative : (existing.initiative ?? null),
        friendly: body.friendly ?? existing.friendly,
        color: body.color ?? existing.color,
        hpCurrent: body.hpCurrent ?? existing.hpCurrent,
        hpMax: body.hpMax ?? existing.hpMax,
        hpDetails: body.hpDetails !== undefined ? body.hpDetails : existing.hpDetails,
        ac: body.ac ?? existing.ac,
        acDetails: body.acDetails !== undefined ? body.acDetails : existing.acDetails,
        attackOverrides: body.attackOverrides !== undefined ? (body.attackOverrides as unknown | null) : existing.attackOverrides,
        overrides: (body.overrides ?? existing.overrides) as StoredOverrides,
        conditions: (body.conditions ?? existing.conditions ?? []) as StoredConditionInstance[],
        ...(deathSaves !== undefined ? { deathSaves } : {}),
        usedReaction: body.usedReaction ?? existing.usedReaction ?? false,
        usedLegendaryActions: body.usedLegendaryActions ?? existing.usedLegendaryActions ?? 0,
        usedLegendaryResistances: body.usedLegendaryResistances ?? existing.usedLegendaryResistances ?? 0,
        usedSpellSlots: body.usedSpellSlots ?? existing.usedSpellSlots ?? {},
        updatedAt: t,
      };

      updateEncounterActor(db, next, t);

      // Sync player record for player-type combatants
      const syncedCampaignId = syncCombatantToPlayer(db, next, t);
      if (syncedCampaignId) ctx.broadcast("players:changed", { campaignId: syncedCampaignId });

      ctx.broadcast("encounter:combatantsChanged", { encounterId });
      res.json(next);
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
      ctx.broadcast("encounter:combatantsChanged", { encounterId });
      res.json({ ok: true });
    }
  );
}
