import { before, after } from "node:test";
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

export type BroadcastEvent = { type: string; payload: Record<string, unknown> };

export type ConditionEntry = { key: string; casterId?: string | null; concentrationId?: string | null };

export let db: Database.Database;

export let server: http.Server;

export let port: number;

export let broadcasts: BroadcastEvent[] = [];

export let campaignId: string;

export let encounterId: string;

export let monsterCombatantId: string;

export let monster2CombatantId: string;

export let playerCombatantId: string;

export let playerRowId: string;

export let playerCharacterId: string;

export const playerUserId = "test-player-user";

export const dmToken = signToken({ userId: "test-dm", username: "dm", isAdmin: true });

export let playerToken: string;

export function request(
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

export const dmRequest = (method: string, url: string, body?: unknown) => request(method, url, body, dmToken);

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
      imageUpload: upload,
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

export function liveOf(dto: Record<string, unknown>): { hpCurrent?: number; conditions?: ConditionEntry[]; usedReaction?: boolean } {
    return (dto.live ?? {}) as { hpCurrent?: number; conditions?: ConditionEntry[]; usedReaction?: boolean };
  }
