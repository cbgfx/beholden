import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import type { StoredEncounterActor } from "../../server/userData.js";
import { requireParam } from "../../lib/routeHelpers.js";
import { parseBody } from "../../lib/validate.js";
import { dmOrAdmin } from "../../middleware/campaignAuth.js";
import { rowToCampaignCharacter, CAMPAIGN_CHARACTER_COLS, getCampaignCharacterRow } from "../../lib/db.js";
import { ensureCombat, insertCombatant, createPlayerCombatant } from "../../services/combat.js";
import { addMonsterCombatants } from "../../services/combat.addMonster.js";
import { DEFAULT_OVERRIDES } from "../../lib/defaults.js";
import { toEncounterActorDto } from "../../lib/apiActors.js";
import { AddInpcBody, AddMonsterBody, AddPlayerBody, AddWorldActionBody } from "./helpers.js";

export function registerCombatAddCombatantRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { now, uid } = ctx.helpers;

  // MARK: - POST /api/encounters/:encounterId/combatants/addPlayers
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

  // MARK: - POST /api/encounters/:encounterId/combatants/addPlayer
  app.post("/api/encounters/:encounterId/combatants/addPlayer", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare("SELECT campaign_id FROM encounters WHERE id = ?")
      .get(encounterId) as { campaign_id: string } | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });

    const { playerId } = parseBody(AddPlayerBody, req);
    const pRow = getCampaignCharacterRow(db, playerId);
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

  // MARK: - POST /api/encounters/:encounterId/combatants/addMonster
  app.post("/api/encounters/:encounterId/combatants/addMonster", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encRow = db
      .prepare("SELECT e.id, c.ruleset FROM encounters e JOIN campaigns c ON c.id = e.campaign_id WHERE e.id = ?")
      .get(encounterId) as { id: string; ruleset: "5e" | "5.5e" } | undefined;
    if (!encRow)
      return res.status(404).json({ ok: false, message: "Encounter not found" });

    const body = parseBody(AddMonsterBody, req);
    const ruleset = body.ruleset ?? encRow.ruleset;
    const monRow = db
      .prepare("SELECT name, data_json FROM compendium_monsters WHERE id = ? AND ruleset = ?")
      .get(body.monsterId, ruleset) as { name: string; data_json: string } | undefined;
    if (!monRow)
      return res.status(404).json({ ok: false, message: "Monster not found in compendium" });

    const created = addMonsterCombatants(db, encounterId, uid, now(), {
      monsterId: body.monsterId,
      ruleset,
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

  // World actions are turn-order entries for hazards, lairs, weather, and other
  // encounter events. They deliberately have no creature statistics.

  // MARK: - POST /api/encounters/:encounterId/combatants/addWorldAction
  app.post("/api/encounters/:encounterId/combatants/addWorldAction", dmOrAdmin(db), (req, res) => {
    const encounterId = requireParam(req, res, "encounterId");
    if (!encounterId) return;
    const encounter = db.prepare("SELECT id FROM encounters WHERE id = ?").get(encounterId);
    if (!encounter) return res.status(404).json({ ok: false, message: "Encounter not found" });

    const body = parseBody(AddWorldActionBody, req);
    const t = now();
    const created: StoredEncounterActor = {
      id: uid(),
      encounterId,
      baseType: "world",
      baseId: uid(),
      name: body.name,
      label: body.name,
      ...(body.description ? { description: body.description } : {}),
      initiative: null,
      friendly: true,
      color: "#f59e0b",
      overrides: { ...DEFAULT_OVERRIDES },
      hpCurrent: null,
      hpMax: null,
      hpDetails: null,
      ac: null,
      acDetails: null,
      attackOverrides: null,
      conditions: [],
      createdAt: t,
      updatedAt: t,
    };
    ensureCombat(db, encounterId);
    insertCombatant(db, created);
    ctx.broadcast("encounter:combatantsDelta", {
      encounterId,
      action: "upsert",
      combatantId: created.id,
      combatant: toEncounterActorDto(created),
    });
    res.json({ ok: true, created: toEncounterActorDto(created) });
  });

  // ── Add iNPC ──────────────────────────────────────────────────────────────

  // MARK: - POST /api/encounters/:encounterId/combatants/addInpc
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
      .prepare(`
        SELECT i.id, i.name, i.label, i.friendly, i.hp_max, i.hp_current,
               i.hp_details, i.ac, i.ac_details, npc.attack_overrides_json
        FROM inpcs i
        LEFT JOIN binder_npcs npc ON npc.mortal_id = i.binder_mortal_id
        WHERE i.id = ?
      `).get(inpcId) as Record<string, unknown> | undefined;
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
      attackOverrides: typeof iRow.attack_overrides_json === "string"
        ? JSON.parse(iRow.attack_overrides_json)
        : null,
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
}
