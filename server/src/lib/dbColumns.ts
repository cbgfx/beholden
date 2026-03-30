// server/src/lib/dbColumns.ts
// SQL column constants — single source of truth for SELECT column lists.
// Use as: db.prepare(`SELECT ${COLS} FROM table WHERE ...`)

export const ADVENTURE_COLS =
  "id, campaign_id, name, status, sort, created_at, updated_at";

export const ENCOUNTER_COLS =
  "id, campaign_id, adventure_id, name, status, sort, " +
  "combat_round, combat_active_combatant_id, created_at, updated_at";

export const PLAYER_COLS =
  "id, campaign_id, user_id, player_name, character_name, class, species, level, " +
  "hp_max, hp_current, ac, speed, str, dex, con, int, wis, cha, color, image_url, " +
  "overrides_json, conditions_json, death_saves_json, shared_notes, created_at, updated_at";

export const USER_CHARACTER_COLS =
  "id, user_id, name, player_name, class_name, species, level, " +
  "hp_max, hp_current, ac, speed, str_score, dex_score, con_score, " +
  "int_score, wis_score, cha_score, color, image_url, character_data_json, " +
  "death_saves_json, shared_notes, created_at, updated_at";

export const INPC_COLS =
  "id, campaign_id, monster_id, name, label, friendly, " +
  "hp_max, hp_current, hp_details, ac, ac_details, sort, created_at, updated_at";

export const NOTE_COLS =
  "id, campaign_id, adventure_id, title, text, sort, created_at, updated_at";

export const TREASURE_COLS =
  "id, campaign_id, adventure_id, source, item_id, name, rarity, type, type_key, " +
  "attunement, magic, text, qty, sort, created_at, updated_at";

export const CONDITION_COLS =
  "id, campaign_id, key, name, description, sort, created_at, updated_at";

export const CHARACTER_COLS =
  "id, user_id, campaign_id, name, class_name, species, level, " +
  "hp_max, hp_current, temp_hp, ac, speed, " +
  "str_score, dex_score, con_score, int_score, wis_score, cha_score, " +
  "notes, created_at, updated_at";

export const COMBATANT_COLS =
  "id, encounter_id, base_type, base_id, name, label, initiative, friendly, " +
  "color, hp_current, hp_max, hp_details, ac, ac_details, sort, used_reaction, " +
  "used_legendary_actions, used_legendary_resistances, overrides_json, " +
  "conditions_json, death_saves_json, used_spell_slots_json, " +
  "attack_overrides_json, created_at, updated_at";
