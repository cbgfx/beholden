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
      upload, compendiumUpload: upload, dbImportUpload: upload,
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

  it("still accepts an inventory PUT from an older client that sends no expectedInventoryRev", async () => {
    const legacy = await putChar({ characterData: { inventory: [{ id: "i1", name: "Rope" }, { id: "i2", name: "Torch" }] } });
    assert.equal(legacy.status, 200);
    assert.deepEqual(storedInventoryNames(), ["Rope", "Torch"]);
  });
});
