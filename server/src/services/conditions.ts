import type Database from "better-sqlite3";
import { now } from "../lib/runtime.js";
import { normalizeKey } from "../lib/text.js";

const DEFAULT_CONDITIONS = [
  ["blinded", "Blinded"], ["charmed", "Charmed"], ["deafened", "Deafened"],
  ["frightened", "Frightened"], ["grappled", "Grappled"], ["incapacitated", "Incapacitated"],
  ["invisible", "Invisible"], ["paralyzed", "Paralyzed"], ["petrified", "Petrified"],
  ["poisoned", "Poisoned"], ["prone", "Prone"], ["restrained", "Restrained"],
  ["slow", "Slow"], ["stunned", "Stunned"], ["unconscious", "Unconscious"],
  ["hexed", "Hexed"], ["concentration", "Concentration"], ["marked", "Marked"],
] as const;

export function seedDefaultConditions(db: Database.Database, campaignId: string): void {
  const t = now();
  const stmt = db.prepare(
    `INSERT INTO conditions (id, campaign_id, key, name, sort, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM conditions WHERE campaign_id=? AND key=?)`
  );
  // Repair the two historical display-name-derived keys before inserting defaults. If a canonical
  // row already exists, discard only the redundant catalogue alias; condition instances live on
  // actors and are unaffected.
  db.prepare(`DELETE FROM conditions WHERE campaign_id=? AND key='hex'
    AND EXISTS (SELECT 1 FROM conditions canonical WHERE canonical.campaign_id=? AND canonical.key='hexed')`).run(campaignId, campaignId);
  db.prepare(`DELETE FROM conditions WHERE campaign_id=? AND key='concentrating'
    AND EXISTS (SELECT 1 FROM conditions canonical WHERE canonical.campaign_id=? AND canonical.key='concentration')`).run(campaignId, campaignId);
  db.prepare("UPDATE conditions SET key='hexed', name='Hexed', updated_at=? WHERE campaign_id=? AND key='hex'").run(t, campaignId);
  db.prepare("UPDATE conditions SET key='concentration', name='Concentration', updated_at=? WHERE campaign_id=? AND key='concentrating'").run(t, campaignId);
  let i = 0;
  for (const [key, name] of DEFAULT_CONDITIONS) {
    i++;
    const id = `cond_${campaignId}_${normalizeKey(key).replace(/\s/g, "_")}`;
    stmt.run(id, campaignId, key, name, i, t, t, campaignId, key);
  }

}
