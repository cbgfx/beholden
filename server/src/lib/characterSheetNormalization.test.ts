import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { normalizeCharacterSheetForStorage } from "./characterSheetNormalization.js";
import { mergeLiveStats, type Assignment } from "../services/characters.js";
import type { StoredCharacterSheetState, StoredCharacterSheet } from "../server/userData.js";
import { cleanStoredImageUrl, rowToCampaignCharacter } from "./dbConverters.js";
import { ensureImageVersionColumns } from "./imageVersionColumnMigration.js";
import { SCHEMA_SQL } from "./dbSchema.js";
import { importCampaignDocument } from "../routes/exportImportHelpers.js";

const BASE_SHEET: StoredCharacterSheetState = {
  name: "Test Bard",
  playerName: "Player",
  ruleset: "5.5e",
  className: "Bard",
  species: "Human",
  level: 6,
  hpMax: 40,
  hpCurrent: 40,
  ac: 12,
  speed: 30,
  strScore: 10,
  dexScore: 14,
  conScore: 12,
  intScore: 10,
  wisScore: 10,
  chaScore: 16,
  color: null,
};

test("image URLs use the image-specific version and clean stored paths", () => {
  assert.equal(
    cleanStoredImageUrl("https://cdn.example.test/player-images/player-1.webp?v=123&v=456"),
    "/player-images/player-1.webp",
  );

  const player = rowToCampaignCharacter({
    id: "player-1",
    campaign_id: "campaign-1",
    player_name: "Player",
    character_name: "Hero",
    class_name: "Fighter",
    species: "Human",
    level: 1,
    hp_max: 10,
    hp_current: 10,
    ac: 10,
    live_json: "{}",
    image_url: "/player-images/player-1.webp",
    image_updated_at: 111,
    created_at: 1,
    updated_at: 999,
  });
  assert.match(player.imageUrl ?? "", /[?&]v=111$/);
  assert.doesNotMatch(player.imageUrl ?? "", /999/);
});

test("image version migration backfills existing portraits once", () => {
  const db = new Database(":memory:");
  try {
    for (const table of ["campaigns", "players", "user_characters"]) {
      db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, image_url TEXT, updated_at INTEGER NOT NULL)`);
      db.prepare(`INSERT INTO ${table} (id, image_url, updated_at) VALUES (?, ?, ?)`)
        .run(`${table}-1`, `/images/${table}.webp`, 123);
    }

    ensureImageVersionColumns(db);
    ensureImageVersionColumns(db);

    for (const table of ["campaigns", "players", "user_characters"]) {
      const row = db.prepare(`SELECT image_updated_at FROM ${table}`).get() as { image_updated_at: number };
      assert.equal(row.image_updated_at, 123);
    }
  } finally {
    db.close();
  }
});

test("campaign import stores clean image paths", () => {
  const db = new Database(":memory:");
  try {
    db.exec(SCHEMA_SQL);
    importCampaignDocument(db, {
      campaign: {
        id: "campaign-1",
        name: "Campaign",
        imageUrl: "https://public.example/campaign-images/campaign-1.webp?v=10&v=20",
        updatedAt: 20,
      },
      players: [{
        id: "player-1",
        playerName: "Player",
        characterName: "Hero",
        imageUrl: "https://public.example/player-images/player-1.webp?v=30",
        updatedAt: 30,
      }],
    }, () => "generated-id");

    const campaign = db.prepare("SELECT image_url, image_updated_at FROM campaigns WHERE id = 'campaign-1'").get() as Record<string, unknown>;
    const player = db.prepare("SELECT image_url, image_updated_at FROM players WHERE id = 'player-1'").get() as Record<string, unknown>;
    assert.deepEqual(campaign, { image_url: "/campaign-images/campaign-1.webp", image_updated_at: 20 });
    assert.deepEqual(player, { image_url: "/player-images/player-1.webp", image_updated_at: 30 });
  } finally {
    db.close();
  }
});

test("character AC normalization persists the client-derived base and accepts later decreases", () => {
  const raised = normalizeCharacterSheetForStorage(BASE_SHEET, { derivedAc: 16 });
  assert.equal(raised.sheet.ac, 16);

  const lowered = normalizeCharacterSheetForStorage(raised.sheet, { derivedAc: 13 });
  assert.equal(lowered.sheet.ac, 13);
});

test("character AC normalization does not infer rules from embedded inventory", () => {
  const normalized = normalizeCharacterSheetForStorage(BASE_SHEET, {
    inventory: [{
      name: "Leather Armor",
      type: "Light Armor",
      ac: 11,
      equipState: "worn",
    }],
  });
  assert.equal(normalized.sheet.ac, BASE_SHEET.ac);
});

test("character class normalization derives total level from canonical class entries", () => {
  const normalized = normalizeCharacterSheetForStorage(BASE_SHEET, {
    classes: [
      { id: "class_fighter", classId: "c_fighter", className: "Fighter", level: 3, subclass: "sc_fighter_battle_master" },
      { id: "class_wizard", classId: "c_wizard", className: "Wizard", level: 2 },
    ],
  });

  assert.equal(normalized.sheet.level, 5);
  assert.equal(normalized.sheet.className, "Bard");
  assert.deepEqual(normalized.characterData?.classes, [
    { id: "class_fighter", classId: "c_fighter", className: "Fighter", level: 3, subclass: "sc_fighter_battle_master" },
    { id: "class_wizard", classId: "c_wizard", className: "Wizard", level: 2, subclass: null },
  ]);
});

test("character class normalization merges duplicate class records without losing levels", () => {
  const normalized = normalizeCharacterSheetForStorage(BASE_SHEET, {
    classes: [
      { id: "fighter_primary", classId: "c_fighter", className: "Fighter", level: 2 },
      { id: "fighter_duplicate", classId: "c_fighter", className: "Fighter", level: 3, subclass: "sc_fighter_champion" },
      { classId: "c_wizard", className: "Wizard", level: 0 },
      { level: 10 },
    ],
  });

  assert.equal(normalized.sheet.level, 6);
  assert.deepEqual(normalized.characterData?.classes, [
    { id: "fighter_primary", classId: "c_fighter", className: "Fighter", level: 5, subclass: "sc_fighter_champion" },
    { id: "class_c_wizard", classId: "c_wizard", className: "Wizard", level: 1, subclass: null },
  ]);
});

test("character home reads use the canonical sheet AC override when the campaign copy is stale", () => {
  const row = {
    id: "player-1",
    campaign_id: "campaign-1",
    user_id: "user-1",
    character_id: "character-1",
    player_name: "Player",
    character_name: "Test Bard",
    class_name: "Bard",
    species: "Human",
    level: 6,
    hp_max: 40,
    hp_current: 40,
    ac: 13,
    speed: 30,
    live_json: JSON.stringify({
      overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
    }),
    created_at: 1,
    updated_at: 2,
  };
  const db = {
    prepare: () => ({ get: () => row }),
  } as unknown as Database.Database;
  const character = {
    id: "character-1",
    userId: "user-1",
    ...BASE_SHEET,
    ac: 13,
    imageUrl: null,
    characterData: {
      derivedAc: 13,
      sheetOverrides: { tempHp: 0, acBonus: 3, hpMaxBonus: 0 },
    },
    sharedNotes: "",
    createdAt: 1,
    updatedAt: 2,
  } satisfies StoredCharacterSheet;
  const assignments: Assignment[] = [{
    campaign_id: "campaign-1",
    player_id: "player-1",
    campaign_name: "Campaign",
  }];

  assert.equal(mergeLiveStats(db, character, assignments).ac, 16);
});

test("character home reads apply sheet AC overrides without a campaign assignment", () => {
  const db = {} as Database.Database;
  const character = {
    id: "character-1",
    userId: "user-1",
    ...BASE_SHEET,
    ac: 13,
    imageUrl: null,
    characterData: {
      derivedAc: 13,
      sheetOverrides: { tempHp: 0, acBonus: 3, hpMaxBonus: 0 },
    },
    sharedNotes: "",
    createdAt: 1,
    updatedAt: 2,
  } satisfies StoredCharacterSheet;

  assert.equal(mergeLiveStats(db, character, []).ac, 16);
});
