/**
 * HTTP-level regression coverage for the atomic character <-> party-stash transfer
 * endpoint (POST /api/campaigns/:campaignId/party-inventory/transfer).
 *
 * The endpoint replaces the old client pattern of a character save followed by a
 * separate party-inventory create/delete, which could duplicate the item (a
 * withdraw whose delete failed) or destroy it (a deposit whose create failed).
 * These tests exercise the real route against an in-memory SQLite DB and assert
 * that both sides of every transfer land together — and that a rejected transfer
 * leaves BOTH sides untouched.
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
import { rowToPartyInventoryItem } from "../lib/dbConverters.js";
import { toPartyInventoryItemDto } from "../lib/apiCollections.js";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { signToken } from "../lib/jwtAuth.js";
import { requireAuth } from "../middleware/auth.js";
import { zodErrorMiddleware } from "../lib/validate.js";
import { registerPartyInventoryRoutes } from "./partyInventory.js";
import { inventoryRevOf } from "./characters/helpers.js";
import type { ServerContext } from "../server/context.js";

type BroadcastEvent = { type: string; payload: Record<string, unknown> };

describe("party-stash transfer: atomic character <-> stash moves", () => {
  let db: Database.Database;
  let server: http.Server;
  let port: number;
  let broadcasts: BroadcastEvent[] = [];
  let seq = 0;

  const campaignId = "campaign-1";
  const otherCampaignId = "campaign-2";
  const playerUserId = "user-player";
  const strangerUserId = "user-stranger";
  const characterId = "character-1";
  const strangerCharacterId = "character-2";

  const playerToken = signToken({ userId: playerUserId, username: "player", isAdmin: false });
  const strangerToken = signToken({ userId: strangerUserId, username: "stranger", isAdmin: false });

  function request(
    method: string,
    url: string,
    body: unknown,
    token: string,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    if (body && typeof body === "object") {
      const input = body as Record<string, unknown>;
      const row = db.prepare("SELECT character_data_json FROM user_characters WHERE id = ?").get(input.characterId) as { character_data_json: string } | undefined;
      const stash = input.stash as { action: string; itemId?: string; expectedQuantity?: number };
      const item = stash?.itemId ? db.prepare("SELECT * FROM party_inventory WHERE id = ?").get(stash.itemId) as Record<string, unknown> | undefined : undefined;
      body = { expectedInventoryRev: inventoryRevOf(JSON.parse(row?.character_data_json ?? "{}")), ...input,
        stash: { expectedStashRev: item ? toPartyInventoryItemDto(rowToPartyInventoryItem(item)).meta.revision : "0".repeat(64), expectedQuantity: item?.quantity ?? 1, ...stash } };
    }
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: url,
          method,
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

  const transfer = (body: unknown, token = playerToken) =>
    request("POST", `/api/campaigns/${campaignId}/party-inventory/transfer`, body, token);

  function readInventory(charId = characterId): Array<{ id: string; name: string; quantity: number }> {
    const row = db.prepare("SELECT character_data_json FROM user_characters WHERE id = ?").get(charId) as
      | { character_data_json: string | null }
      | undefined;
    const data = JSON.parse(row?.character_data_json ?? "{}") as { inventory?: unknown };
    return Array.isArray(data.inventory) ? data.inventory as Array<{ id: string; name: string; quantity: number }> : [];
  }

  function stashRows(): Array<{ id: string; name: string; quantity: number }> {
    return db.prepare("SELECT id, name, quantity FROM party_inventory WHERE campaign_id = ? ORDER BY sort").all(campaignId) as
      Array<{ id: string; name: string; quantity: number }>;
  }

  before(async () => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    const t = Date.now();

    for (const id of [campaignId, otherCampaignId]) {
      db.prepare("INSERT INTO campaigns (id, name, ruleset, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, `Campaign ${id}`, "5e", t, t);
    }
    db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)")
      .run(playerUserId, "player", "x", "Player", t, t);
    db.prepare("INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)")
      .run(strangerUserId, "stranger", "x", "Stranger", t, t);

    // Both users are members of campaign-1; the player's character is linked there.
    db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, 'player', ?, ?)")
      .run("m1", campaignId, playerUserId, t, t);
    db.prepare("INSERT INTO campaign_membership (id, campaign_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, 'player', ?, ?)")
      .run("m2", campaignId, strangerUserId, t, t);

    db.prepare("INSERT INTO user_characters (id, user_id, name, hp_max, hp_current, character_data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(characterId, playerUserId, "Hero", 20, 20, "{}", t, t);
    db.prepare("INSERT INTO user_characters (id, user_id, name, hp_max, hp_current, character_data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(strangerCharacterId, strangerUserId, "Rando", 20, 20, "{}", t, t);

    db.prepare(`INSERT INTO players (id, campaign_id, user_id, character_id, player_name, character_name, hp_max, hp_current, ac, live_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run("player-1", campaignId, playerUserId, characterId, "Player", "Hero", 20, 20, 15, "{}", t, t);

    const upload = multer({ storage: multer.memoryStorage() });
    const ctx: ServerContext = {
      runtime: { appName: "test", host: "127.0.0.1", port: 0, dataDir: "" },
      paths: {
        dataDir: "", dbPath: ":memory:", webDistDir: "", hasWebDist: false,
        webPlayerDistDir: "", hasWebPlayerDist: false, repoRootDir: "",
      },
      os, fs, path, db,
      broadcast: (((type: string, payload: Record<string, unknown>) => {
        broadcasts.push({ type, payload });
      }) as unknown) as ServerContext["broadcast"],
      upload,
      compendiumUpload: upload,
      dbImportUpload: upload,
      helpers: {
        now: () => Date.now(),
        uid: () => `gen-${++seq}`,
        normalizeKey: (s: string) => s.toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, ""),
        parseLeadingInt: () => null,
        normalizeHp: (v: unknown) => v,
        ensureCombat: () => {},
        nextLabelNumber: () => 1,
        createPlayerCombatant: ((() => ({})) as unknown) as ServerContext["helpers"]["createPlayerCombatant"],
        seedDefaultConditions: () => {},
      },
    };

    const app = express();
    app.use(express.json());
    app.use("/api", requireAuth);
    registerPartyInventoryRoutes(app, ctx);
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
    broadcasts = [];
    const t = Date.now();
    db.prepare("DELETE FROM party_inventory").run();
    db.prepare("UPDATE user_characters SET character_data_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify({ inventory: [{ id: "i-rope", name: "Rope", quantity: 1 }], inventoryContainers: [] }), t, characterId);
  });

  it("deposit (create): item leaves the sheet and appears in the stash in one call", async () => {
    const { status, body } = await transfer({
      characterId,
      inventory: [],
      inventoryContainers: [],
      stash: { action: "create", item: { name: "Rope", quantity: 1, weight: 5 } },
    });

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(readInventory(), []);
    const rows = stashRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, "Rope");
    assert.equal((body.stashItem as { id: string } | null)?.id, rows[0]?.id);
    assert.ok(broadcasts.some((e) => e.type === "partyInventory:delta" && e.payload.action === "upsert"));
    assert.ok(broadcasts.some((e) => e.type === "players:delta" && e.payload.characterId === characterId));
  });

  it("withdraw (delete): stash row is consumed and the item lands on the sheet", async () => {
    db.prepare(`INSERT INTO party_inventory (id, campaign_id, name, quantity, weight, notes, sort, created_at, updated_at)
      VALUES ('s-torch', ?, 'Torch', 3, 1, '', 0, ?, ?)`).run(campaignId, Date.now(), Date.now());

    const { status, body } = await transfer({
      characterId,
      inventory: [
        { id: "i-rope", name: "Rope", quantity: 1 },
        { id: "i-torch", name: "Torch", quantity: 3 },
      ],
      inventoryContainers: [],
      stash: { action: "delete", itemId: "s-torch" },
    });

    assert.equal(status, 200);
    assert.equal(body.stashItem, null);
    assert.equal(stashRows().length, 0);
    assert.deepEqual(readInventory().map((i) => i.name).sort(), ["Rope", "Torch"]);
    assert.ok(broadcasts.some((e) => e.type === "partyInventory:delta" && e.payload.action === "delete"));
  });

  it("deposit (setQuantity): merges into an existing stack", async () => {
    db.prepare(`INSERT INTO party_inventory (id, campaign_id, name, quantity, weight, notes, sort, created_at, updated_at)
      VALUES ('s-arrows', ?, 'Arrows', 20, 0.05, '', 0, ?, ?)`).run(campaignId, Date.now(), Date.now());

    const { status } = await transfer({
      characterId,
      inventory: [],
      inventoryContainers: [],
      stash: { action: "setQuantity", itemId: "s-arrows", quantity: 40 },
    });

    assert.equal(status, 200);
    assert.equal(stashRows()[0]?.quantity, 40);
    assert.deepEqual(readInventory(), []);
  });

  it("rejects a stale stash reference (409) without touching the sheet", async () => {
    const before = readInventory();
    const { status, body } = await transfer({
      characterId,
      inventory: [],
      inventoryContainers: [],
      stash: { action: "delete", itemId: "does-not-exist" },
    });

    assert.equal(status, 409);
    assert.equal(body.ok, false);
    assert.deepEqual(readInventory(), before, "sheet inventory must be unchanged when the transfer is rejected");
    assert.equal(stashRows().length, 0);
  });

  it("rejects stale character inventory before either side is changed", async () => {
    const before = readInventory();
    const result = await transfer({ characterId, expectedInventoryRev: "old-revision", inventory: [], inventoryContainers: [],
      stash: { action: "create", item: { name: "Rope", quantity: 1 } } });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "stale-inventory");
    assert.deepEqual(readInventory(), before);
    assert.equal(stashRows().length, 0);
  });

  it("rejects a stale stack total or withdrawal without losing items", async () => {
    db.prepare(`INSERT INTO party_inventory (id, campaign_id, name, quantity, weight, notes, sort, created_at, updated_at)
      VALUES ('s-arrows', ?, 'Arrows', 40, 0.05, '', 0, 1, 1)`).run(campaignId);
    const before = readInventory();
    for (const action of ["setQuantity", "delete"]) {
      const result = await transfer({ characterId, inventory: [], inventoryContainers: [],
        stash: { action, itemId: "s-arrows", quantity: 60, expectedQuantity: 20 } });
      assert.equal(result.status, 409);
      assert.equal(stashRows()[0]?.quantity, 40);
      assert.deepEqual(readInventory(), before);
    }
  });

  it("rejects content edits even when stash quantity has not changed", async () => {
    db.prepare(`INSERT INTO party_inventory (id, campaign_id, name, quantity, notes, sort, created_at, updated_at)
      VALUES ('s-edited', ?, 'Wand', 1, 'old', 0, 1, 1)`).run(campaignId);
    const snapshot = await request("GET", `/api/campaigns/${campaignId}/party-inventory/s-edited`, undefined, playerToken);
    const expectedStashRev = (snapshot.body.meta as { revision: string }).revision;
    db.prepare("UPDATE party_inventory SET notes = 'new' WHERE id = 's-edited'").run();
    for (const action of ["delete", "setQuantity"]) {
      const result = await transfer({ characterId, inventory: [], inventoryContainers: [],
        stash: { action, itemId: "s-edited", quantity: 2, expectedQuantity: 1, expectedStashRev } });
      assert.equal(result.status, 409);
      assert.equal(result.body.code, "stale-stash");
      assert.equal((db.prepare("SELECT notes FROM party_inventory WHERE id = ?").get("s-edited") as { notes: string }).notes, "new");
      assert.equal(readInventory().length, 1);
    }
  });

  it("stores and returns the full transfer payload so customizations survive the round trip", async () => {
    const payload = {
      name: "Wand of Sparks", quantity: 1, notes: "half depleted after the ambush",
      dmg1: "1d8", dmgType: "lightning", chargesMax: 7, charges: 3,
      storedSpells: [{ spellId: "shocking-grasp", name: "Shocking Grasp", level: 0 }],
    };
    const deposit = await transfer({
      characterId,
      inventory: [],
      inventoryContainers: [],
      stash: { action: "create", item: { name: "Wand of Sparks", quantity: 1, notes: "half depleted after the ambush", payload } },
    });
    assert.equal(deposit.status, 200);
    const stashItem = deposit.body.stashItem as { id: string; item: { payload?: Record<string, unknown> } };
    assert.deepEqual(stashItem.item.payload, payload);

    const stored = db.prepare("SELECT payload_json FROM party_inventory WHERE id = ?").get(stashItem.id) as { payload_json: string | null };
    assert.deepEqual(JSON.parse(stored.payload_json ?? "null"), payload);
  });

  it("rejects a payload larger than the 32KB cap", async () => {
    const huge = { name: "Bag", quantity: 1, blob: "x".repeat(33_000) };
    const { status } = await transfer({
      characterId,
      inventory: [],
      inventoryContainers: [],
      stash: { action: "create", item: { name: "Bag", quantity: 1, payload: huge } },
    });
    assert.equal(status, 400);
    assert.equal(stashRows().length, 0);
  });

  it("rejects a deposit for a character the caller does not own (404), writing nothing", async () => {
    const { status } = await transfer({
      characterId: strangerCharacterId,
      inventory: [],
      inventoryContainers: [],
      stash: { action: "create", item: { name: "Rope", quantity: 1 } },
    });

    assert.equal(status, 404);
    assert.equal(stashRows().length, 0);
    assert.deepEqual(readInventory(strangerCharacterId), []);
  });

  it("rejects a transfer into a campaign the character is not in (403)", async () => {
    // stranger owns their character and is a member of campaign-1, but that
    // character has no players row there.
    const { status, body } = await request(
      "POST",
      `/api/campaigns/${campaignId}/party-inventory/transfer`,
      {
        characterId: strangerCharacterId,
        inventory: [],
        inventoryContainers: [],
        stash: { action: "create", item: { name: "Rope", quantity: 1 } },
      },
      strangerToken,
    );

    assert.equal(status, 403);
    assert.equal(body.ok, false);
    assert.equal(stashRows().length, 0);
  });

  it("rejects a non-member of the campaign (403)", async () => {
    db.prepare("DELETE FROM campaign_membership WHERE user_id = ? AND campaign_id = ?").run(strangerUserId, otherCampaignId);
    const { status } = await request(
      "POST",
      `/api/campaigns/${otherCampaignId}/party-inventory/transfer`,
      {
        characterId,
        inventory: [],
        inventoryContainers: [],
        stash: { action: "create", item: { name: "Rope", quantity: 1 } },
      },
      playerToken,
    );
    assert.equal(status, 403);
  });
});
