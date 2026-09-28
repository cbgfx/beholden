/**
 * HTTP-level regression coverage for optimistic-concurrency on character inventory saves
 * (PUT /api/me/characters/:id + the `inventoryRev` / `expectedInventoryRev` handshake).
 *
 * `characterData.inventory` is written wholesale by several actors — the player's own
 * inventory panel and combat actions, and a DM's treasure award. Without a guard, two
 * near-simultaneous writers silently overwrite each other. These tests confirm the server
 * hands out a revision, echoes a fresh one on every write, and rejects (409) an inventory
 * PUT whose `expectedInventoryRev` no longer matches the stored inventory.
 */
import assert from "node:assert/strict";
import { describe, it, before, after, beforeEach } from "node:test";
import http from "node:http";
import net from "node:net";
import express from "express";
import Database from "better-sqlite3";
import multer from "multer";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { signToken } from "../../lib/jwtAuth.js";
import { requireAuth } from "../../middleware/auth.js";
import { zodErrorMiddleware } from "../../lib/validate.js";
import { registerCharacterRoutes } from "./core.js";
import { ensureCharacterCreationTokenColumn } from "../../lib/migrations/characterCreationTokenMigration.js";
import type { ServerContext } from "../../server/context.js";

describe("character inventory saves: optimistic concurrency (inventoryRev)", () => {
  let db: Database.Database;
  let server: http.Server;
  let port: number;
  let seq = 0;

  const userId = "user-1";
  const characterId = "character-1";
  const token = signToken({ userId, username: "player", isAdmin: false });

  function request(method: string, url: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          hostname: "127.0.0.1", port, path: url, method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk; });
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) as Record<string, unknown> });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: data as unknown as Record<string, unknown> });
            }
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  const getChar = () => request("GET", `/api/me/characters/${characterId}`, undefined);
  const putChar = (body: unknown) => request("PUT", `/api/me/characters/${characterId}`, body);

  function storedInventoryNames(): string[] {
    const row = db.prepare("SELECT character_data_json FROM user_characters WHERE id = ?").get(characterId) as
      | { character_data_json: string | null } | undefined;
    const data = JSON.parse(row?.character_data_json ?? "{}") as { inventory?: Array<{ name?: string }> };
    return Array.isArray(data.inventory) ? data.inventory.map((i) => String(i.name)) : [];
  }

  before(async () => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    const t = Date.now();
    db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)")
      .run(userId, "player", "x", "Player", t, t);

    const upload = multer({ storage: multer.memoryStorage() });
    const ctx: ServerContext = {
      runtime: { appName: "test", host: "127.0.0.1", port: 0, dataDir: "" },
      paths: {
        dataDir: "", dbPath: ":memory:", webDistDir: "", hasWebDist: false,
        webPlayerDistDir: "", hasWebPlayerDist: false, repoRootDir: "",
      },
      os, fs, path, db,
      broadcast: (() => {}) as unknown as ServerContext["broadcast"],
      upload, imageUpload: upload, compendiumUpload: upload, dbImportUpload: upload,
      helpers: {
        now: () => Date.now() + (++seq),
        uid: () => `gen-${++seq}`,
        normalizeKey: (s: string) => s.toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, ""),
        parseLeadingInt: () => null,
        normalizeHp: (v: unknown) => v,
        ensureCombat: () => {},
        nextLabelNumber: () => 1,
        createPlayerCombatant: (() => ({})) as unknown as ServerContext["helpers"]["createPlayerCombatant"],
        seedDefaultConditions: () => {},
      },
    };

    const app = express();
    app.use(express.json());
    app.use("/api", requireAuth);
    registerCharacterRoutes(app, ctx);
    app.use(zodErrorMiddleware);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    db.close();
  });

  beforeEach(() => {
    const t = Date.now();
    db.prepare(`INSERT OR REPLACE INTO user_characters
      (id, user_id, name, ruleset, hp_max, hp_current, character_data_json, created_at, updated_at)
      VALUES (?, ?, ?, '5e', 20, 20, ?, ?, ?)`)
      .run(characterId, userId, "Hero",
        JSON.stringify({ age: 20, gender: "male", inventory: [{ id: "i1", name: "Rope" }], inventoryContainers: [] }),
        t, t);
  });

  it("upgrades existing character tables with an idempotent creation-token constraint", () => {
    const legacy = new Database(":memory:");
    try {
      legacy.exec("CREATE TABLE user_characters (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)");
      ensureCharacterCreationTokenColumn(legacy);
      ensureCharacterCreationTokenColumn(legacy);
      legacy.prepare("INSERT INTO user_characters (id, user_id, creation_token) VALUES ('a', 'u', 'token')").run();
      assert.throws(() => legacy.prepare("INSERT INTO user_characters (id, user_id, creation_token) VALUES ('b', 'u', 'token')").run());
    } finally {
      legacy.close();
    }
  });

  it("returns the original character when a creation token is retried", async () => {
    const body = {
      creationToken: "creator-request-0001",
      name: "Idempotent Hero",
      ruleset: "5.5e",
      level: 1,
      characterData: { age: 30, gender: "male" },
    };
    const first = await request("POST", "/api/me/characters", body);
    const retry = await request("POST", "/api/me/characters", body);
    assert.equal(first.status, 200);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.id, first.body.id);
    const count = db.prepare("SELECT COUNT(*) AS count FROM user_characters WHERE user_id = ? AND creation_token = ?")
      .get(userId, body.creationToken) as { count: number };
    assert.equal(count.count, 1);
  });

  it("restores portable live state when creating a character from an export", async () => {
    const created = await request("POST", "/api/me/characters", {
      name: "Imported Hero",
      ruleset: "5e",
      hpMax: 24,
      hpCurrent: 9,
      characterData: { age: 30, gender: "male" },
      conditions: [{ key: "Poisoned" }],
      overrides: { tempHp: 6, acBonus: 2, hpMaxBonus: 3, inspiration: true },
      deathSaves: { success: 2, fail: 1 },
      sharedNotes: "Remember the silver key.",
      isActive: false,
    });

    assert.equal(created.status, 200);
    const row = db.prepare(`SELECT live_json, death_saves_success, death_saves_fail, shared_notes, is_active
      FROM user_characters WHERE id = ?`).get(created.body.id) as Record<string, unknown>;
    const live = JSON.parse(String(row.live_json)) as Record<string, unknown>;
    assert.deepEqual(live.conditions, [{ key: "poisoned" }]);
    assert.deepEqual(live.overrides, { tempHp: 6, acBonus: 2, hpMaxBonus: 3, inspiration: true });
    assert.equal(row.death_saves_success, 2);
    assert.equal(row.death_saves_fail, 1);
    assert.equal(row.shared_notes, "Remember the silver key.");
    assert.equal(row.is_active, 0);
  });

  it("GET returns an inventoryRev and PUT echoes a fresh one", async () => {
    const initial = await getChar();
    assert.equal(initial.status, 200);
    assert.equal(typeof initial.body.inventoryRev, "string");

    const saved = await putChar({
      characterData: { inventory: [{ id: "i1", name: "Rope" }, { id: "i2", name: "Torch" }] },
      expectedInventoryRev: initial.body.inventoryRev,
    });
    assert.equal(saved.status, 200);
    assert.equal(typeof saved.body.inventoryRev, "string");
    assert.notEqual(saved.body.inventoryRev, initial.body.inventoryRev, "rev advances when inventory changes");
    assert.deepEqual(storedInventoryNames(), ["Rope", "Torch"]);
  });

  it("rejects an inventory PUT whose expectedInventoryRev is stale, leaving the sheet untouched", async () => {
    const { body: { inventoryRev: staleRev } } = await getChar();

    // Another writer (second device / DM award) changes the stored inventory.
    await putChar({
      characterData: { inventory: [{ id: "i1", name: "Rope" }, { id: "i3", name: "Lantern" }] },
      expectedInventoryRev: staleRev,
    });

    const conflict = await putChar({
      characterData: { inventory: [{ id: "i1", name: "Rope" }, { id: "i2", name: "Torch" }] },
      expectedInventoryRev: staleRev,
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, "stale-inventory");
    assert.deepEqual(storedInventoryNames(), ["Rope", "Lantern"], "the losing write must not touch the sheet");
  });

  it("preserves the winning state across stale delete, move, quantity, charge, and currency edits", async () => {
    const losingEdits = [
      [],
      [{ id: "i1", name: "Rope", quantity: 1, containerId: "pack" }],
      [{ id: "i1", name: "Rope", quantity: 2 }],
      [{ id: "i1", name: "Rope", quantity: 1, charges: 1, chargesMax: 3 }],
      [{ id: "i1", name: "Rope", quantity: 1 }, { id: "gp", name: "GP", quantity: 50 }],
    ];
    for (const [index, inventory] of losingEdits.entries()) {
      const opened = await getChar();
      const staleRev = opened.body.inventoryRev as string;
      const winnerName = `Winner ${index}`;
      const winner = await putChar({
        expectedInventoryRev: staleRev,
        characterData: {
          inventory: [{ id: `winner-${index}`, name: winnerName, quantity: 1 }],
          inventoryContainers: [{ id: "pack", name: "Pack" }],
        },
      });
      assert.equal(winner.status, 200);
      const losing = await putChar({
        expectedInventoryRev: staleRev,
        characterData: { inventory, inventoryContainers: [{ id: "pack", name: "Pack" }] },
      });
      assert.equal(losing.status, 409);
      assert.equal(losing.body.code, "stale-inventory");
      assert.deepEqual(storedInventoryNames(), [winnerName]);
    }
  });

  it("requires spell-state revision and rejects a stale slot-map replacement", async () => {
    const opened = await getChar();
    const spellStateRev = opened.body.spellStateRev as string;
    assert.equal(typeof spellStateRev, "string");

    const missing = await putChar({ characterData: { usedSpellSlots: { "1": 1 } } });
    assert.equal(missing.status, 428);
    assert.equal(missing.body.code, "spell-state-revision-required");

    const winner = await putChar({
      expectedSpellStateRev: spellStateRev,
      characterData: { usedSpellSlots: { "1": 1 } },
    });
    assert.equal(winner.status, 200);
    assert.notEqual(winner.body.spellStateRev, spellStateRev);

    const stale = await putChar({
      expectedSpellStateRev: spellStateRev,
      characterData: { usedSpellSlots: { "1": 2 } },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "stale-spell-state");
    const stored = JSON.parse(db.prepare("SELECT character_data_json FROM user_characters WHERE id = ?").pluck().get(characterId) as string);
    assert.deepEqual(stored.usedSpellSlots, { "1": 1 });
  });

  it("requires and enforces a whole-character revision for progression transitions", async () => {
    const opened = await getChar();
    const revision = Number(opened.body.updatedAt);
    const missing = await putChar({
      progressionClassEntryId: "fighter",
      level: 2,
      characterData: { classes: [{ id: "fighter", classId: "fighter", className: "Fighter", level: 2 }] },
    });
    assert.equal(missing.status, 428);
    assert.equal(missing.body.code, "character-revision-required");

    db.prepare("UPDATE user_characters SET hp_current = 17, updated_at = ? WHERE id = ?").run(revision + 100, characterId);
    const stale = await putChar({
      progressionClassEntryId: "fighter",
      expectedCharacterRevision: revision,
      level: 2,
      characterData: { classes: [{ id: "fighter", classId: "fighter", className: "Fighter", level: 2 }] },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "stale-character");
    const stored = db.prepare("SELECT level, hp_current FROM user_characters WHERE id = ?").get(characterId) as { level: number; hp_current: number };
    assert.deepEqual(stored, { level: 1, hp_current: 17 });
  });

  it("simulates a DM treasure award (direct character_data_json write) then blocks the stale player save", async () => {
    const { body: { inventoryRev: playerRev } } = await getChar();

    const row = db.prepare("SELECT character_data_json FROM user_characters WHERE id = ?").get(characterId) as { character_data_json: string };
    const data = JSON.parse(row.character_data_json) as Record<string, unknown>;
    (data.inventory as Array<Record<string, unknown>>).push({ id: "award", name: "Sunblade" });
    db.prepare("UPDATE user_characters SET character_data_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(data), Date.now(), characterId);

    const stale = await putChar({
      characterData: { inventory: [{ id: "i1", name: "Rope" }, { id: "i2", name: "Torch" }] },
      expectedInventoryRev: playerRev,
    });
    assert.equal(stale.status, 409);
    assert.ok(storedInventoryNames().includes("Sunblade"), "the awarded item survives");
  });

  it("does not guard a PUT that carries a stale rev but no inventory fields", async () => {
    const { body: { inventoryRev: staleRev } } = await getChar();
    await putChar({ characterData: { inventory: [{ id: "i1", name: "Rope" }, { id: "i9", name: "Bedroll" }] }, expectedInventoryRev: staleRev });

    const hpOnly = await putChar({ hpCurrent: 12, expectedInventoryRev: staleRev });
    assert.equal(hpOnly.status, 200, "a non-inventory PUT is unaffected by a stale inventory rev");
  });

  it("rejects an inventory PUT with no expectedInventoryRev, leaving the sheet untouched", async () => {
    const unguarded = await putChar({ characterData: { inventory: [{ id: "i1", name: "Rope" }, { id: "i2", name: "Torch" }] } });
    assert.equal(unguarded.status, 428);
    assert.equal(unguarded.body.code, "inventory-revision-required");
    assert.deepEqual(storedInventoryNames(), ["Rope"]);
  });

  it("also requires the revision when replacing inventory containers", async () => {
    const unguarded = await putChar({ characterData: { inventoryContainers: [{ id: "pack", name: "Pack" }] } });
    assert.equal(unguarded.status, 428);
    assert.equal(unguarded.body.code, "inventory-revision-required");
  });

  it("rejects structurally invalid inventory without changing the stored sheet", async () => {
    const { body: { inventoryRev } } = await getChar();
    const invalid = await putChar({
      expectedInventoryRev: inventoryRev,
      characterData: { inventory: [{ id: "i1", name: "Rope", quantity: 0 }] },
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid-inventory");
    assert.deepEqual(storedInventoryNames(), ["Rope"]);
  });
  it("rejects over-level creation before normalization or insertion", async () => {
    const before = db.prepare("SELECT COUNT(*) AS count FROM user_characters").get();
    const response = await request("POST", "/api/me/characters", {
      name: "Invalid", ruleset: "5.5e", level: 20,
      characterData: { age: 20, gender: "male", classes: [
        { id: "fighter", classId: "c_fighter", level: 20 },
        { id: "wizard", classId: "c_wizard", level: 1 },
      ] },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "invalid-progression");
    assert.deepEqual(db.prepare("SELECT COUNT(*) AS count FROM user_characters").get(), before);
  });

  it("rejects malformed progression without changing HP or stored data", async () => {
    const before = db.prepare("SELECT * FROM user_characters WHERE id = ?").get(characterId);
    for (const classes of [
      [{ classId: "c_fighter", level: 2.5 }],
      [{ classId: "c_fighter", level: 0 }],
      [{ classId: "c_fighter", level: "4" }],
      [{ classId: "c_fighter", level: 2 }, { classId: "c_fighter", level: 2 }],
      [{ id: "same", classId: "c_fighter", level: 2 }, { id: "same", classId: "c_wizard", level: 2 }],
    ]) {
      const response = await putChar({ hpMax: 99, level: 4, characterData: { classes } });
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "invalid-progression");
      assert.deepEqual(db.prepare("SELECT * FROM user_characters WHERE id = ?").get(characterId), before);
    }
  });

  it("rejects a declared total that disagrees with the class records", async () => {
    const response = await putChar({ level: 8, characterData: { classes: [{ classId: "c_cleric", level: 7 }] } });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "invalid-progression");
  });

  it("rejects HP history that does not reconcile with the resulting sheet", async () => {
    const before = db.prepare("SELECT hp_max, character_data_json FROM user_characters WHERE id = ?").get(characterId);
    const response = await putChar({
      level: 2, hpMax: 30,
      characterData: {
        classes: [{ id: "fighter", classId: "c_fighter", level: 2 }],
        hpProgressionHistory: [{
          characterLevelBefore: 0, characterLevelAfter: 2, classEntryId: "fighter", classLevelAfter: 2,
          baseHpMaxBefore: 0, baseHpMaxAfter: 20, levelHpGain: 20, hpMethod: "manual", hitDieResult: null,
          constitutionBefore: 10, constitutionAfter: 10, constitutionHpAdjustment: 0,
        }],
      },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "invalid-hp-progression");
    assert.deepEqual(db.prepare("SELECT hp_max, character_data_json FROM user_characters WHERE id = ?").get(characterId), before);
  });

  it("accepts valid multiclass advancement and reduction", async () => {
    for (const fighterLevel of [4, 3]) {
      const response = await putChar({ level: fighterLevel + 1, characterData: { classes: [
        { id: "fighter", classId: "c_fighter", level: fighterLevel },
        { id: "wizard", classId: "c_wizard", level: 1 },
      ] } });
      assert.equal(response.status, 200);
      assert.equal((db.prepare("SELECT level FROM user_characters WHERE id = ?").get(characterId) as { level: number }).level, fighterLevel + 1);
    }
  });

  it("derives an omitted total and preserves permanent proficiencies on advancement", async () => {
    await putChar({ level: 1, characterData: { classes: [{ classId: "c_cleric", level: 1 }],
      proficiencies: { skills: [{ name: "Religion", source: "Cleric" }] } } });
    const response = await putChar({ characterData: { classes: [{ classId: "c_cleric", level: 2 }],
      proficiencies: { skills: [] } } });
    assert.equal(response.status, 200);
    const stored = db.prepare("SELECT level, character_data_json FROM user_characters WHERE id = ?").get(characterId) as { level: number; character_data_json: string };
    assert.equal(stored.level, 2);
    const data = JSON.parse(stored.character_data_json) as { proficiencies: { skills: Array<{ name: string }> } };
    assert.equal(data.proficiencies.skills.some((entry) => entry.name === "Religion"), true);
  });

  it("keeps unrelated edits possible for a legacy character without class records", async () => {
    const response = await putChar({ color: "#123456" });
    assert.equal(response.status, 200);
    assert.equal((db.prepare("SELECT color FROM user_characters WHERE id = ?").get(characterId) as { color: string }).color, "#123456");
  });

});
