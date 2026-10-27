import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { ensureCharacterDeathState } from "./characterDeathState.js";

test("upgrades older tables, repairs healthy characters' stale saves, and is repeatable", () => {
  const db = new Database(":memory:");
  try {
    for (const table of ["players","user_characters"]) {
      db.exec(`CREATE TABLE ${table}(id TEXT PRIMARY KEY,hp_current INTEGER,death_saves_success INTEGER,death_saves_fail INTEGER,live_json TEXT DEFAULT '{}',character_data_json TEXT);
        INSERT INTO ${table}(id,hp_current,death_saves_success,death_saves_fail) VALUES ('hero',5,2,1),('down',0,1,2);`);
    }
    ensureCharacterDeathState(db); ensureCharacterDeathState(db);
    for (const table of ["players","user_characters"]) {
      assert.deepEqual(db.prepare(`SELECT hp_current,death_saves_success,death_saves_fail,is_dead FROM ${table} WHERE id='hero'`).get(),{hp_current:5,death_saves_success:0,death_saves_fail:0,is_dead:0});
      assert.equal((db.prepare(`SELECT death_saves_fail AS f FROM ${table} WHERE id='down'`).get() as {f:number}).f,2);
      db.prepare(`UPDATE ${table} SET hp_current=1,death_saves_success=2,death_saves_fail=3 WHERE id='down'`).run();
      assert.equal((db.prepare(`SELECT death_saves_fail AS f FROM ${table} WHERE id='down'`).get() as {f:number}).f,0);
      db.prepare(`UPDATE ${table} SET is_dead=1,live_json=? WHERE id='down'`).run(JSON.stringify({conditions:[{key:'poisoned'},{key:'frightened'}]}));
      assert.deepEqual(JSON.parse((db.prepare(`SELECT live_json AS live FROM ${table} WHERE id='down'`).get() as {live:string}).live).conditions,[]);
      db.exec(`DROP TRIGGER ${table}_clear_dead_conditions_update`);
      db.prepare(`UPDATE ${table} SET live_json=? WHERE id='down'`).run(JSON.stringify({conditions:[{key:'poisoned'}]}));
      ensureCharacterDeathState(db);
      assert.deepEqual(JSON.parse((db.prepare(`SELECT live_json AS live FROM ${table} WHERE id='down'`).get() as {live:string}).live).conditions,[]);
    }
  } finally { db.close(); }
});
