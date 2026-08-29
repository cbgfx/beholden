/**
 * HTTP-level regression coverage for combat state transitions and live synchronization.
 *
 * Complements the pure-function unit tests in `services/combatTransitions.test.ts` by exercising
 * the actual routes (DM combatant PUT, player-owned conditions PATCH) end-to-end against a real
 * Express app + in-memory SQLite DB, confirming the transition layer is correctly wired into both
 * paths and that broadcasts carry the state a listening client needs.
 */
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
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
import { registerCombatRoutes } from "./core.js";
import { registerCharacterRoutes } from "../characters/core.js";
import { insertCombatant, createPlayerCombatant } from "../../services/combat.js";
import { CAMPAIGN_CHARACTER_COLS, rowToCampaignCharacter } from "../../lib/db.js";
import type { ServerContext } from "../../server/context.js";
import type { StoredEncounterActor } from "../../server/userData.js";

type BroadcastEvent = { type: string; payload: Record<string, unknown> };
type ConditionEntry = { key: string; casterId?: string | null; concentrationId?: string | null };

describe("combat state regression: HP/condition mutation, transitions, and live sync", () => {
  let db: Database.Database;
  let server: http.Server;
  let port: number;
  let broadcasts: BroadcastEvent[] = [];

  let campaignId: string;
  let encounterId: string;
  let monsterCombatantId: string;
  let monster2CombatantId: string;
  let playerCombatantId: string;
  let playerRowId: string;
  let playerCharacterId: string;
  const playerUserId = "test-player-user";

  const dmToken = signToken({ userId: "test-dm", username: "dm", isAdmin: true });
  let playerToken: string;

  function request(
    method: string,
    url: string,
    body: unknown,
    token: string,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
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
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
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

  const dmRequest = (method: string, url: string, body?: unknown) => request(method, url, body, dmToken);

  before(async () => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);

    const t = Date.now();
    campaignId = "campaign-1";
    db.prepare(`INSERT INTO campaigns (id, name, ruleset, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(campaignId, "Test Campaign", "5e", t, t);
    const adventureId = "adventure-1";
    db.prepare(`INSERT INTO adventures (id, campaign_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(adventureId, campaignId, "Test Adventure", t, t);
    encounterId = "encounter-1";
    db.prepare(`INSERT INTO encounters (id, campaign_id, adventure_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(encounterId, campaignId, adventureId, "Test Encounter", t, t);

    db.prepare(`
      INSERT INTO compendium_monsters
        (id, ruleset, name, name_key, cr, data_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "m_red_slaad",
      "5.5e",
      "Red Slaad",
      "red slaad",
      "5",
      JSON.stringify({
        id: "m_red_slaad",
        ruleset: "5.5e",
        name: "Red Slaad",
        armorClass: { value: 14 },
        hitPoints: { formula: "11d10+33" },
      }),
    );

    db.prepare(`INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`)
      .run(playerUserId, "playeruser", "x", "Player User", t, t);
    playerCharacterId = "character-1";
    db.prepare(`
      INSERT INTO user_characters (id, user_id, name, hp_max, hp_current, character_data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(playerCharacterId, playerUserId, "Hero", 20, 20, '{"age":20,"gender":"male"}', t, t);
    playerRowId = "player-1";
    db.prepare(`
      INSERT INTO players
        (id, campaign_id, user_id, character_id, player_name, character_name, hp_max, hp_current, ac, live_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(playerRowId, campaignId, playerUserId, playerCharacterId, "Player User", "Hero", 20, 20, 15, "{}", t, t);

    playerToken = signToken({ userId: playerUserId, username: "playeruser", isAdmin: false });

    const playerRow = db.prepare(`SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?`).get(playerRowId) as Record<string, unknown>;
    const playerChar = rowToCampaignCharacter(playerRow);
    const playerCombatant = createPlayerCombatant({ encounterId, player: playerChar, t });
    playerCombatantId = playerCombatant.id;
    insertCombatant(db, playerCombatant);

    const monsterCombatant: StoredEncounterActor = {
      id: "combatant-monster-1",
      encounterId,
      baseType: "monster",
      baseId: "monster-1",
      name: "Goblin",
      label: "Goblin",
      initiative: 5,
      friendly: false,
      color: "red",
      overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
      hpCurrent: 7,
      hpMax: 7,
      hpDetails: null,
      ac: 13,
      acDetails: null,
      attackOverrides: null,
      conditions: [],
      createdAt: t,
      updatedAt: t,
    };
    monsterCombatantId = monsterCombatant.id;
    insertCombatant(db, monsterCombatant);

    const monster2Combatant: StoredEncounterActor = {
      id: "combatant-monster-2",
      encounterId,
      baseType: "monster",
      baseId: "monster-2",
      name: "Orc",
      label: "Orc",
      initiative: 3,
      friendly: false,
      color: "red",
      overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
      hpCurrent: 15,
      hpMax: 15,
      hpDetails: null,
      ac: 12,
      acDetails: null,
      attackOverrides: null,
      conditions: [],
      createdAt: t,
      updatedAt: t,
    };
    monster2CombatantId = monster2Combatant.id;
    insertCombatant(db, monster2Combatant);

    const upload = multer({ storage: multer.memoryStorage() });
    const ctx: ServerContext = {
      runtime: { appName: "test", host: "127.0.0.1", port: 0, dataDir: "" },
      paths: {
        dataDir: "",
        dbPath: ":memory:",
        webDistDir: "",
        hasWebDist: false,
        webPlayerDistDir: "",
        hasWebPlayerDist: false,
        repoRootDir: "",
      },
      os,
      fs,
      path,
      db,
      broadcast: (((type: string, payload: Record<string, unknown>) => {
        broadcasts.push({ type, payload });
      }) as unknown) as ServerContext["broadcast"],
      upload,
      compendiumUpload: upload,
      dbImportUpload: upload,
      helpers: {
        now: () => Date.now(),
        uid: () => Math.random().toString(36).slice(2),
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
    registerCombatRoutes(app, ctx);
    registerCharacterRoutes(app, ctx);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    db.close();
  });

  // toEncounterActorDto() nests mutable combat state under `live` (see server/src/lib/apiActors.ts).
  function liveOf(dto: Record<string, unknown>): { hpCurrent?: number; conditions?: ConditionEntry[]; usedReaction?: boolean } {
    return (dto.live ?? {}) as { hpCurrent?: number; conditions?: ConditionEntry[]; usedReaction?: boolean };
  }

  describe("cross-ruleset monster additions", () => {
    it("adds the sole available 5.5e monster to a 5e campaign when an older client omits ruleset", async () => {
      const { status, body } = await dmRequest(
        "POST",
        `/api/encounters/${encounterId}/combatants/addMonster`,
        { monsterId: "m_red_slaad", qty: 1 },
      );

      assert.equal(status, 200);
      const created = body.created as Array<Record<string, unknown>>;
      assert.equal(created.length, 1);
      assert.equal(created[0]?.baseId, "m_red_slaad");
      assert.equal(created[0]?.baseRuleset, "5.5e");
      assert.equal(created[0]?.hpMax, 93);
      assert.equal(created[0]?.ac, 14);
    });
  });

  describe("character-data persistence", () => {
    it("preserves player notes during a rest-style partial characterData update", async () => {
      const notes = [{ id: "note-1", title: "Campaign clue", text: "Do not lose this." }];
      db.prepare("UPDATE user_characters SET character_data_json = ? WHERE id = ?")
        .run(JSON.stringify({ age: 20, gender: "male", playerNotesList: notes, concentrationSpell: "Hex" }), playerCharacterId);

      const { status } = await request(
        "PUT",
        `/api/me/characters/${playerCharacterId}`,
        { characterData: { resources: [], concentrationSpell: null } },
        playerToken,
      );
      assert.equal(status, 200);

      const row = db.prepare("SELECT character_data_json FROM user_characters WHERE id = ?")
        .get(playerCharacterId) as { character_data_json: string };
      const stored = JSON.parse(row.character_data_json) as Record<string, unknown>;
      assert.deepEqual(stored.playerNotesList, notes);
      assert.equal(stored.concentrationSpell, null);
    });
  });

  describe("behaviors 1 & 2 — HP/condition mutation returns and broadcasts updated state", () => {
    it("returns and broadcasts the updated HP", async () => {
      broadcasts.length = 0;
      const { status, body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, { hpCurrent: 4 },
      );
      assert.equal(status, 200);
      assert.equal(liveOf(body).hpCurrent, 4);
      const delta = broadcasts.find((b) => b.type === "encounter:combatantsDelta");
      assert.ok(delta, "expected an encounter:combatantsDelta broadcast");
      assert.equal(liveOf(delta!.payload.combatant as Record<string, unknown>).hpCurrent, 4);
    });

    it("returns and broadcasts updated conditions", async () => {
      broadcasts.length = 0;
      const { status, body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { hpCurrent: 5, conditions: [{ key: "prone" }] },
      );
      assert.equal(status, 200);
      assert.deepEqual(liveOf(body).conditions, [{ key: "prone" }]);
      const delta = broadcasts.find((b) => b.type === "encounter:combatantsDelta");
      assert.deepEqual(liveOf(delta!.payload.combatant as Record<string, unknown>).conditions, [{ key: "prone" }]);
    });
  });

  describe("behaviors 3-6 — transition rules wired into the real route (not just the pure function)", () => {
    it("reaching 0 HP removes Concentration", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { hpCurrent: 5, conditions: [{ key: "concentration" }] },
      );
      const { body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, { hpCurrent: 0 },
      );
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "concentration"));
    });

    for (const key of ["incapacitated", "paralyzed", "petrified", "stunned", "unconscious"]) {
      it(`applying ${key} removes Concentration`, async () => {
        await dmRequest(
          "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
          { hpCurrent: 5, conditions: [{ key: "concentration" }] },
        );
        const { body } = await dmRequest(
          "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
          { conditions: [{ key: "concentration" }, { key }] },
        );
        const conditions = liveOf(body).conditions ?? [];
        assert.ok(!conditions.some((c) => c.key === "concentration"), `${key} should remove concentration`);
      });
    }

    it("applying Unconscious also applies Prone", async () => {
      const { body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { hpCurrent: 5, conditions: [{ key: "unconscious" }] },
      );
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(conditions.some((c) => c.key === "unconscious"));
      assert.ok(conditions.some((c) => c.key === "prone"));
    });

    it("healing above 0 removes Unconscious but preserves Prone", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { hpCurrent: 0, conditions: [{ key: "unconscious" }, { key: "prone" }] },
      );
      const { body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, { hpCurrent: 5 },
      );
      assert.deepEqual(liveOf(body).conditions, [{ key: "prone" }]);
    });
  });

  describe("player-type combatant sync", () => {
    it("PUT on a player combatant syncs HP back to the players table", async () => {
      const { status } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, { hpCurrent: 12 },
      );
      assert.equal(status, 200);
      const row = db.prepare("SELECT hp_current FROM players WHERE id = ?").get(playerRowId) as { hp_current: number };
      assert.equal(row.hp_current, 12);
    });
  });

  describe("behavior 11 — broadcast sufficiency for an already-open DM combat view", () => {
    it("DM-originated PUT broadcasts a full combatant DTO inline (no follow-up fetch needed)", async () => {
      broadcasts.length = 0;
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, { hpCurrent: 3 },
      );
      const delta = broadcasts.find((b) => b.type === "encounter:combatantsDelta");
      assert.ok(delta, "expected an encounter:combatantsDelta broadcast");
      assert.ok(delta!.payload.combatant, "DM path should inline the full combatant DTO");
    });

    it(
      "player-originated condition PATCH also broadcasts a full combatant DTO inline, matching the DM path",
      async () => {
        broadcasts.length = 0;
        const { status } = await request(
          "PATCH", `/api/me/characters/${playerCharacterId}/conditions`,
          { conditions: [{ key: "prone" }] }, playerToken,
        );
        assert.equal(status, 200);
        const delta = broadcasts.find((b) => b.type === "encounter:combatantsDelta");
        assert.ok(delta, "expected an encounter:combatantsDelta broadcast for the linked combatant");
        assert.ok(delta!.payload.combatant, "player-originated broadcast should inline the full combatant DTO");
        assert.deepEqual(liveOf(delta!.payload.combatant as Record<string, unknown>).conditions, [{ key: "prone" }]);
      },
    );
  });

  // As of this writing, expiry is wired into the PUT /combatState route (server/src/routes/combat.ts,
  // via combatTransitions.ts's expireConditionsAtRound) — landed concurrently with this test file, so
  // this locks the real behavior in rather than documenting a gap.
  describe("behavior 10 — timed condition expiry on round progression", () => {
    it("keeps a condition whose expiresAtRound hasn't been reached yet", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "prone", expiresAtRound: 3 }] },
      );
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { round: 2 });
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(conditions.some((c) => c.key === "prone"), "condition should still be active before its expiry round");
    });

    it("removes a condition once the persisted round reaches its expiresAtRound", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "prone", expiresAtRound: 3 }] },
      );
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { round: 3 });
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "prone"), "expired condition should have been removed");
    });
  });

  describe("behavior 9 — server-authoritative reaction reset when a combatant's turn starts", () => {
    it("resets usedReaction to false for the incoming active combatant", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [], usedReaction: true },
      );
      // Make sure the "active combatant" is genuinely changing (a same-id PUT is a no-op).
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { activeCombatantId: playerCombatantId });
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { activeCombatantId: monsterCombatantId });
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      assert.equal(liveOf(body).usedReaction, false);
    });

    it("does not free the reaction of an incapacitated combatant even when their turn starts", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "stunned" }], usedReaction: true },
      );
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { activeCombatantId: playerCombatantId });
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { activeCombatantId: monsterCombatantId });
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      assert.equal(liveOf(body).usedReaction, true, "an incapacitated combatant can't take reactions regardless of whose turn it is");
    });
  });

  describe("concentration ownership — sweeping dependent conditions when a caster loses concentration", () => {
    it("removes a dependent condition owned by the caster, but not one owned by a different caster, on DM-driven HP loss", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`,
        { hpCurrent: 20, conditions: [{ key: "concentration" }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;
      assert.ok(concentrationId, "applyCombatantTransition should auto-stamp a concentrationId");

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        {
          conditions: [
            { key: "hexed", casterId: playerCombatantId, concentrationId, hexAbility: "wis" },
            { key: "marked", casterId: monsterCombatantId },
            { key: "poisoned" },
          ],
        },
      );

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, { hpCurrent: 0 });

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "hexed"), "the caster's own dependent should be removed");
      assert.ok(conditions.some((c) => c.key === "marked"), "a different caster's dependent must survive");
      assert.ok(conditions.some((c) => c.key === "poisoned"), "a condition with no casterId at all must never be touched");
    });

    it("also sweeps dependent conditions when concentration ends via the player-originated conditions PATCH", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`,
        { hpCurrent: 20, conditions: [{ key: "concentration" }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "hexed", casterId: playerCombatantId, concentrationId, hexAbility: "wis" }] },
      );

      const { status } = await request(
        "PATCH", `/api/me/characters/${playerCharacterId}/conditions`, { conditions: [] }, playerToken,
      );
      assert.equal(status, 200);

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "hexed"), "player-ended concentration should sweep its dependent too");
    });

    it("sweeps Hex when the concentrating character is reduced to 0 through the character sheet", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`,
        { hpCurrent: 20, conditions: [{ key: "concentration" }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;
      assert.ok(concentrationId);

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "hexed", casterId: playerCombatantId, concentrationId, hexAbility: "wis" }] },
      );

      const { status } = await request(
        "PUT", `/api/me/characters/${playerCharacterId}`, { hpCurrent: 0 }, playerToken,
      );
      assert.equal(status, 200);

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      assert.ok(!(liveOf(body).conditions ?? []).some((condition) => condition.key === "hexed"));
    });

    it("sweeps dependent conditions when the caster's own concentration expires via round progression", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "concentration", expiresAtRound: 3 }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "marked", casterId: monsterCombatantId, concentrationId }] },
      );

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { round: 3 });

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "marked"), "expiring the caster's concentration should sweep its dependent");
    });

    it("preserves a same-caster dependent tagged to a DIFFERENT concentrationId than the one ending", async () => {
      // A dependent stamped with some other session's id (e.g. never cleaned up when an earlier,
      // untracked session ended) must not be swept just because the caster happens to be
      // concentrating again right now and that session, too, eventually ends.
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`,
        { hpCurrent: 20, conditions: [{ key: "concentration" }] },
      );
      const currentConcentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;
      assert.ok(currentConcentrationId, "applyCombatantTransition should auto-stamp a concentrationId");

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "hexed", casterId: playerCombatantId, concentrationId: "stale-untracked-session", hexAbility: "wis" }] },
      );

      // End the CURRENT session — its id doesn't match the stale dependent's, so it must survive.
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, { hpCurrent: 0 });

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(
        conditions.some((c) => c.key === "hexed" && c.concentrationId === "stale-untracked-session"),
        "a dependent tagged to a different concentrationId must survive an unrelated session ending",
      );
    });
  });

  describe("player-safe engaged enemies", () => {
    function makeReserveEnemy(overrides: Partial<StoredEncounterActor> & { id: string }): StoredEncounterActor {
      const t = Date.now();
      return {
        encounterId,
        baseType: "monster",
        baseId: `monster-${overrides.id}`,
        name: "Reserve Enemy",
        label: "Reserve Enemy",
        initiative: 5,
        friendly: false,
        color: "red",
        overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
        hpCurrent: 11,
        hpMax: 11,
        hpDetails: null,
        ac: 13,
        acDetails: null,
        attackOverrides: null,
        conditions: [],
        createdAt: t,
        updatedAt: t,
        ...overrides,
      };
    }

    it("hides reserves, latches on first damage, and exposes only a qualitative health state", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-engaged-regression",
        name: "Reserve Ogre",
        label: "Bridge Ogre",
        initiative: 4,
        hpCurrent: 20,
        hpMax: 20,
        ac: 12,
      });
      insertCombatant(db, reserve);
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, { initiative: 12 });

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      const before = await request("GET", statusUrl, undefined, playerToken);
      assert.equal(before.status, 200);
      assert.ok(!JSON.stringify(before.body).includes(reserve.id));

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`, { hpDelta: { kind: "damage", amount: 3 } });
      const damaged = await request("GET", statusUrl, undefined, playerToken);
      const damagedText = JSON.stringify(damaged.body);
      assert.match(damagedText, /Bridge Ogre/);
      assert.match(damagedText, /Damaged/);
      assert.ok(!damagedText.includes("hpCurrent"));
      assert.ok(!damagedText.includes("hpMax"));

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`, { hpDelta: { kind: "heal", amount: 20 } });
      const healedStorage = db.prepare("SELECT snapshot_json, live_json FROM combatants WHERE id = ?").get(reserve.id) as { snapshot_json: string; live_json: string };
      assert.equal(JSON.parse(healedStorage.live_json).engagedWithPlayers, true, "the engagement latch must survive healing writes");
      const healed = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(healed.body), /Bridge Ogre/, "healing must not hide an engaged enemy");

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`, { hpDelta: { kind: "damage", amount: 10 } });
      const bloodied = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(bloodied.body), /Bloodied/);

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`, { hpDelta: { kind: "damage", amount: 20 } });
      const down = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(down.body), /Down/);
    });

    it("always exposes other allies and includes HP percentage for PCs", async () => {
      const allyPlayerId = "player-ally-regression";
      const allyCreatedAt = Date.now();
      db.prepare(`
        INSERT INTO players
          (id, campaign_id, player_name, character_name, hp_max, hp_current, ac, live_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(allyPlayerId, campaignId, "Ally Player", "Ser Rowan", 20, 20, 15, "{}", allyCreatedAt, allyCreatedAt);
      const ally = makeReserveEnemy({
        id: "combatant-ally-regression",
        baseType: "player",
        baseId: allyPlayerId,
        name: "Friendly Guard",
        label: "Ser Rowan",
        initiative: 11,
        friendly: true,
        hpCurrent: 20,
        hpMax: 20,
      });
      insertCombatant(db, ally);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      const healthy = await request("GET", statusUrl, undefined, playerToken);
      const healthyCombat = (healthy.body as { combat: { allies: Array<Record<string, unknown>> } }).combat;
      assert.deepEqual(healthyCombat.allies, [{ id: ally.id, name: "Ser Rowan", health: "Healthy", hpPercent: 100 }]);
      assert.ok(!JSON.stringify(healthyCombat.allies).includes("hpCurrent"));
      assert.ok(!JSON.stringify(healthyCombat.allies).includes("hpMax"));

      db.prepare("UPDATE players SET hp_current = 15 WHERE id = ?").run(allyPlayerId);
      const damaged = await request("GET", statusUrl, undefined, playerToken);
      assert.deepEqual((damaged.body as { combat: { allies: Array<Record<string, unknown>> } }).combat.allies[0], {
        id: ally.id, name: "Ser Rowan", health: "Damaged", hpPercent: 75,
      });

      db.prepare("UPDATE players SET hp_current = 10 WHERE id = ?").run(allyPlayerId);
      const bloody = await request("GET", statusUrl, undefined, playerToken);
      assert.deepEqual((bloody.body as { combat: { allies: Array<Record<string, unknown>> } }).combat.allies[0], {
        id: ally.id, name: "Ser Rowan", health: "Bloody", hpPercent: 50,
      });

      db.prepare("UPDATE players SET hp_current = 0 WHERE id = ?").run(allyPlayerId);
      const down = await request("GET", statusUrl, undefined, playerToken);
      assert.deepEqual((down.body as { combat: { allies: Array<Record<string, unknown>> } }).combat.allies[0], {
        id: ally.id, name: "Ser Rowan", health: "Down", hpPercent: 0,
      });
    });

    it("engages a reserve the moment a player marks it (Hunter's Mark), before any damage lands", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-marked-regression",
        name: "Reserve Wolf",
        label: "Shadow Wolf",
        initiative: 6,
      });
      insertCombatant(db, reserve);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      const before = await request("GET", statusUrl, undefined, playerToken);
      assert.ok(!JSON.stringify(before.body).includes(reserve.id));

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`,
        { conditions: [{ key: "marked", casterId: playerCombatantId }] },
      );
      const markedStorage = db.prepare("SELECT live_json FROM combatants WHERE id = ?").get(reserve.id) as { live_json: string };
      assert.equal(JSON.parse(markedStorage.live_json).engagedWithPlayers, true, "being marked must engage a reserve on its own, without damage");

      const marked = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(marked.body), /Shadow Wolf/, "a marked enemy must show up even at full health");
    });

    it("engages a reserve marked with any ordinary condition (e.g. Poisoned), not just Hunter's Mark", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-poisoned-regression",
        name: "Reserve Bandit",
        label: "Lurking Bandit",
        initiative: 7,
      });
      insertCombatant(db, reserve);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      const before = await request("GET", statusUrl, undefined, playerToken);
      assert.ok(!JSON.stringify(before.body).includes(reserve.id));

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`,
        { conditions: [{ key: "poisoned" }] },
      );
      const poisonedStorage = db.prepare("SELECT live_json FROM combatants WHERE id = ?").get(reserve.id) as { live_json: string };
      assert.equal(JSON.parse(poisonedStorage.live_json).engagedWithPlayers, true, "any ordinary condition must engage a reserve on its own, without damage");

      const poisoned = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(poisoned.body), /Lurking Bandit/, "a poisoned enemy must show up even at full health");
    });

    it("does not engage a reserve that is only invisible", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-invisible-regression",
        name: "Reserve Assassin",
        label: "Hidden Assassin",
        initiative: 8,
      });
      insertCombatant(db, reserve);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`,
        { conditions: [{ key: "invisible" }] },
      );
      const invisibleStorage = db.prepare("SELECT live_json FROM combatants WHERE id = ?").get(reserve.id) as { live_json: string };
      assert.notEqual(JSON.parse(invisibleStorage.live_json).engagedWithPlayers, true, "invisible alone must not engage a reserve");

      const afterInvisible = await request("GET", statusUrl, undefined, playerToken);
      assert.ok(!JSON.stringify(afterInvisible.body).includes(reserve.id), "an invisible-only enemy must stay hidden");
    });

    it("does not engage a reserve that is only concentrating", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-concentration-regression",
        name: "Reserve Cultist",
        label: "Chanting Cultist",
        initiative: 9,
      });
      insertCombatant(db, reserve);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`,
        { conditions: [{ key: "concentration" }] },
      );
      const concentrationStorage = db.prepare("SELECT live_json FROM combatants WHERE id = ?").get(reserve.id) as { live_json: string };
      assert.notEqual(JSON.parse(concentrationStorage.live_json).engagedWithPlayers, true, "concentration alone must not engage a reserve");

      const afterConcentration = await request("GET", statusUrl, undefined, playerToken);
      assert.ok(!JSON.stringify(afterConcentration.body).includes(reserve.id), "a concentration-only enemy must stay hidden");
    });
  });

  describe("world actions", () => {
    it("creates a statless turn-order entry and preserves its reminder text", async () => {
      const created = await dmRequest(
        "POST",
        `/api/encounters/${encounterId}/combatants/addWorldAction`,
        { name: "Falling Meteors", description: "A meteor strikes a random quadrant." },
      );
      assert.equal(created.status, 200);
      const dto = created.body.created as Record<string, unknown>;
      assert.equal(dto.baseType, "world");
      const snapshot = dto.snapshot as Record<string, unknown>;
      const live = dto.live as Record<string, unknown>;
      assert.equal(snapshot.label, "Falling Meteors");
      assert.equal(snapshot.description, "A meteor strikes a random quadrant.");
      assert.equal(snapshot.hpMax, null);
      assert.equal(snapshot.ac, null);
      assert.equal(live.hpCurrent, null);
      assert.equal(live.initiative, null);

      const updated = await dmRequest(
        "PUT",
        `/api/encounters/${encounterId}/combatants/${String(dto.id)}`,
        { initiative: 17, label: "Meteor Shower", description: "Three impacts this round." },
      );
      assert.equal(updated.status, 200);
      const updatedSnapshot = updated.body.snapshot as Record<string, unknown>;
      const updatedLive = updated.body.live as Record<string, unknown>;
      assert.equal(updatedSnapshot.label, "Meteor Shower");
      assert.equal(updatedSnapshot.description, "Three impacts this round.");
      assert.equal(updatedLive.initiative, 17);
    });
  });
});
