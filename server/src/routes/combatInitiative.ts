import type { Express } from "express";
import type { StoredEncounterActor } from "../server/userData.js";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";
import { ENCOUNTER_ACTOR_COLS, rowToEncounterActor } from "../lib/db.js";
import { toEncounterActorDto } from "../lib/apiActors.js";
import {
  hydratePlayerCombatant,
  syncCombatantToPlayer,
  updateEncounterActor,
} from "../services/combat.js";

export function fulfillInitiativePrompt(
  ctx: ServerContext,
  actor: StoredEncounterActor,
  campaignId: string | null,
) {
  if (actor.baseType !== "player" || actor.initiative == null) return;

  ctx.db.prepare("DELETE FROM initiative_prompts WHERE combatant_id = ?").run(actor.id);
  if (!campaignId) return;

  const character = ctx.db
    .prepare("SELECT character_id FROM players WHERE id = ?")
    .get(actor.baseId) as { character_id: string } | undefined;
  if (!character?.character_id) return;

  ctx.broadcast("initiative:fulfilled", {
    campaignId,
    encounterId: actor.encounterId,
    combatantId: actor.id,
    characterId: character.character_id,
  });
}

export function registerCombatInitiativeRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now } = ctx.helpers;

  app.get("/api/me/characters/:characterId/initiative-prompt", (req, res) => {
    const characterId = requireParam(req, res, "characterId");
    if (!characterId) return;

    const owned = db
      .prepare("SELECT 1 FROM user_characters WHERE id = ? AND user_id = ?")
      .get(characterId, req.user!.userId);
    if (!owned && !req.user!.isAdmin) {
      return res.status(404).json({ ok: false, message: "Character not found" });
    }

    const prompt = db.prepare(`
      SELECT ip.encounter_id AS encounterId, ip.combatant_id AS combatantId
      FROM initiative_prompts ip
      JOIN combatants c ON c.id = ip.combatant_id AND c.encounter_id = ip.encounter_id
      WHERE ip.character_id = ?
        AND json_extract(c.live_json, '$.initiative') IS NULL
      ORDER BY ip.created_at, ip.combatant_id
      LIMIT 1
    `).get(characterId) as { encounterId: string; combatantId: string } | undefined;

    res.json({ prompt: prompt ?? null });
  });

  app.post(
    "/api/encounters/:encounterId/prompt-initiative",
    dmOrAdmin(db),
    (req, res) => {
      const encounterId = requireParam(req, res, "encounterId");
      if (!encounterId) return;

      const encounter = db
        .prepare("SELECT campaign_id FROM encounters WHERE id = ?")
        .get(encounterId) as { campaign_id: string } | undefined;
      if (!encounter) return res.status(404).json({ ok: false, message: "Encounter not found" });

      const rows = db.prepare(`
        SELECT c.id AS combatant_id, p.character_id
        FROM combatants c
        JOIN players p ON c.base_type = 'player' AND p.id = c.base_id
        WHERE c.encounter_id = ? AND json_extract(c.live_json, '$.initiative') IS NULL
      `).all(encounterId) as Array<{ combatant_id: string; character_id: string }>;

      const prompts = rows
        .filter((row) => row.character_id)
        .map((row) => ({
          characterId: String(row.character_id),
          combatantId: String(row.combatant_id),
        }));
      if (prompts.length === 0) return res.json({ ok: true, prompted: 0 });

      const createdAt = now();
      db.transaction(() => {
        const savePrompt = db.prepare(`
          INSERT INTO initiative_prompts
            (combatant_id, encounter_id, campaign_id, character_id, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(combatant_id) DO UPDATE SET
            encounter_id = excluded.encounter_id,
            campaign_id = excluded.campaign_id,
            character_id = excluded.character_id,
            created_at = excluded.created_at
        `);
        for (const prompt of prompts) {
          savePrompt.run(
            prompt.combatantId,
            encounterId,
            encounter.campaign_id,
            prompt.characterId,
            createdAt,
          );
        }
      })();

      ctx.broadcast("initiative:prompt", {
        campaignId: encounter.campaign_id,
        encounterId,
        prompts,
      });

      res.json({ ok: true, prompted: prompts.length });
    },
  );

  app.post(
    "/api/encounters/:encounterId/combatants/:combatantId/initiative",
    memberOrAdmin(db),
    (req, res) => {
      const encounterId = requireParam(req, res, "encounterId");
      if (!encounterId) return;
      const combatantId = requireParam(req, res, "combatantId");
      if (!combatantId) return;

      const rawInitiative = (req.body as { initiative?: unknown }).initiative;
      const initiative =
        typeof rawInitiative === "number" && Number.isFinite(rawInitiative)
          ? Math.round(rawInitiative)
          : null;
      if (initiative === null) {
        return res.status(400).json({ ok: false, message: "initiative must be a finite number" });
      }

      const existingRow = db
        .prepare(`SELECT ${ENCOUNTER_ACTOR_COLS} FROM combatants WHERE id = ? AND encounter_id = ?`)
        .get(combatantId, encounterId) as Record<string, unknown> | undefined;
      if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });

      const existing = hydratePlayerCombatant(db, rowToEncounterActor(existingRow));
      if (existing.baseType !== "player") {
        return res.status(403).json({ ok: false, message: "Not a player combatant" });
      }

      if (!req.user!.isAdmin) {
        const owned = db.prepare(`
          SELECT 1
          FROM players p
          LEFT JOIN user_characters uc ON uc.id = p.character_id
          WHERE p.id = ? AND (p.user_id = ? OR uc.user_id = ?)
        `).get(existing.baseId, req.user!.userId, req.user!.userId);
        if (!owned) {
          return res.status(403).json({ ok: false, message: "You do not own this combatant" });
        }
      }

      const updatedAt = now();
      const next: StoredEncounterActor = { ...existing, initiative, updatedAt };
      updateEncounterActor(db, next, updatedAt);
      const campaignId = syncCombatantToPlayer(db, next, updatedAt);

      ctx.broadcast("encounter:combatantsDelta", {
        encounterId,
        action: "upsert",
        combatantId: next.id,
        combatant: toEncounterActorDto(next),
      });
      fulfillInitiativePrompt(ctx, next, campaignId);

      res.json({ ok: true });
    },
  );
}
