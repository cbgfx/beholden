import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb, rowToEncounterActor, ENCOUNTER_ACTOR_COLS } from "../../lib/db.js";
import { insertCombatant, syncCombatantToBinderNpc } from "../combat.js";
import type { StoredEncounterActor } from "../../server/userData.js";

test("Binder NPC mechanics and HP synchronize across campaigns and encounters", () => {
  const db = openDb(":memory:");
  try {
    db.prepare("INSERT INTO users (id,username,passhash,name,is_admin,created_at,updated_at) VALUES ('owner','owner','x','Owner',0,1,1)").run();
    db.prepare("INSERT INTO binders (id,owner_user_id,name,name_key,created_at,updated_at) VALUES ('binder','owner','World','world',1,1)").run();
    for (const campaignId of ["campaign-a", "campaign-b"]) {
      db.prepare("INSERT INTO campaigns (id,name,binder_id,created_at,updated_at) VALUES (?,?, 'binder',1,1)").run(campaignId, campaignId);
      db.prepare("INSERT INTO adventures (id,campaign_id,name,created_at,updated_at) VALUES (?,?,?,1,1)").run(`adventure-${campaignId}`, campaignId, campaignId);
      db.prepare("INSERT INTO encounters (id,campaign_id,adventure_id,name,created_at,updated_at) VALUES (?,?,?,?,1,1)")
        .run(`encounter-${campaignId}`, campaignId, `adventure-${campaignId}`, campaignId);
    }
    db.prepare("INSERT INTO binder_records (id,binder_id,record_type,name,name_key,visibility,created_at,updated_at) VALUES ('mortal','binder','mortal','Lord Noble','lord noble','dm',1,1)").run();
    db.prepare("INSERT INTO mortals (id,mortal_type,created_at,updated_at) VALUES ('mortal','npc',1,1)").run();
    db.prepare("INSERT INTO binder_npcs (mortal_id,hp_max,hp_current,ac,created_at,updated_at) VALUES ('mortal',9,9,15,1,1)").run();
    for (const [index, campaignId] of ["campaign-a", "campaign-b"].entries()) {
      const inpcId = `inpc-${index}`;
      db.prepare(`INSERT INTO inpcs (id,campaign_id,binder_mortal_id,name,friendly,hp_max,hp_current,ac,created_at,updated_at)
                  VALUES (?,?, 'mortal','Lord Noble',1,9,9,15,1,1)`).run(inpcId, campaignId);
      const actor: StoredEncounterActor = {
        id: `combatant-${index}`, encounterId: `encounter-${campaignId}`,
        baseType: "inpc", baseId: inpcId, name: "Lord Noble", label: "Lord Noble",
        initiative: null, friendly: true, color: "lightgreen",
        overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
        hpCurrent: 9, hpMax: 9, hpDetails: null, ac: 15, acDetails: null,
        attackOverrides: null, conditions: [], createdAt: 1, updatedAt: 1,
      };
      insertCombatant(db, actor);
    }

    const sourceRow = db.prepare(`SELECT ${ENCOUNTER_ACTOR_COLS} FROM combatants WHERE id='combatant-0'`).get() as Record<string, unknown>;
    const source = rowToEncounterActor(sourceRow);
    const result = syncCombatantToBinderNpc(db, {
      ...source, hpMax: 100, hpCurrent: 73, ac: 18,
      attackOverrides: { Rapier: { attackBonus: 9 } }, updatedAt: 2,
    }, 2);

    assert.deepEqual(result?.campaignIds.sort(), ["campaign-a", "campaign-b"]);
    assert.deepEqual(
      db.prepare("SELECT hp_max, hp_current, ac, attack_overrides_json FROM binder_npcs WHERE mortal_id='mortal'").get(),
      { hp_max: 100, hp_current: 73, ac: 18, attack_overrides_json: '{"Rapier":{"attackBonus":9}}' },
    );
    assert.deepEqual(
      db.prepare("SELECT DISTINCT hp_max, hp_current, ac FROM inpcs WHERE binder_mortal_id='mortal'").all(),
      [{ hp_max: 100, hp_current: 73, ac: 18 }],
    );
    assert.deepEqual(
      db.prepare("SELECT DISTINCT json_extract(snapshot_json,'$.hpMax') hp_max, json_extract(live_json,'$.hpCurrent') hp_current, json_extract(snapshot_json,'$.ac') ac FROM combatants").all(),
      [{ hp_max: 100, hp_current: 73, ac: 18 }],
    );
  } finally {
    db.close();
  }
});
