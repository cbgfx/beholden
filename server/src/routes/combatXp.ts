import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { dmOrAdmin } from "../middleware/campaignAuth.js";

export function registerCombatXpRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now } = ctx.helpers;

  app.post(
    "/api/encounters/:encounterId/award-xp",
    dmOrAdmin(db),
    (req, res) => {
      const encounterId = requireParam(req, res, "encounterId");
      if (!encounterId) return;

      const rawXp = (req.body as { xpPerCharacter?: unknown }).xpPerCharacter;
      const xpPerCharacter =
        typeof rawXp === "number" && Number.isFinite(rawXp) && rawXp > 0
          ? Math.round(rawXp)
          : null;
      if (xpPerCharacter === null) {
        return res.status(400).json({ ok: false, message: "xpPerCharacter must be a positive number" });
      }

      const encounter = db
        .prepare("SELECT campaign_id FROM encounters WHERE id = ?")
        .get(encounterId) as { campaign_id: string } | undefined;
      if (!encounter) return res.status(404).json({ ok: false, message: "Encounter not found" });

      const characters = db.prepare(`
        SELECT DISTINCT p.character_id
        FROM combatants c
        JOIN players p ON c.base_type = 'player' AND p.id = c.base_id
        WHERE c.encounter_id = ? AND p.character_id IS NOT NULL
      `).all(encounterId) as Array<{ character_id: string }>;
      if (characters.length === 0) return res.json({ ok: true, awarded: 0 });

      const updatedAt = now();
      const updateXp = db.prepare(`
        UPDATE user_characters
        SET
          character_data_json = json_set(
            COALESCE(character_data_json, '{}'),
            '$.xp',
            CAST(COALESCE(json_extract(character_data_json, '$.xp'), 0) AS INTEGER) + ?
          ),
          updated_at = ?
        WHERE id = ?
      `);
      db.transaction(() => {
        for (const character of characters) {
          updateXp.run(xpPerCharacter, updatedAt, character.character_id);
        }
      })();

      for (const character of characters) {
        ctx.broadcast("xp:awarded", {
          campaignId: encounter.campaign_id,
          characterId: character.character_id,
          xpAdded: xpPerCharacter,
        });
      }

      res.json({ ok: true, awarded: characters.length });
    },
  );
}
