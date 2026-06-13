import type Database from "better-sqlite3";
import { now } from "../lib/runtime.js";
import { normalizeKey } from "../lib/text.js";

export function seedDefaultConditions(db: Database.Database, campaignId: string): void {
  const defaults: string[] = [
    "Blinded",
    "Charmed",
    "Deafened",
    "Frightened",
    "Grappled",
    "Incapacitated",
    "Invisible",
    "Paralyzed",
    "Petrified",
    "Poisoned",
    "Prone",
    "Restrained",
    "Stunned",
    "Unconscious",
    "Hex",
    "Concentrating",
    "Marked",
  ];
  const t = now();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO conditions (id, campaign_id, key, name, sort, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  let i = 0;
  for (const name of defaults) {
    i++;
    const nameKey = normalizeKey(name);
    const id = `cond_${campaignId}_${nameKey.replace(/\s/g, "_")}`;
    stmt.run(id, campaignId, nameKey, name, i, t, t);
  }
}
