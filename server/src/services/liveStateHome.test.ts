/**
 * One source of truth for a player's live state: HP, death saves, temporary HP and bonuses,
 * conditions, inspiration. A linked character's is its sheet; a hand-made player's is its row;
 * every read goes through `player_rows` (lib/playerRowsView.ts). Before this, the sheet, each
 * campaign row and each combatant kept a copy, and chains of syncs tried to keep them in step.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { openDb, getCampaignCharacterRow, rowToCampaignCharacter } from "../lib/db.js";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import Database from "better-sqlite3";
import { migrateLiveStateToSheet } from "../lib/migrations/liveStateHomeMigration.js";
import { insertCombatant, syncCombatantToPlayer, createPlayerCombatant, hydratePlayerCombatant } from "./combat.js";
import { ENCOUNTER_ACTOR_COLS, rowToEncounterActor } from "../lib/db.js";
import { writePlayerLiveState } from "./characters.js";

function seed() {
  const db = openDb(":memory:");
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('u', 'u', 'x', 'U', 0, ?, ?)").run(t, t);
  for (const id of ["camp-a", "camp-b"]) db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, id, t, t);
  db.prepare(`INSERT INTO user_characters (id, user_id, name, hp_max, hp_current, speed, character_data_json, created_at, updated_at)
    VALUES ('ash', 'u', 'Ash', 30, 30, 30, '{}', ?, ?)`).run(t, t);
  for (const [id, campaign] of [["p-a", "camp-a"], ["p-b", "camp-b"]]) {
    db.prepare(`INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, hp_max, hp_current, speed, live_json, created_at, updated_at)
      VALUES (?, ?, 'u', 'ash', 'U', 'Ash', 30, 30, 30, '{}', ?, ?)`).run(id, campaign, t, t);
  }
  db.prepare(`INSERT INTO players (id, campaign_id, player_name, character_name, hp_max, hp_current, speed, live_json, created_at, updated_at)
    VALUES ('p-hand', 'camp-a', 'DM', 'Hireling', 10, 10, 30, '{}', ?, ?)`).run(t, t);
  return db;
}
const player = (db: ReturnType<typeof openDb>, id: string) => rowToCampaignCharacter(getCampaignCharacterRow(db, id)!);

test("a character in two campaigns has one set of wounds: a fight in one shows in the other at once", () => {
  const db = seed();
  const t = Date.now();
  const combatant = createPlayerCombatant({ encounterId: "enc", player: player(db, "p-a"), t });
  syncCombatantToPlayer(db, { ...combatant, hpCurrent: 11, conditions: [{ key: "poisoned" }], overrides: { tempHp: 4, acBonus: 0, hpMaxBonus: 0, inspiration: true } }, t);

  for (const id of ["p-a", "p-b"]) {
    const seen = player(db, id);
    assert.equal(seen.hpCurrent, 11, `${id} sees the same HP`);
    assert.deepEqual(seen.conditions?.map((condition) => condition.key), ["poisoned"]);
    assert.equal(seen.overrides?.tempHp, 4);
    assert.equal(seen.overrides?.inspiration, true);
  }
  // Written once, to the sheet; the rows hold no copy.
  const sheet = db.prepare("SELECT hp_current AS hp, live_json AS j FROM user_characters WHERE id = 'ash'").get() as { hp: number; j: string };
  assert.equal(sheet.hp, 11);
  assert.deepEqual(JSON.parse(sheet.j).overrides, { tempHp: 4, acBonus: 0, hpMaxBonus: 0, inspiration: true });
  const rowCopy = db.prepare("SELECT hp_current AS hp, live_json AS j FROM players WHERE id = 'p-b'").get() as { hp: number; j: string };
  assert.equal(rowCopy.j, "{}");
  db.close();
});

test("a hand-made player keeps its live state on its own row", () => {
  const db = seed();
  writePlayerLiveState(db, "p-hand", { hpCurrent: 4, overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 }, conditions: [{ key: "prone" }] }, Date.now());
  const hireling = player(db, "p-hand");
  assert.equal(hireling.hpCurrent, 4);
  assert.deepEqual(hireling.conditions?.map((condition) => condition.key), ["prone"]);
  db.close();
});

test("a player combatant stores only what belongs to the fight", () => {
  const db = seed();
  const t = Date.now();
  const combatant = { ...createPlayerCombatant({ encounterId: "enc", player: player(db, "p-a"), t }), initiative: 14, usedReaction: true };
  const t0 = Date.now();
  db.prepare("INSERT INTO adventures (id, campaign_id, name, sort, created_at, updated_at) VALUES ('adv', 'camp-a', 'A', 1, ?, ?)").run(t0, t0);
  db.prepare("INSERT INTO encounters (id, campaign_id, adventure_id, name, sort, created_at, updated_at) VALUES ('enc', 'camp-a', 'adv', 'E', 1, ?, ?)").run(t0, t0);
  insertCombatant(db, combatant);
  const stored = db.prepare("SELECT live_json AS live, snapshot_json AS snapshot FROM combatants WHERE id = ?").get(combatant.id) as { live: string; snapshot: string };
  const live = JSON.parse(stored.live);
  assert.equal(live.initiative, 14);
  assert.equal(live.usedReaction, true);
  for (const key of ["hpCurrent", "conditions", "overrides", "deathSaves"]) assert.equal(key in live, false, `${key} is the player's, not the fight's`);
  const snapshot = JSON.parse(stored.snapshot);
  assert.equal(snapshot.label, "Ash", "the label the DM gave it in this fight is the fight's");
  for (const key of ["name", "hpMax", "ac"]) assert.equal(key in snapshot, false, `${key} is the character's, not the fight's`);

  // Read back, the combatant still shows the character's name, HP and AC.
  const row = db.prepare(`SELECT ${ENCOUNTER_ACTOR_COLS} FROM combatants WHERE id = ?`).get(combatant.id) as Record<string, unknown>;
  const shown = hydratePlayerCombatant(db, rowToEncounterActor(row));
  assert.equal(shown.name, "Ash");
  assert.equal(shown.hpMax, 30);
  assert.equal(shown.hpCurrent, 30);
  db.close();
});

test("speed under a condition is worked out when read: removing a grapple gives the speed back", () => {
  const db = seed();
  const t = Date.now();
  writePlayerLiveState(db, "p-hand", { hpCurrent: 10, overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 }, conditions: [{ key: "grappled" }] }, t);
  assert.equal(player(db, "p-hand").speed, 0);
  assert.equal(player(db, "p-hand").baseSpeed, 30);
  writePlayerLiveState(db, "p-hand", { hpCurrent: 10, overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 }, conditions: [] }, t);
  assert.equal(player(db, "p-hand").speed, 30, "the stored speed was never overwritten with 0");
  db.close();
});

test("the migration gives the sheet what players and DMs saw, clears the row copies, and runs once", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('u', 'u', 'x', 'U', 0, ?, ?)").run(t, t);
  for (const id of ["c1", "c2"]) db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, id, t, t);
  // The sheet's own bonuses, as the column migration left them in live_json.
  db.prepare(`INSERT INTO user_characters (id, user_id, name, hp_max, hp_current, character_data_json, live_json, created_at, updated_at)
    VALUES ('ash', 'u', 'Ash', 30, 30, '{}', ?, ?, ?)`).run(JSON.stringify({ overrides: { tempHp: 0, acBonus: 1, hpMaxBonus: 0, permanent: { acBonus: true } } }), t, t);
  const row = db.prepare(`INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, hp_max, hp_current, live_json, death_saves_success, death_saves_fail, created_at, updated_at)
    VALUES (?, ?, 'u', 'ash', 'U', 'Ash', 30, ?, ?, ?, ?, ?, ?)`);
  row.run("old", "c1", 25, JSON.stringify({ conditions: [{ key: "blinded" }] }), 0, 0, t, t - 1000);
  row.run("new", "c2", 12, JSON.stringify({ conditions: [{ key: "poisoned" }], overrides: { tempHp: 5, acBonus: 0, hpMaxBonus: 0, inspiration: true } }), 1, 2, t, t);

  migrateLiveStateToSheet(db);
  const sheet = db.prepare("SELECT hp_current AS hp, death_saves_success AS s, death_saves_fail AS f, live_json AS j FROM user_characters WHERE id = 'ash'").get() as { hp: number; s: number; f: number; j: string };
  const live = JSON.parse(sheet.j);
  assert.deepEqual([sheet.hp, sheet.s, sheet.f], [12, 1, 2], "HP and death saves from the most recently changed row");
  assert.deepEqual(live.conditions, [{ key: "poisoned" }]);
  assert.deepEqual(live.overrides, { tempHp: 0, acBonus: 1, hpMaxBonus: 0, permanent: { acBonus: true }, inspiration: true },
    "the sheet's own bonuses won, as they did when read; inspiration from the row");
  const rows = db.prepare("SELECT live_json AS j FROM players").all() as Array<{ j: string }>;
  assert.deepEqual(rows.map((r) => r.j), ["{}", "{}"]);

  db.prepare("UPDATE user_characters SET hp_current = 7 WHERE id = 'ash'").run();
  migrateLiveStateToSheet(db);
  assert.equal((db.prepare("SELECT hp_current AS hp FROM user_characters WHERE id = 'ash'").get() as { hp: number }).hp, 7, "a second run changes nothing");
  db.close();
});

// MARK: - Profile

test("the profile has one home too: a sheet change shows in every campaign at once", () => {
  const db = seed();
  db.prepare(`UPDATE user_characters SET name = 'Ash the Bold', ac = 17, level = 6, derived_speed = 35, derived_hp_max = 44 WHERE id = 'ash'`).run();
  for (const id of ["p-a", "p-b"]) {
    const seen = player(db, id);
    assert.equal(seen.characterName, "Ash the Bold");
    assert.equal(seen.ac, 17);
    assert.equal(seen.level, 6);
    assert.equal(seen.hpMax, 44, "the HP maximum the player's app worked out");
    assert.equal(seen.speed, 35, "the speed the player's app worked out");
  }
  db.close();
});

test("a campaign portrait the DM chose shows instead of the character's; without one, the character's shows", () => {
  const db = seed();
  db.prepare("UPDATE user_characters SET image_url = '/character-images/ash.webp' WHERE id = 'ash'").run();
  assert.equal(player(db, "p-a").imageUrl?.startsWith("/character-images/ash.webp"), true);
  db.prepare("UPDATE players SET image_url = '/player-images/p-a.webp', image_updated_at = 1 WHERE id = 'p-a'").run();
  assert.equal(player(db, "p-a").imageUrl?.startsWith("/player-images/p-a.webp"), true);
  assert.equal(player(db, "p-b").imageUrl?.startsWith("/character-images/ash.webp"), true, "the other campaign is unaffected");
  db.close();
});

test("the profile migration moves the worked-out speed to the sheet and clears copied portraits, once", async () => {
  const { migrateProfileToSheet } = await import("../lib/migrations/profileHomeMigration.js");
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('u', 'u', 'x', 'U', 0, ?, ?)").run(t, t);
  for (const id of ["c1", "c2"]) db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, id, t, t);
  db.prepare(`INSERT INTO user_characters (id, user_id, name, speed, image_url, character_data_json, created_at, updated_at)
    VALUES ('ash', 'u', 'Ash', 30, '/character-images/ash.webp', '{}', ?, ?)`).run(t, t);
  const row = db.prepare(`INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, speed, image_url, live_json, created_at, updated_at)
    VALUES (?, ?, 'u', 'ash', 'U', 'Ash', ?, ?, '{}', ?, ?)`);
  row.run("copy", "c1", 35, "/character-images/ash.webp", t, t);
  row.run("dm", "c2", 35, "/player-images/dm.webp", t, t - 1000);

  migrateProfileToSheet(db);
  assert.equal((db.prepare("SELECT derived_speed AS s FROM user_characters WHERE id = 'ash'").get() as { s: number }).s, 35);
  const images = Object.fromEntries((db.prepare("SELECT id, image_url FROM players").all() as Array<{ id: string; image_url: string | null }>).map((r) => [r.id, r.image_url]));
  assert.deepEqual(images, { copy: null, dm: "/player-images/dm.webp" });

  db.prepare("UPDATE players SET image_url = '/character-images/other.webp' WHERE id = 'copy'").run();
  migrateProfileToSheet(db);
  assert.equal((db.prepare("SELECT image_url FROM players WHERE id = 'copy'").get() as { image_url: string }).image_url, "/character-images/other.webp", "a second run changes nothing");
  db.close();
});

// MARK: - Columns

test("live state and app-worked stats move out of the data blob into their columns, once", async () => {
  const { migrateSheetLiveColumns } = await import("../lib/migrations/sheetLiveColumnsMigration.js");
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const t = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('u', 'u', 'x', 'U', 0, ?, ?)").run(t, t);
  db.prepare(`INSERT INTO user_characters (id, user_id, name, ac, character_data_json, created_at, updated_at) VALUES ('ash', 'u', 'Ash', 12, ?, ?, ?)`).run(JSON.stringify({
    notes: "kept",
    sheetOverrides: { tempHp: 3, acBonus: 1, hpMaxBonus: 0, permanent: { acBonus: true } },
    inspiration: true,
    conditions: [{ key: "prone" }],
    derivedHpMax: 44, derivedSpeed: 35, derivedAc: 17,
  }), t, t);

  migrateSheetLiveColumns(db);
  const row = db.prepare("SELECT character_data_json AS data, live_json AS live, derived_hp_max AS hp, derived_speed AS speed, ac FROM user_characters WHERE id = 'ash'").get() as
    { data: string; live: string; hp: number; speed: number; ac: number };
  assert.deepEqual(JSON.parse(row.data), { notes: "kept" }, "the blob keeps only its own data");
  assert.deepEqual(JSON.parse(row.live), { overrides: { tempHp: 3, acBonus: 1, hpMaxBonus: 0, permanent: { acBonus: true }, inspiration: true }, conditions: [{ key: "prone" }] });
  assert.deepEqual([row.hp, row.speed, row.ac], [44, 35, 17]);

  const before = JSON.stringify(row);
  migrateSheetLiveColumns(db);
  assert.equal(JSON.stringify(db.prepare("SELECT character_data_json AS data, live_json AS live, derived_hp_max AS hp, derived_speed AS speed, ac FROM user_characters WHERE id = 'ash'").get()), before, "a second run changes nothing");
  db.close();
});
