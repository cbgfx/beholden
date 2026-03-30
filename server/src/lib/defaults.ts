// server/src/lib/defaults.ts
// Default values for commonly-constructed D&D domain objects.
// Import these instead of inlining { tempHp: 0, acBonus: 0, ... } everywhere.
import type { StoredOverrides, StoredDeathSaves } from "../server/userData.js";

export const DEFAULT_OVERRIDES: StoredOverrides = Object.freeze({
  tempHp: 0,
  acBonus: 0,
  hpMaxBonus: 0,
});

export const DEFAULT_DEATH_SAVES: StoredDeathSaves = Object.freeze({
  success: 0,
  fail: 0,
});
