// server/src/lib/sheetLiveColumns.ts
// A character's live state and its app-worked stats have columns of their own on the sheet, so
// reading them (every roster, fight and party view does, through lib/playerRowsView.ts) never parses
// the sheet's large data blob:
//
//   live_json       {"overrides": {tempHp, acBonus, hpMaxBonus, abilityScores?, permanent?,
//                   inspiration}, "conditions": [...]} - the same shape as a campaign row's live_json
//   derived_hp_max  the HP maximum the player's app works out (feats, items)
//   derived_speed   the speed the player's app works out
//   ac              (existing column) the AC the player's app works out
//
// They used to live in the data blob as `sheetOverrides`, `inspiration`, `conditions`,
// `derivedHpMax`, `derivedSpeed` and `derivedAc`. Those keys are no longer stored there; anything
// still sending them (an older browser tab, the character creator) has them moved to the columns.

export type SheetColumnValues = {
  live?: { overrides?: Record<string, unknown>; conditions?: unknown[] };
  derivedHpMax?: number | null;
  derivedSpeed?: number | null;
  derivedAc?: number | null;
};

const BLOB_KEYS = ["sheetOverrides", "inspiration", "conditions", "derivedHpMax", "derivedSpeed", "derivedAc"] as const;

const positiveInt = (value: unknown): number | null => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : null;
};

/**
 * Takes the column-owned keys out of a data blob. Returns the blob without them and what they held,
 * or null when it had none. `live` is only set when one of the live-state keys was present, and
 * then holds just those parts (the caller merges them over the current column).
 */
export function takeSheetColumnKeys(data: Record<string, unknown>): { data: Record<string, unknown>; values: SheetColumnValues } | null {
  if (!BLOB_KEYS.some((key) => Object.prototype.hasOwnProperty.call(data, key))) return null;
  const rest = { ...data };
  for (const key of BLOB_KEYS) delete rest[key];
  const values: SheetColumnValues = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(data, key);
  if (has("sheetOverrides") || has("inspiration") || has("conditions")) {
    values.live = {};
    if (has("sheetOverrides") || has("inspiration")) {
      const bonuses = data.sheetOverrides && typeof data.sheetOverrides === "object" && !Array.isArray(data.sheetOverrides)
        ? { ...(data.sheetOverrides as Record<string, unknown>) } : {};
      delete bonuses.inspiration;
      values.live.overrides = has("inspiration") ? { ...bonuses, inspiration: data.inspiration === true } : bonuses;
    }
    if (has("conditions")) values.live.conditions = Array.isArray(data.conditions) ? data.conditions : [];
  }
  if (has("derivedHpMax")) values.derivedHpMax = positiveInt(data.derivedHpMax);
  if (has("derivedSpeed")) values.derivedSpeed = data.derivedSpeed == null ? null : Math.max(0, Math.floor(Number(data.derivedSpeed)) || 0);
  if (has("derivedAc")) values.derivedAc = positiveInt(data.derivedAc);
  return { data: rest, values };
}

/** Merges live-state parts over a stored live_json value. */
export function mergeLiveJson(current: string | null | undefined, patch: SheetColumnValues["live"]): string {
  let base: { overrides?: Record<string, unknown>; conditions?: unknown[] } = {};
  try { base = JSON.parse(current ?? "{}") ?? {}; } catch { base = {}; }
  const overrides = patch?.overrides
    ? { ...(base.overrides ?? {}), ...patch.overrides }
    : base.overrides;
  return JSON.stringify({
    ...(overrides ? { overrides } : {}),
    conditions: patch?.conditions ?? base.conditions ?? [],
  });
}

/** Adds the columns to an existing database. */
export function ensureSheetLiveColumns(db: { prepare: (sql: string) => { all: () => unknown[] }; exec: (sql: string) => unknown }): void {
  const columns = (db.prepare("PRAGMA table_info(user_characters)").all() as Array<{ name: string }>).map((column) => column.name);
  if (!columns.includes("live_json")) db.exec("ALTER TABLE user_characters ADD COLUMN live_json TEXT NOT NULL DEFAULT '{}'");
  if (!columns.includes("derived_hp_max")) db.exec("ALTER TABLE user_characters ADD COLUMN derived_hp_max INTEGER");
  if (!columns.includes("derived_speed")) db.exec("ALTER TABLE user_characters ADD COLUMN derived_speed INTEGER");
}
