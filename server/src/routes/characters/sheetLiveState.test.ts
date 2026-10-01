/**
 * Character sheets: rests and live state, through the real routes.
 *
 * - The DM's Full Rest only reset HP, temporary bonuses and conditions on the campaign rows. Spell
 *   slots, class resources, hit dice, exhaustion, death saves, concentration and item charges on
 *   each sheet stayed spent. It is now the same long rest as the player's own button.
 * - A character in no campaign could not hold a condition or inspiration: both lived only on
 *   campaign rows, so the server answered OK and the change was gone on reload. The sheet now keeps
 *   its own copy, which a new campaign starts from and a character leaving its last one keeps.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import multer from "multer";
import { characterDataAfterLongRest, recoverItemCharges } from "@beholden/shared/domain/longRest";
import { openDb } from "../../lib/db.js";
import { mergeLiveJson, takeSheetColumnKeys } from "../../lib/sheetLiveColumns.js";
import { zodErrorMiddleware } from "../../lib/validate.js";
import type { ServerContext } from "../../server/context.js";
import { registerCampaignRoutes } from "../campaigns/core.js";
import { registerCharacterRoutes } from "./core.js";

type Call = (method: string, urlPath: string, body?: unknown, as?: "player" | "dm") => Promise<{ status: number; body: any }>;

async function withServer(run: (call: Call, db: ServerContext["db"], events: Array<{ type: string; payload: any }>) => Promise<void>) {
  const db = openDb(":memory:");
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-sheet-test-"));
  let seq = 0;
  const t0 = Date.now();
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('user-1', 'rin', 'x', 'Rin', 0, ?, ?)").run(t0, t0);
  db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('dm-1', 'dm', 'x', 'DM', 0, ?, ?)").run(t0, t0);
  db.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('camp-1', 'Camp', ?, ?)").run(t0, t0);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m-1', 'camp-1', 'user-1', 'player', ?, ?)").run(t0, t0);
  db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES ('m-2', 'camp-1', 'dm-1', 'dm', ?, ?)").run(t0, t0);

  const events: Array<{ type: string; payload: any }> = [];
  const upload = multer({ storage: multer.memoryStorage() });
  const ctx = {
    db, fs, path, os,
    paths: { dataDir },
    broadcast: (type: string, payload: unknown) => { events.push({ type, payload }); },
    upload, imageUpload: upload, compendiumUpload: upload, dbImportUpload: upload,
    helpers: {
      now: () => Date.now() + (++seq),
      uid: () => `gen-${++seq}`,
      normalizeKey: (s: string) => s.toLowerCase().replace(/[^\w]+/g, "_"),
      parseLeadingInt: () => null,
      normalizeHp: (v: unknown) => v,
      ensureCombat: () => {},
      nextLabelNumber: () => 1,
      createPlayerCombatant: () => ({}),
      seedDefaultConditions: () => {},
    },
  } as unknown as ServerContext;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = (req.headers["x-test-actor"] === "dm"
      ? { userId: "dm-1", username: "dm", name: "DM", isAdmin: false }
      : { userId: "user-1", username: "rin", name: "Rin", isAdmin: false }) as never;
    next();
  });
  registerCharacterRoutes(app, ctx);
  registerCampaignRoutes(app, ctx);
  app.use(zodErrorMiddleware);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;

  const call: Call = (method, urlPath, body, as = "player") => new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = http.request({
      hostname: "127.0.0.1", port, path: urlPath, method,
      headers: { "x-test-actor": as, ...(payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {}) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { /* keep the text */ }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });

  try {
    await run(call, db, events);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// Seeds a sheet as a migrated database holds it: live state and app-worked stats in their columns.
function seedCharacter(db: ServerContext["db"], characterData: Record<string, unknown>, sheet: { hpCurrent?: number; deathSaves?: [number, number] } = {}) {
  const t = Date.now();
  const full = { age: 30, gender: "female", ...characterData };
  const taken = takeSheetColumnKeys(full);
  db.prepare(`INSERT INTO user_characters
    (id, user_id, name, ruleset, hp_max, hp_current, death_saves_success, death_saves_fail, character_data_json, live_json, created_at, updated_at)
    VALUES ('char-ash', 'user-1', 'Ash', '5.5e', 20, ?, ?, ?, ?, ?, ?, ?)`)
    .run(sheet.hpCurrent ?? 20, sheet.deathSaves?.[0] ?? 0, sheet.deathSaves?.[1] ?? 0,
      JSON.stringify(taken ? taken.data : full), mergeLiveJson("{}", taken?.values.live), t, t);
}
const storedLive = (db: ServerContext["db"]) =>
  JSON.parse((db.prepare("SELECT live_json AS j FROM user_characters WHERE id = 'char-ash'").get() as { j: string }).j) as Record<string, any>;

const storedData = (db: ServerContext["db"]) =>
  JSON.parse((db.prepare("SELECT character_data_json AS j FROM user_characters WHERE id = 'char-ash'").get() as { j: string }).j) as Record<string, any>;

// MARK: - The long rest rules

test("the shared long rest restores what a night restores, and only that", () => {
  const rested: Record<string, any> = characterDataAfterLongRest({
    resources: [
      { key: "rage", name: "Rage", current: 0, max: 3, reset: "L" },
      { key: "ki", name: "Focus", current: 1, max: 5, reset: "SL" },
      { key: "wish", name: "Once ever", current: 0, max: 1, reset: "" },
    ],
    usedSpellSlots: { "1": 2, "3": 1 },
    hitDiceSpent: { "10": 3 },
    exhaustion: 2,
    concentrationSpell: "Bless",
    inventory: [
      { id: "wand", name: "Wand", uses: { max: 7, recover: "1d6+1" }, charges: 1, chargesMax: 7 },
      { id: "staff", name: "Staff", uses: 5, charges: 0 },
      { id: "orb", name: "Spent Orb", uses: { max: 3, recover: false }, charges: 0, chargesMax: 3 },
      { id: "rope", name: "Rope" },
    ],
    notes: "untouched",
  }, () => 4);

  assert.deepEqual(rested.resources.map((resource: { current: number }) => resource.current), [3, 5, 0]);
  assert.deepEqual(rested.usedSpellSlots, {});
  assert.equal("hitDiceSpent" in rested, false, "nothing spent: every hit die is back");
  assert.equal(rested.exhaustion, 1);
  assert.equal(rested.concentrationSpell, null);
  assert.deepEqual(rested.inventory.map((item: { charges?: number }) => item.charges), [5, 5, 0, undefined]);
  assert.equal(rested.notes, "untouched");
  // A recovery roll never goes past the maximum.
  assert.equal(recoverItemCharges({ uses: { max: 7, recover: "1d6+1" }, charges: 6, chargesMax: 7 }, () => 4).charges, 7);
});

// MARK: - Full Rest

test("the DM's Full Rest is a real long rest on each linked sheet", async () => {
  await withServer(async (call, db, events) => {
    seedCharacter(db, {
      resources: [{ key: "rage", name: "Rage", current: 0, max: 3, reset: "L" }],
      usedSpellSlots: { "1": 2 },
      hitDiceSpent: { "12": 4 },
      exhaustion: 2,
      concentrationSpell: "Bless",
      inventory: [{ id: "staff", name: "Staff", uses: 5, charges: 0 }],
      sheetOverrides: { tempHp: 6, acBonus: 2, hpMaxBonus: 4, permanent: { hpMaxBonus: true } },
    }, { hpCurrent: 3, deathSaves: [1, 2] });
    assert.equal((await call("POST", "/api/me/characters/char-ash/assign", { campaignIds: ["camp-1"] })).status, 200);
    const playerId = (db.prepare("SELECT id FROM players WHERE character_id = 'char-ash'").get() as { id: string }).id;

    const rest = await call("POST", "/api/campaigns/camp-1/fullRest", undefined, "dm");
    assert.equal(rest.status, 200, JSON.stringify(rest.body));

    const data = storedData(db);
    assert.equal(data.resources[0].current, 3, "rage back");
    assert.deepEqual(data.usedSpellSlots, {}, "slots back");
    assert.equal("hitDiceSpent" in data, false, "hit dice back");
    assert.equal(data.exhaustion, 1);
    assert.equal(data.concentrationSpell, null);
    assert.equal(data.inventory[0].charges, 5, "item charges back");
    const { inspiration: _inspiration, ...restedBonuses } = storedLive(db).overrides;
    assert.deepEqual(restedBonuses, { tempHp: 0, acBonus: 0, hpMaxBonus: 4, abilityScores: {}, permanent: { hpMaxBonus: true } },
      "temp HP and the one-night bonus gone, the permanent one kept");

    const sheet = db.prepare("SELECT hp_current AS hp, death_saves_success AS s, death_saves_fail AS f FROM user_characters WHERE id = 'char-ash'").get() as { hp: number; s: number; f: number };
    assert.deepEqual(sheet, { hp: 24, s: 0, f: 0 }, "full HP, counting the permanent bonus; death saves cleared");

    const sheetView = (await call("GET", "/api/me/characters/char-ash")).body;
    assert.equal(sheetView.live.hpCurrent, 24);
    assert.equal("hpCurrent" in sheetView.sheet, false, "current HP has one wire owner under live");
    assert.ok(events.some((event) => event.type === "players:delta" && event.payload.campaignId === "camp-1"), "open sheets reload");
    assert.ok(playerId);
  });
});

test("the DM's Full Rest restores Heroic Inspiration from a structured species trait", async () => {
  await withServer(async (call, db) => {
    db.prepare(`INSERT INTO compendium_races
      (id, ruleset, name, name_key, size, speed, data_json)
      VALUES (?, '5.5e', 'Human', 'human', 'Medium', 30, ?)`)
      .run("human", JSON.stringify({
        id: "human",
        name: "Human",
        traits: [{
          id: "resourceful",
          name: "Resourceful",
          text: "You regain Heroic Inspiration when you finish a Long Rest.",
          effects: [{ type: "resource_grant", resourceKey: "heroic_inspiration" }],
        }],
      }));
    seedCharacter(db, { raceId: "human" });
    assert.equal((await call("POST", "/api/me/characters/char-ash/assign", { campaignIds: ["camp-1"] })).status, 200);

    const rest = await call("POST", "/api/campaigns/camp-1/fullRest", undefined, "dm");
    assert.equal(rest.status, 200, JSON.stringify(rest.body));
    assert.equal(storedLive(db).overrides.inspiration, true);
  });
});

test("only the campaign's DM may call a Full Rest, rename or archive it", async () => {
  await withServer(async (call) => {
    assert.equal((await call("POST", "/api/campaigns/camp-1/fullRest", undefined, "player")).status, 403);
    assert.equal((await call("PUT", "/api/campaigns/camp-1", { name: "Mine now", isActive: false }, "player")).status, 403);
    assert.equal((await call("PUT", "/api/campaigns/camp-1", { name: "x".repeat(129) }, "dm")).status, 400, "an oversized name is refused");
    const renamed = await call("PUT", "/api/campaigns/camp-1", { name: "The Long Night" }, "dm");
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.name, "The Long Night");
  });
});

test("Full Rest never overwrites a sheet whose data cannot be read", async () => {
  await withServer(async (call, db) => {
    seedCharacter(db, {});
    assert.equal((await call("POST", "/api/me/characters/char-ash/assign", { campaignIds: ["camp-1"] })).status, 200);
    db.prepare("UPDATE user_characters SET character_data_json = '{not json' WHERE id = 'char-ash'").run();
    assert.equal((await call("POST", "/api/campaigns/camp-1/fullRest", undefined, "dm")).status, 200);
    assert.equal((db.prepare("SELECT character_data_json AS j FROM user_characters WHERE id = 'char-ash'").get() as { j: string }).j, "{not json");
  });
});

// MARK: - Prepared spells

test("an older tab still sending prepared name lists has them stored as flags on the spells", async () => {
  await withServer(async (call, db) => {
    seedCharacter(db, { proficiencies: { spells: [
      { name: "Bless", source: "Cleric", classEntryId: "cleric" },
      { name: "Aid", source: "Cleric", classEntryId: "cleric" },
    ] } });
    const { spellStateRev } = (await call("GET", "/api/me/characters/char-ash")).body;
    const saved = await call("PUT", "/api/me/characters/char-ash", {
      expectedSpellStateRev: spellStateRev,
      characterData: { preparedSpells: ["aid"], classSpellSelections: { cleric: { preparedSpells: ["aid"] } } },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const data = storedData(db);
    assert.deepEqual(data.proficiencies.spells.filter((spell: { prepared?: boolean }) => spell.prepared).map((spell: { name: string }) => spell.name), ["Aid"]);
    assert.equal("preparedSpells" in data, false);
    assert.equal("preparedSpells" in data.classSpellSelections.cleric, false);
  });
});

test("an older tab still sending hit dice left has them stored as spent", async () => {
  await withServer(async (call, db) => {
    seedCharacter(db, { hd: 10, classes: [{ id: "f", classId: "c_fighter", className: "Fighter", level: 5 }] });
    const saved = await call("PUT", "/api/me/characters/char-ash", { characterData: { hitDiceCurrent: 3, hitDiceCurrentBySize: { "10": 3 } } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const data = storedData(db);
    assert.deepEqual(data.hitDiceSpent, { "10": 2 });
    assert.equal("hitDiceCurrent" in data || "hitDiceCurrentBySize" in data, false);
  });
});

test("a save or creation still sending live state or worked-out stats in the data puts them in their columns", async () => {
  await withServer(async (call, db) => {
    seedCharacter(db, {});
    const saved = await call("PUT", "/api/me/characters/char-ash", {
      syncedSpeed: 35,
      characterData: { sheetOverrides: { tempHp: 2, acBonus: 0, hpMaxBonus: 0 }, derivedHpMax: 31 },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const row = db.prepare("SELECT character_data_json AS data, live_json AS live, derived_hp_max AS hp, derived_speed AS speed FROM user_characters WHERE id = 'char-ash'").get() as
      { data: string; live: string; hp: number; speed: number };
    const data = JSON.parse(row.data);
    for (const key of ["sheetOverrides", "derivedHpMax", "derivedSpeed", "derivedAc"]) assert.equal(key in data, false, `${key} is not kept in the data`);
    assert.equal(JSON.parse(row.live).overrides.tempHp, 2);
    assert.deepEqual([row.hp, row.speed], [31, 35]);
  });
});

test("a character carries its worked-out maximum to whoever reads it", async () => {
  // The home list shows the maximum with feats and items in it. It used to read the copy in the
  // character's data; once that copy was removed the list fell back to the base maximum, because
  // the character the server sent did not carry the column.
  await withServer(async (call, db) => {
    seedCharacter(db, {});
    const saved = await call("PUT", "/api/me/characters/char-ash", { syncedHpMax: 31, syncedSpeed: 35 });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const one = await call("GET", "/api/me/characters/char-ash");
    assert.equal(one.body.sheet.derivedHpMax, 31);
    assert.equal(one.body.sheet.derivedSpeed, 35);
    const list = await call("GET", "/api/me/characters");
    assert.equal(list.body[0].sheet.derivedHpMax, 31);
  });
});

// MARK: - Older sheets still save

test("a sheet whose stored gender was capitalised still saves", async () => {
  // The identity check ran on the stored data, so an older character with "Male" rather than
  // "male" had every save refused - HP, inventory, notes and all - with no way to correct it.
  await withServer(async (call, db) => {
    seedCharacter(db, { gender: "Male", age: "24" });
    const saved = await call("PUT", "/api/me/characters/char-ash", { hpCurrent: 7 });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((db.prepare("SELECT hp_current AS hp FROM user_characters WHERE id = 'char-ash'").get() as { hp: number }).hp, 7);
  });
});

test("a sheet with no identity at all is still refused", async () => {
  await withServer(async (call, db) => {
    seedCharacter(db, { gender: null, age: null });
    const saved = await call("PUT", "/api/me/characters/char-ash", { hpCurrent: 7 });
    assert.equal(saved.status, 400);
  });
});

// MARK: - A character in no campaign

test("a character in no campaign keeps its conditions and inspiration", async () => {
  await withServer(async (call, db) => {
    seedCharacter(db, {});

    const set = await call("PATCH", "/api/me/characters/char-ash/conditions", { conditions: [{ key: "poisoned" }], previousConditions: [] });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    assert.equal((await call("PATCH", "/api/me/characters/char-ash/inspiration", { inspiration: true })).status, 200);

    const reloaded = (await call("GET", "/api/me/characters/char-ash")).body;
    assert.deepEqual(reloaded.live.conditions.map((condition: { key: string }) => condition.key), ["poisoned"]);
    assert.equal(reloaded.live.overrides?.inspiration, true);

    // A stale second tab is refused, as it is in a campaign.
    const stale = await call("PATCH", "/api/me/characters/char-ash/conditions", { conditions: [], previousConditions: [] });
    assert.equal(stale.status, 409);
  });
});

test("dropping to zero HP ends rage and every tracked form of concentration", async () => {
  await withServer(async (call, db) => {
    seedCharacter(db, { concentrationSpell: "Bless" });
    const set = await call("PATCH", "/api/me/characters/char-ash/conditions", {
      conditions: [{ key: "rage" }, { key: "concentration" }, { key: "poisoned" }],
      previousConditions: [],
    });
    assert.equal(set.status, 200, JSON.stringify(set.body));

    const dropped = await call("PUT", "/api/me/characters/char-ash", { hpCurrent: 0 });
    assert.equal(dropped.status, 200, JSON.stringify(dropped.body));
    assert.deepEqual(storedLive(db).conditions.map((condition: { key: string }) => condition.key), ["poisoned"]);
    assert.equal(storedData(db).concentrationSpell, null);
  });
});

test("one home: the sheet's live state is what every campaign shows, and leaving a campaign loses nothing", async () => {
  await withServer(async (call, db) => {
    seedCharacter(db, {});
    await call("PATCH", "/api/me/characters/char-ash/conditions", { conditions: [{ key: "poisoned" }], previousConditions: [] });
    await call("PATCH", "/api/me/characters/char-ash/inspiration", { inspiration: true });

    assert.equal((await call("POST", "/api/me/characters/char-ash/assign", { campaignIds: ["camp-1"] })).status, 200);
    const playerId = (db.prepare("SELECT id FROM players WHERE character_id = 'char-ash'").get() as { id: string }).id;
    // The campaign reads the character's own state; nothing was copied onto its row.
    const player = db.prepare("SELECT live_json AS j, hp_current AS hp FROM player_rows WHERE id = ?").get(playerId) as { j: string; hp: number };
    const live = JSON.parse(player.j);
    assert.deepEqual(live.conditions.map((condition: { key: string }) => condition.key), ["poisoned"]);
    assert.equal(live.overrides.inspiration, true);

    // The player's own change is seen by the campaign at once, without any copying.
    await call("PATCH", "/api/me/characters/char-ash/conditions", { conditions: [{ key: "prone" }], previousConditions: [{ key: "poisoned" }] });
    const after = JSON.parse((db.prepare("SELECT live_json AS j FROM player_rows WHERE id = ?").get(playerId) as { j: string }).j);
    assert.deepEqual(after.conditions.map((condition: { key: string }) => condition.key), ["prone"]);

    // Leaving the campaign changes nothing about the character.
    assert.equal((await call("POST", "/api/me/characters/char-ash/unassign", { campaignId: "camp-1" })).status, 200);
    const sheet = (await call("GET", "/api/me/characters/char-ash")).body;
    assert.deepEqual(sheet.live.conditions.map((condition: { key: string }) => condition.key), ["prone"]);
    assert.equal(sheet.live.overrides?.inspiration, true);
  });
});
