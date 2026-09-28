/**
 * A DM's combat edit to a player combatant is written back to the campaign player row and mirrored
 * onto the linked character sheet. Inspiration is not a bonus: the sheet keeps it on its own
 * (`characterData.inspiration`), and it used to be mirrored into the sheet's bonus record as well,
 * a fourth copy that the bonus reader then preferred.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { openDb } from "../lib/db.js";
import { syncCombatantToPlayer } from "./combat.js";
import type { StoredEncounterActor } from "../server/userData.js";

test("a combat edit mirrors bonuses to the sheet's bonus record and inspiration to the sheet's own flag", () => {
  const db = openDb(":memory:");
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('u', 'u', 'x', 'U', 0, ?, ?)").run(t, t);
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp', 'Camp', ?, ?)").run(t, t);
  db.prepare("INSERT INTO user_characters (id, user_id, name, character_data_json, created_at, updated_at) VALUES ('char', 'u', 'Ash', '{}', ?, ?)").run(t, t);
  db.prepare(`INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, live_json, created_at, updated_at)
    VALUES ('p', 'camp', 'u', 'char', 'U', 'Ash', '{}', ?, ?)`).run(t, t);

  syncCombatantToPlayer(db, {
    id: "c", encounterId: "e", baseType: "player", baseId: "p", name: "Ash", label: "Ash", initiative: 10, friendly: true, color: "green",
    hpCurrent: 12, hpMax: 20, hpDetails: null, ac: 14, acDetails: null, attackOverrides: null, conditions: [],
    overrides: { tempHp: 5, acBonus: 2, hpMaxBonus: 0, inspiration: true },
    createdAt: t, updatedAt: t,
  } as StoredEncounterActor, t);

  const live = JSON.parse((db.prepare("SELECT live_json AS j FROM user_characters WHERE id = 'char'").get() as { j: string }).j);
  assert.deepEqual(live.overrides, { tempHp: 5, acBonus: 2, hpMaxBonus: 0, inspiration: true });
  db.close();
});
