// server/src/lib/dbColumns.ts
// SQL column constants — single source of truth for SELECT column lists.
// Use as: db.prepare(`SELECT ${COLS} FROM table WHERE ...`)

export const ADVENTURE_COLS =
  "id, campaign_id, name, status, sort, created_at, updated_at";

export const ENCOUNTER_COLS =
  "id, campaign_id, adventure_id, name, status, sort, " +
  "combat_round, combat_active_combatant_id, created_at, updated_at";

export const CAMPAIGN_CHARACTER_COLS =
  "id, campaign_id, user_id, character_id, sheet_json, live_json, image_url, " +
  "shared_notes, created_at, updated_at";

export const CHARACTER_SHEET_COLS =
  "id, user_id, sheet_json, image_url, character_data_json, shared_notes, " +
  "created_at, updated_at";

export const INPC_COLS =
  "id, campaign_id, monster_id, name, label, friendly, " +
  "hp_max, hp_current, hp_details, ac, ac_details, sort, created_at, updated_at";

export const NOTE_COLS =
  "id, campaign_id, adventure_id, note_json, sort, created_at, updated_at";

export const TREASURE_COLS =
  "id, campaign_id, adventure_id, entry_json, sort, created_at, updated_at";

export const PARTY_INVENTORY_COLS =
  "id, campaign_id, item_json, sort, created_at, updated_at";

export const CONDITION_COLS =
  "id, campaign_id, key, name, description, sort, created_at, updated_at";

export const ENCOUNTER_ACTOR_COLS =
  "id, encounter_id, base_type, base_id, snapshot_json, live_json, sort, " +
  "created_at, updated_at";
