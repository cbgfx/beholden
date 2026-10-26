import assert from "node:assert/strict";
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
import { registerCompendiumRoutes } from "../compendium.js";
import { importNativeCompendiumBatch } from "../../services/compendium/nativeCompendium.js";
import type { ServerContext } from "../../server/context.js";
import { compendiumUploadDirectory, createCompendiumUpload } from "../../lib/upload.js";

export const CANONICAL_MONSTER = {
  "id": "m_compat_cave_bear",
  "ruleset": "5.5e",
  "name": "Cave Bear",
  "source": "PHB",
  "classification": {
    "size": "L",
    "type": "beast",
    "description": "Large beast",
    "environment": [
      "arctic"
    ]
  },
  "description": "A large bear that lives in caves.",
  "passivePerception": 13,
  "challenge": {
    "rating": "2",
    "xp": 450
  },
  "armorClass": {
    "value": 12
  },
  "hitPoints": {
    "formula": "5d10 + 15"
  },
  "movement": {
    "walk": 40,
    "climb": 30
  },
  "abilities": {
    "str": 20,
    "dex": 10,
    "con": 16,
    "int": 2,
    "wis": 13,
    "cha": 7
  },
  "proficiencies": {
    "skills": [
      {
        "name": "Perception",
        "bonus": 3
      }
    ]
  },
  "senses": [
    "Darkvision 60 ft."
  ],
  "actions": [
    {
      "id": "multiattack",
      "name": "Multiattack",
      "description": "The cave bear makes two attacks: one bite and one claws."
    },
    {
      "id": "bite",
      "name": "Bite",
      "description": "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 9 (1d8+5) piercing damage.",
      "recharge": {
        "roll": 5
      },
      "attack": {
        "toHit": 7,
        "reach": "5 ft.",
        "melee": true
      }
    }
  ],
  "spellcasting": [
    {
      "id": "sc_innate",
      "name": "Innate Spellcasting",
      "description": "The cave bear's innate spellcasting ability is Wisdom (spell save DC 11)."
    }
  ],
  "spells": [
    {
      "id": "s_compat_fireball"
    }
  ]
};

export const CANONICAL_ITEM = {
  "id": "i_compat_amulet_health",
  "ruleset": "5.5e",
  "name": "Amulet of Health",
  "source": "DMG",
  "type": "Wondrous Item",
  "rarity": "rare",
  "magical": true,
  "attunement": "requires attunement",
  "equippable": true,
  "weight": 1,
  "effects": [
    {
      "type": "ability_score",
      "mode": "set_minimum",
      "ability": "con",
      "choiceCount": 1,
      "amount": 19,
      "gate": {
        "duration": "while_equipped"
      }
    }
  ],
  "uses": {
    "max": 7,
    "recover": "1d6+1"
  },
  "spells": {
    "s_compat_fireball": {
      "cost": 5,
      "level": 5
    }
  },
  "spellcasting": {
    "dc": 17
  },
  "modifiers": [
    {
      "target": "saving_throws",
      "amount": 1
    }
  ],
  "rolls": [
    {
      "formula": "2d8+2",
      "description": "Quick heal"
    }
  ],
  "description": "While wearing this amulet, your Constitution score is 19."
};

export const CANONICAL_SPELL = {
  "id": "s_compat_fireball",
  "ruleset": "5.5e",
  "name": "Compat Fireball",
  "source": "XGE",
  "level": 3,
  "school": "Evocation",
  "casting": {
    "time": "1 Action",
    "range": "150 feet",
    "components": {
      "verbal": true,
      "somatic": true,
      "material": "a tiny ball of bat guano"
    },
    "duration": {
      "description": "Instantaneous"
    }
  },
  "access": [
    "sl_sorcerer",
    "sl_wizard"
  ],
  "rolls": [
    {
      "formula": "8d6",
      "description": "Fire damage on hit"
    }
  ],
  "description": [
    "Each creature in a 20-foot-radius sphere must make a Dexterity saving throw."
  ]
};

export const CANONICAL_CLASS_TALENT = {
  "ruleset": "5.5e",
  "id": "ct_invocation_compat_test",
  "name": "Invocation: Compat Test",
  "kind": "invocation",
  "prerequisite": {
    "level": 2,
    "cantrip": "damage"
  },
  "repeatable": true,
  "effects": [
    {
      "type": "spell_grant",
      "spellName": "Mage Armor",
      "mode": "at_will",
      "castsWithoutSlot": true
    }
  ],
  "description": [
    "A test invocation."
  ]
};

export const CANONICAL_BACKGROUND = {
  "ruleset": "5.5e",
  "id": "bg_compat_acolyte",
  "name": "Compat Acolyte",
  "description": "A compact test background.",
  "proficiencies": {
    "skills": [
      "Insight",
      "Religion"
    ]
  },
  "equipment": {
    "options": [
      {
        "id": "A",
        "entries": [
          {
            "kind": "item",
            "itemId": "i_compat_amulet_health",
            "quantity": 1
          },
          {
            "kind": "item",
            "itemId": "i_compat_amulet_health",
            "quantity": 1,
            "sourceLabel": "Amulet (blessed)"
          },
          {
            "kind": "currency",
            "denomination": "GP",
            "amount": 8
          }
        ]
      }
    ]
  }
};

export const CANONICAL_CLASS = {
  "id": "c_compat_fighter",
  "ruleset": "5.5e",
  "name": "Compat Fighter",
  "descriptions": [
    "A warrior skilled in all forms of combat."
  ],
  "hitDie": 10,
  "spellLists": {
    "sl_sorcerer": "Sorcerer",
    "sl_wizard": "Wizard"
  },
  "proficiencies": {
    "savingThrows": [
      "str",
      "con"
    ],
    "skills": {
      "choose": 2,
      "from": [
        "Athletics",
        "Acrobatics",
        "History"
      ]
    },
    "armor": [
      "All Armor"
    ],
    "weapons": [
      "Martial Weapons",
      "Simple Weapons"
    ]
  },
  "levels": [
    {
      "level": 1,
      "features": [
        {
          "id": "fighter_1_second_wind",
          "name": "Second Wind",
          "description": "You can use a Bonus Action to regain 1d10 + fighter level hit points."
        }
      ],
      "resources": [
        {
          "name": "Second Wind",
          "uses": 1,
          "recovery": "short_rest"
        }
      ]
    },
    {
      "level": 2,
      "features": [
        {
          "id": "fighter_2_action_surge",
          "name": "Action Surge",
          "description": "You can take one additional action."
        }
      ],
      "resources": [
        {
          "name": "Action Surge",
          "uses": 1,
          "recovery": "short_rest"
        }
      ]
    }
  ]
};

export function makeTestBatch(
  category: string,
  entries: Record<string, unknown>[],
) {
  return {
    format: "beholden.compendium",
    schema: "grand",
    category,
    exportedAt: "2026-06-28T00:00:00.000Z",
    entries,
  };
}

export let server: http.Server;

export let port: number;

export let db: Database.Database;

export let compendiumUploadDir: string;

export let testDataDir: string;

export const adminToken = signToken({
    userId: "test-admin",
    username: "admin",
    isAdmin: true,
  });

export function request(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }> {
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
            Authorization: `Bearer ${adminToken}`,
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
              resolve({ status: res.statusCode ?? 0, body: data });
            }
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

export async function grandEntry(url: string): Promise<Record<string, unknown>> {
    const result = await request("GET", `${url}?view=grand`);
    assert.equal(result.status, 200);
    return result.body as Record<string, unknown>;
  }

export function requestBuffer(url: string): Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
  }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: url,
          method: "GET",
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }));
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

export function uploadCompendium(url: string, content: string): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const boundary = `beholden-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const payload = Buffer.from([
        `--${boundary}\r\n`,
        'Content-Disposition: form-data; name="file"; filename="compendium.json"\r\n',
        "Content-Type: application/json\r\n\r\n",
        content,
        `\r\n--${boundary}--\r\n`,
      ].join(""));
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        path: url,
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": payload.length,
        },
      }, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk; });
        res.on("end", () => {
          try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode ?? 0, body: data }); }
        });
      });
      req.on("error", reject);
      req.end(payload);
    });
  }

before(async () => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);

    const upload = multer({ storage: multer.memoryStorage() });
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-compendium-upload-test-"));
    compendiumUploadDir = compendiumUploadDirectory(testDataDir);
    const compendiumUpload = createCompendiumUpload(testDataDir);
    const ctx: ServerContext = {
      runtime: { appName: "test", host: "127.0.0.1", port: 0, dataDir: testDataDir },
      paths: {
        dataDir: testDataDir,
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
      broadcast: (() => {}) as ServerContext["broadcast"],
      upload,
      imageUpload: upload,
      compendiumUpload,
      dbImportUpload: upload,
      helpers: {
        now: () => Date.now(),
        uid: () => Math.random().toString(36).slice(2),
        normalizeKey: (s: string) =>
          s.toLowerCase().replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, ""),
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
    // Apply auth to all /api routes (mirrors createServer.ts without health/login exemptions)
    app.use("/api", requireAuth);
    registerCompendiumRoutes(app, ctx);

    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as net.AddressInfo).port;

    // Seed Grand records via the native import service
    importNativeCompendiumBatch(
      db,
      makeTestBatch("monsters", [CANONICAL_MONSTER]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("items", [
        CANONICAL_ITEM,
        { ...CANONICAL_ITEM, id: "i_backpack", name: "Backpack" },
        { ...CANONICAL_ITEM, id: "i_torch", name: "Torch" },
      ]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("spells", [CANONICAL_SPELL]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("classTalents", [CANONICAL_CLASS_TALENT]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("classes", [CANONICAL_CLASS]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );
    importNativeCompendiumBatch(
      db,
      makeTestBatch("backgrounds", [CANONICAL_BACKGROUND]) as Parameters<typeof importNativeCompendiumBatch>[1],
    );

  });

after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    db.close();
    assert.deepEqual(fs.readdirSync(compendiumUploadDir), []);
    fs.rmdirSync(compendiumUploadDir);
    fs.rmdirSync(path.join(testDataDir, "tmp"));
    fs.rmdirSync(testDataDir);
  });
