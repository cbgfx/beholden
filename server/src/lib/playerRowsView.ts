// server/src/lib/playerRowsView.ts
// `player_rows`: the campaign player rows as every read should see them.
//
// A player linked to a character sheet is that character, so its live state - HP, death saves,
// temporary HP and bonuses, conditions, inspiration - has one home: the sheet. The player row's
// own copies of those are not read (and no longer written). A hand-made player with no sheet keeps
// them on its row. Reading through this view gives each player its one home's values, so nothing
// has to copy live state from one table to another ("chain updates") to keep them in step.
//
// The same goes for the character's profile - names, class, species, level, HP maximum, AC, speed,
// ability scores, colour: a linked player's comes from its sheet, a hand-made player's from its row.
// The one thing a campaign keeps for itself is a portrait the DM chose for it (`image_url` on the
// row, empty unless the DM set one); otherwise the character's own portrait shows. Campaign-owned
// facts (campaign, owner, the DM's shared notes, timestamps) are always the row's.
//
// Every read of campaign players goes through this view; only writes use the `players` table.

import type { Db } from "./db.js";

// A linked player reads its sheet's columns (lib/sheetLiveColumns.ts): no JSON is parsed here.
const LINKED = "uc.id IS NOT NULL";
const fromSheet = (sheet: string, row: string, alias: string) => `CASE WHEN ${LINKED} THEN ${sheet} ELSE ${row} END AS ${alias}`;

export const PLAYER_ROWS_VIEW_SQL = `
CREATE VIEW player_rows AS
SELECT
  p.id, p.campaign_id, p.user_id, p.character_id,
  ${fromSheet("uc.player_name", "p.player_name", "player_name")},
  ${fromSheet("uc.name", "p.character_name", "character_name")},
  ${fromSheet("uc.class_name", "p.class_name", "class_name")},
  ${fromSheet("uc.species", "p.species", "species")},
  ${fromSheet("uc.level", "p.level", "level")},
  ${fromSheet("COALESCE(uc.derived_hp_max, uc.hp_max)", "p.hp_max", "hp_max")},
  ${fromSheet("uc.hp_current", "p.hp_current", "hp_current")},
  ${fromSheet("uc.ac", "p.ac", "ac")},
  ${fromSheet("COALESCE(uc.derived_speed, uc.speed)", "p.speed", "speed")},
  ${fromSheet("uc.str_score", "p.str", "str")},
  ${fromSheet("uc.dex_score", "p.dex", "dex")},
  ${fromSheet("uc.con_score", "p.con", "con")},
  ${fromSheet("uc.int_score", "p.int", "int")},
  ${fromSheet("uc.wis_score", "p.wis", "wis")},
  ${fromSheet("uc.cha_score", "p.cha", "cha")},
  ${fromSheet("uc.color", "p.color", "color")},
  ${fromSheet("NULL", "p.synced_ac", "synced_ac")},
  ${fromSheet("uc.death_saves_success", "p.death_saves_success", "death_saves_success")},
  ${fromSheet("uc.death_saves_fail", "p.death_saves_fail", "death_saves_fail")},
  ${fromSheet("uc.live_json", "p.live_json", "live_json")},
  CASE WHEN ${LINKED} AND p.image_url IS NULL THEN uc.image_url ELSE p.image_url END AS image_url,
  CASE WHEN ${LINKED} AND p.image_url IS NULL THEN uc.image_updated_at ELSE p.image_updated_at END AS image_updated_at,
  p.shared_notes, p.created_at, p.updated_at
FROM players p
LEFT JOIN user_characters uc ON uc.id = p.character_id
`;

/** (Re)creates the view on every start, so its definition always matches this file. */
export function ensurePlayerRowsView(db: Db): void {
  db.exec("DROP VIEW IF EXISTS player_rows");
  db.exec(PLAYER_ROWS_VIEW_SQL);
}
