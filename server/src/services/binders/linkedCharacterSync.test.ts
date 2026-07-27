import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { openDb, type Db } from "../../lib/db.js";
import {
  syncLinkedCharacterAgeFromMortal,
  syncLinkedCharacterPortraitFromMortal,
  syncLinkedMortalAgeFromCharacter,
  syncLinkedMortalPortraitFromCharacter,
} from "./linkedCharacterSync.js";

let db: Db | null = null;
afterEach(() => { db?.close(); db = null; });

function fixture() {
  db = openDb(":memory:");
  db.prepare("INSERT INTO users (id,username,passhash,name,is_admin,created_at,updated_at) VALUES ('u','u','x','User',0,1,1)").run();
  db.prepare("INSERT INTO binders (id,owner_user_id,name,name_key,current_date_text,current_date_sort,created_at,updated_at) VALUES ('b','u','Binder','binder','2500',2500,1,1)").run();
  db.prepare("INSERT INTO campaigns (id,name,created_at,updated_at,binder_id,current_date_text,current_date_sort) VALUES ('c','Campaign',1,1,'b','2400',2400)").run();
  db.prepare("INSERT INTO user_characters (id,user_id,name,character_data_json,image_url,image_updated_at,created_at,updated_at) VALUES ('ch','u','Hero','{\"age\":20}','/character.webp',2,1,2)").run();
  db.prepare("INSERT INTO players (id,campaign_id,user_id,character_id,player_name,character_name,live_json,created_at,updated_at) VALUES ('p','c','u','ch','Player','Hero','{}',1,1)").run();
  db.prepare("INSERT INTO binder_records (id,binder_id,record_type,name,name_key,created_at,updated_at) VALUES ('m','b','mortal','Hero','hero',1,1)").run();
  db.prepare("INSERT INTO mortals (id,gender,life_status,mortal_type,created_at,updated_at) VALUES ('m','male','alive','player_character',1,1)").run();
  db.prepare("INSERT INTO binder_player_characters (mortal_id,character_id,player_id,created_at,updated_at) VALUES ('m','ch','p',1,1)").run();
  return db;
}

test("linked age uses the selected campaign date in both directions", () => {
  const database = fixture();
  syncLinkedMortalAgeFromCharacter(database, "ch", { age: 22 }, 10);
  assert.deepEqual(
    database.prepare("SELECT birth_date_text,birth_date_sort FROM mortals WHERE id='m'").get(),
    { birth_date_text: "2378", birth_date_sort: 2378 },
  );
  database.prepare("UPDATE mortals SET birth_date_text='2370' WHERE id='m'").run();
  syncLinkedCharacterAgeFromMortal(database, "m", 11);
  assert.equal(
    JSON.parse(database.prepare("SELECT character_data_json FROM user_characters WHERE id='ch'").pluck().get() as string).age,
    30,
  );
});

test("linked portrait URL and version move in both directions", () => {
  const database = fixture();
  syncLinkedMortalPortraitFromCharacter(database, "ch", "/new-character.webp", 20);
  assert.deepEqual(
    database.prepare("SELECT image_url,image_updated_at FROM mortals WHERE id='m'").get(),
    { image_url: "/new-character.webp", image_updated_at: 20 },
  );
  syncLinkedCharacterPortraitFromMortal(database, "m", "/binder.webp", 21);
  assert.deepEqual(
    database.prepare("SELECT image_url,image_updated_at FROM user_characters WHERE id='ch'").get(),
    { image_url: "/binder.webp", image_updated_at: 21 },
  );
  assert.equal(database.prepare("SELECT image_url FROM players WHERE id='p'").pluck().get(), "/binder.webp");
});
