import { detectEndedConcentration } from "./combatTransitions.js";
import { sweepDependentConditions } from "./combat.js";
import type { ServerContext } from "../server/context.js";
import { getCampaignCharacterRow, rowToCampaignCharacter } from "../lib/db.js";

export function changePlayerLifeStatus(ctx: ServerContext, playerId: string, dead: boolean) {
  const { db } = ctx;
  const row = getCampaignCharacterRow(db, playerId);
  if (!row) return null;
  const player = rowToCampaignCharacter(row);
  if (Boolean(player.isDead) === dead) return player;
  const characterId = player.characterId ?? null;
  const affected = characterId
    ? db.prepare("SELECT id,campaign_id FROM players WHERE character_id=?").all(characterId) as Array<{id: string;campaign_id: string}>
    : [{ id: playerId, campaign_id: player.campaignId }];
  const links = db.prepare(`SELECT br.id,br.binder_id,b.current_date_sort AS binder_year
    FROM binder_player_characters bpc JOIN binder_records br ON br.id=bpc.mortal_id
    JOIN binders b ON b.id=br.binder_id
    WHERE bpc.player_id=? OR (? IS NOT NULL AND bpc.character_id=?)`).all(playerId, characterId, characterId) as Array<{id: string;binder_id: string;binder_year: number|null}>;
  const campaign = db.prepare("SELECT current_date_sort FROM campaigns WHERE id=?").get(player.campaignId) as {current_date_sort:number|null};
  if (dead && links.some(link => campaign.current_date_sort == null && link.binder_year == null)) {
    throw Object.assign(new Error("Set the campaign or Binder current year before marking this character dead."), { status: 409 });
  }
  const t = ctx.helpers.now();
  db.transaction(() => {
    if (characterId) {
      db.prepare(`UPDATE user_characters SET is_dead=?,hp_current=?,death_saves_success=0,death_saves_fail=0,live_json=json_set(live_json,'$.conditions',json('[]')),character_data_json=json_remove(COALESCE(character_data_json,'{}'),'$.concentrationSpell'),updated_at=? WHERE id=?`)
        .run(dead ? 1 : 0, dead ? 0 : 1, t, characterId);
    } else {
      db.prepare(`UPDATE players SET is_dead=?,hp_current=?,death_saves_success=0,death_saves_fail=0,live_json=json_set(live_json,'$.conditions',json('[]')),updated_at=? WHERE id=?`)
        .run(dead ? 1 : 0, dead ? 0 : 1, t, playerId);
    }
    for (const link of links) {
      const year = campaign.current_date_sort ?? link.binder_year;
      db.prepare("UPDATE mortals SET life_status=?,death_date_text=?,death_date_sort=?,updated_at=? WHERE id=?")
        .run(dead ? "dead" : "alive", dead ? String(year) : null, dead ? year : null, t, link.id);
      db.prepare("UPDATE binder_records SET updated_at=? WHERE id=?").run(t, link.id);
    }
  })();
  if (dead) {
    const casters = db.prepare(`SELECT id,encounter_id FROM combatants WHERE base_type='player' AND base_id IN (${affected.map(() => "?").join(",")})`).all(...affected.map(entry => entry.id)) as Array<{id:string;encounter_id:string}>;
    for (const caster of casters) {
      const ended = detectEndedConcentration(caster.id, player.conditions ?? [], []);
      if (ended) sweepDependentConditions(db, ctx.broadcast, caster.encounter_id, ended, t, caster.id);
    }
  }
  for (const entry of affected) ctx.broadcast("players:delta", { campaignId: entry.campaign_id, playerId: entry.id, characterId, lifeStatusChanged: true, action: "upsert" });
  const encounters = db.prepare(`SELECT DISTINCT encounter_id FROM combatants WHERE base_type='player' AND base_id IN (${affected.map(() => "?").join(",")})`).all(...affected.map(entry => entry.id)) as Array<{encounter_id:string}>;
  for (const entry of encounters) ctx.broadcast("encounter:combatantsDelta", { encounterId: entry.encounter_id, action: "refresh" });
  return rowToCampaignCharacter(getCampaignCharacterRow(db, playerId)!);
}
