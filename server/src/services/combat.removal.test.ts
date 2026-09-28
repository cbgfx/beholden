/**
 * The one way a combatant leaves an encounter, and the repair for what earlier ways left behind.
 *
 * A combatant is referenced from places the database cannot see: the encounter's turn pointer, and
 * the `casterId` on conditions it sustains on others (Hex, Hunter's Mark). Removal used to happen in
 * three routes, each remembering part of the cleanup - the live database had twelve combatants for
 * deleted players and eight Hex or Hunter's Mark conditions still on monsters after their caster had
 * gone.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import {
  checkCombatIntegrity,
  removeCombatant,
  removeInpcCombatants,
  removePlayerCombatants,
} from "./combat.removal.js";

type Event = { type: string; payload: Record<string, unknown> };

function seed(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-1', 'Camp', ?, ?)").run(t, t);
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv-1', 'camp-1', 'One', 1, ?, ?)").run(t, t);
  for (const id of ["enc-1", "enc-2"]) {
    db.prepare("INSERT INTO encounters (id, campaign_id, adventure_id, name, sort, created_at, updated_at) VALUES (?, 'camp-1', 'adv-1', ?, 1, ?, ?)")
      .run(id, id, t, t);
  }
  for (const id of ["p-warlock", "p-fighter"]) {
    db.prepare(`INSERT INTO players (id, campaign_id, player_name, character_name, level, live_json, created_at, updated_at)
      VALUES (?, 'camp-1', 'Player', ?, 3, '{}', ?, ?)`).run(id, id, t, t);
  }
  db.prepare(`INSERT INTO inpcs (id, campaign_id, monster_id, name, label, friendly, hp_max, hp_current, ac, created_at, updated_at)
    VALUES ('npc-1', 'camp-1', 'mon-x', 'Guide', 'Guide', 1, 10, 10, 12, ?, ?)`).run(t, t);

  const add = db.prepare(`
    INSERT INTO combatants (id, encounter_id, base_type, base_id, snapshot_json, live_json, sort, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const live = (initiative: number, conditions: unknown[] = []) => JSON.stringify({ initiative, hpCurrent: 10, conditions });
  // enc-1, initiative order: warlock 18, goblin 12, fighter 9.
  add.run("c-warlock", "enc-1", "player", "p-warlock", JSON.stringify({ name: "Warlock" }), live(18, [{ key: "concentration" }]), t, t);
  add.run("c-goblin", "enc-1", "monster", "mon-goblin", JSON.stringify({ name: "Goblin", hpMax: 7 }),
    live(12, [{ key: "hexed", casterId: "c-warlock", hexAbility: "str" }, { key: "prone" }]), t, t);
  add.run("c-fighter", "enc-1", "player", "p-fighter", JSON.stringify({ name: "Fighter" }), live(9), t, t);
  add.run("c-npc", "enc-2", "inpc", "npc-1", JSON.stringify({ name: "Guide" }), live(5), t, t);
  return db;
}

const recorder = () => {
  const events: Event[] = [];
  const broadcast = ((type: string, payload: Record<string, unknown>) => { events.push({ type, payload }); }) as never;
  return { events, broadcast };
};

const conditionKeysOf = (db: Database.Database, id: string) =>
  (JSON.parse((db.prepare("SELECT live_json AS j FROM combatants WHERE id = ?").get(id) as { j: string }).j).conditions as { key: string }[])
    .map((condition) => condition.key);

const turnOf = (db: Database.Database, id = "enc-1") =>
  db.prepare("SELECT combat_round AS round, combat_active_combatant_id AS active FROM encounters WHERE id = ?").get(id) as { round: number; active: string | null };

test("a caster leaving the fight ends what they were sustaining on others", () => {
  const db = seed();
  const { broadcast } = recorder();
  removeCombatant(db, broadcast, "enc-1", "c-warlock", Date.now());

  // Hex ends with the warlock; being knocked prone has nothing to do with them.
  assert.deepEqual(conditionKeysOf(db, "c-goblin"), ["prone"]);
  db.close();
});

test("removing whoever's turn it is hands the turn on, from every removal path", () => {
  const db = seed();
  const { broadcast, events } = recorder();
  db.prepare("UPDATE encounters SET combat_round = 2, combat_active_combatant_id = 'c-goblin' WHERE id = 'enc-1'").run();

  removeCombatant(db, broadcast, "enc-1", "c-goblin", Date.now());
  assert.deepEqual(turnOf(db), { round: 2, active: "c-fighter" });
  assert.ok(events.some((event) => event.type === "encounter:combatStateChanged"));

  // Removing a player from the campaign on their turn goes through the same path. The fighter was
  // last to act, so the round turns over.
  removePlayerCombatants(db, broadcast, "p-fighter");
  assert.deepEqual(turnOf(db), { round: 3, active: "c-warlock" });
  db.close();
});

test("deleting a player or an INPC takes them out of every encounter", () => {
  const db = seed();
  const { broadcast } = recorder();
  assert.equal(removePlayerCombatants(db, broadcast, "p-warlock"), 1);
  assert.equal(removeInpcCombatants(db, broadcast, "npc-1"), 1);
  const left = (db.prepare("SELECT id FROM combatants ORDER BY id").all() as { id: string }[]).map((row) => row.id);
  assert.deepEqual(left, ["c-fighter", "c-goblin"]);
  // And the warlock's Hex went with them.
  assert.deepEqual(conditionKeysOf(db, "c-goblin"), ["prone"]);
  db.close();
});

test("the repair finds and fixes what earlier removals left behind", () => {
  const db = seed();
  const { broadcast } = recorder();
  // What the old routes did: delete rows directly, leaving everything that pointed at them.
  db.prepare("UPDATE encounters SET combat_active_combatant_id = 'c-warlock' WHERE id = 'enc-1'").run();
  db.prepare("DELETE FROM combatants WHERE id = 'c-warlock'").run();
  db.prepare("DELETE FROM players WHERE id = 'p-fighter'").run();

  const found = checkCombatIntegrity(db, broadcast, { repair: false });
  assert.deepEqual(found, { orphanedCombatants: 1, strandedCasterConditions: 1, danglingTurnPointers: 1 });
  assert.ok(db.prepare("SELECT 1 FROM combatants WHERE id = 'c-fighter'").get(), "a report changes nothing");

  checkCombatIntegrity(db, broadcast, { repair: true });
  assert.deepEqual(checkCombatIntegrity(db, broadcast, { repair: false }),
    { orphanedCombatants: 0, strandedCasterConditions: 0, danglingTurnPointers: 0 });
  assert.equal(db.prepare("SELECT 1 FROM combatants WHERE id = 'c-fighter'").get(), undefined, "the deleted player's combatant is gone");
  assert.deepEqual(conditionKeysOf(db, "c-goblin"), ["prone"], "the Hex whose caster left has ended");
  assert.equal(turnOf(db).active, null, "and the turn no longer points at nobody");
  db.close();
});

test("one repair pass clears a condition whose caster was itself an orphan", () => {
  // The warlock's player is gone, so their combatant is an orphan, and the Hex they were
  // sustaining on the goblin points at it. Scanning before removing left that Hex for the next
  // run, so a restarted server needed a second restart to settle.
  const db = seed();
  const { broadcast } = recorder();
  db.prepare("DELETE FROM players WHERE id = 'p-warlock'").run();
  const report = checkCombatIntegrity(db, broadcast, { repair: true });
  assert.equal(report.orphanedCombatants, 1);
  assert.deepEqual(conditionKeysOf(db, "c-goblin"), ["prone"]);
  assert.equal(checkCombatIntegrity(db, () => {}, { repair: false }).strandedCasterConditions, 0);
  db.close();
});

test("the repair report runs on a database no server has opened", () => {
  // `npm run db:maintenance` opens the file as it is, without the startup migrations, so the
  // report cannot read through the `player_rows` view: it had crashed on a restored backup.
  const db = seed();
  db.exec("DROP VIEW IF EXISTS player_rows");
  db.prepare("DELETE FROM players WHERE id = 'p-fighter'").run();
  const report = checkCombatIntegrity(db, () => {}, { repair: false });
  assert.ok(report.orphanedCombatants >= 1);
  db.close();
});

test("a monster whose compendium entry is gone is still a perfectly good combatant", () => {
  const db = seed();
  const { broadcast } = recorder();
  // The goblin's compendium entry never existed in this database at all - as it would not between
  // clearing the compendium and importing it again. The combatant carries its own snapshot.
  assert.equal(db.prepare("SELECT 1 FROM compendium_monsters WHERE id = 'mon-goblin'").get(), undefined);
  checkCombatIntegrity(db, broadcast, { repair: true });
  assert.ok(db.prepare("SELECT 1 FROM combatants WHERE id = 'c-goblin'").get(), "the goblin stays in the fight");
  db.close();
});
