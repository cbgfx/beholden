import assert from "node:assert/strict";
import test from "node:test";
import type Database from "better-sqlite3";
import { normalizeCharacterSheetForStorage } from "./characterSheetNormalization.js";
import { mergeLiveStats, type Assignment } from "../services/characters.js";
import type { StoredCharacterSheetState, StoredCharacterSheet } from "../server/userData.js";

const BASE_SHEET: StoredCharacterSheetState = {
  name: "Test Bard",
  playerName: "Player",
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

test("character AC normalization persists the client-derived base and accepts later decreases", () => {
  const raised = normalizeCharacterSheetForStorage(BASE_SHEET, { derivedAc: 16 });
  assert.equal(raised.sheet.ac, 16);

  const lowered = normalizeCharacterSheetForStorage(raised.sheet, { derivedAc: 13 });
  assert.equal(lowered.sheet.ac, 13);
});

test("character AC normalization derives an equipment baseline before the first client sync", () => {
  const normalized = normalizeCharacterSheetForStorage(BASE_SHEET, {
    inventory: [{
      name: "Leather Armor",
      type: "Light Armor",
      ac: 11,
      equipState: "worn",
    }],
  });
  assert.equal(normalized.sheet.ac, 13);
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
