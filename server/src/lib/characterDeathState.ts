import type { Db } from "./db.js";

// Apply to every SQL write path, including combat, rests, older clients and imports.
export const CHARACTER_DEATH_TRIGGERS_SQL = ["players", "user_characters"].map((table) => `
CREATE TRIGGER IF NOT EXISTS ${table}_normalize_life_update AFTER UPDATE OF hp_current,death_saves_success,death_saves_fail,is_dead ON ${table}
WHEN (NEW.is_dead=1 AND NEW.hp_current<>0) OR (NEW.hp_current>0 AND (COALESCE(NEW.death_saves_success,0)<>0 OR COALESCE(NEW.death_saves_fail,0)<>0))
BEGIN
 UPDATE ${table} SET hp_current=CASE WHEN NEW.is_dead=1 THEN 0 ELSE NEW.hp_current END,
 death_saves_success=CASE WHEN NEW.hp_current>0 THEN 0 ELSE NEW.death_saves_success END,
 death_saves_fail=CASE WHEN NEW.hp_current>0 THEN 0 ELSE NEW.death_saves_fail END WHERE id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS ${table}_normalize_life_insert AFTER INSERT ON ${table}
WHEN (NEW.is_dead=1 AND NEW.hp_current<>0) OR (NEW.hp_current>0 AND (COALESCE(NEW.death_saves_success,0)<>0 OR COALESCE(NEW.death_saves_fail,0)<>0))
BEGIN
 UPDATE ${table} SET hp_current=CASE WHEN NEW.is_dead=1 THEN 0 ELSE NEW.hp_current END,
 death_saves_success=CASE WHEN NEW.hp_current>0 THEN 0 ELSE NEW.death_saves_success END,
 death_saves_fail=CASE WHEN NEW.hp_current>0 THEN 0 ELSE NEW.death_saves_fail END WHERE id=NEW.id;
END;`).join("\n");

const DEAD_CONDITION_TRIGGERS_SQL = ["players", "user_characters"].map((table) => {
  const sheet = table === "user_characters";
  const validLive = "CASE WHEN json_valid(NEW.live_json) THEN NEW.live_json ELSE '{}' END";
  const hasSpell = sheet ? " OR json_extract(CASE WHEN json_valid(NEW.character_data_json) THEN NEW.character_data_json ELSE '{}' END, '$.concentrationSpell') IS NOT NULL" : "";
  const cleanup = `UPDATE ${table} SET live_json=json_set(CASE WHEN json_valid(live_json) THEN live_json ELSE '{}' END,'$.conditions',json('[]'))${sheet ? ",character_data_json=json_remove(CASE WHEN json_valid(character_data_json) THEN character_data_json ELSE '{}' END,'$.concentrationSpell')" : ""} WHERE id=NEW.id;`;
  return ["UPDATE", "INSERT"].map(event => `
CREATE TRIGGER IF NOT EXISTS ${table}_clear_dead_conditions_${event.toLowerCase()} AFTER ${event}${event === "UPDATE" ? ` OF is_dead,live_json${sheet ? ",character_data_json" : ""}` : ""} ON ${table}
WHEN NEW.is_dead=1 AND (COALESCE(json_array_length(${validLive},'$.conditions'),0)>0${hasSpell})
BEGIN ${cleanup} END;`).join("\n");
}).join("\n");

export function ensureCharacterDeathState(db: Db) {
  for (const table of ["players", "user_characters"]) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{name: string}>;
    if (!columns.some(column => column.name === "is_dead")) db.exec(`ALTER TABLE ${table} ADD COLUMN is_dead INTEGER NOT NULL DEFAULT 0 CHECK(is_dead IN (0,1))`);
    db.prepare(`UPDATE ${table} SET death_saves_success=0,death_saves_fail=0 WHERE hp_current>0 AND (COALESCE(death_saves_success,0)<>0 OR COALESCE(death_saves_fail,0)<>0)`).run();
  }
  db.exec(CHARACTER_DEATH_TRIGGERS_SQL);
  db.exec(DEAD_CONDITION_TRIGGERS_SQL);
  // Clean up characters marked dead before condition cleanup was introduced.
  for (const table of ["players", "user_characters"]) db.prepare(`UPDATE ${table} SET live_json=live_json WHERE is_dead=1`).run();
}
