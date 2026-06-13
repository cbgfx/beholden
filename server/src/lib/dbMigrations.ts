import type { Db } from "./db.js";
import { CHARACTER_SHEET_COLS } from "./dbColumns.js";
import { normalizeCharacterSheetForStorage, rowToCharacterSheet } from "./dbConverters.js";
import type { StoredCharacterSheetState } from "../server/userData.js";

function parseJsonObject(text: unknown): Record<string, unknown> | null {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toBoolInt(value: unknown): number {
  return value ? 1 : 0;
}

function toSafeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : fallback;
}

function toIntOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toDeathSaves(value: unknown): { success: number; fail: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const success = toIntOrNull(raw.success);
  const fail = toIntOrNull(raw.fail);
  if (success == null || fail == null) return null;
  return {
    success: Math.max(0, Math.min(3, success)),
    fail: Math.max(0, Math.min(3, fail)),
  };
}

function inferNoteTitleFromText(text: unknown): string | null {
  if (typeof text !== "string" || !text.trim()) return null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const title = (heading?.[1] ?? line).trim();
    return title || null;
  }
  return null;
}

function compactSheetJson(_sheet: StoredCharacterSheetState): string {
  return "{}";
}

function jsonOrNull(value: Record<string, unknown> | null): string | null {
  return value ? JSON.stringify(value) : null;
}

function normalizeJsonText(value: unknown): string | null {
  if (value == null) return null;
  const parsed = parseJsonObject(value);
  return parsed ? JSON.stringify(parsed) : String(value);
}

function valuesDiffer(a: unknown, b: unknown): boolean {
  return (a ?? null) !== (b ?? null);
}

export function backfillActorColumns(db: Db) {
  const playerRows = db.prepare(`
    SELECT
      id,
      player_name, character_name, class_name, species, level, hp_max, hp_current, ac, speed,
      str, dex, con, int, wis, cha, color, synced_ac, death_saves_success, death_saves_fail,
      sheet_json, live_json
    FROM players
  `).all() as Array<Record<string, unknown>>;
  const updatePlayer = db.prepare(`
    UPDATE players
    SET
      player_name = ?, character_name = ?, class_name = ?, species = ?, level = ?,
      hp_max = ?, hp_current = ?, ac = ?, speed = ?,
      str = ?, dex = ?, con = ?, int = ?, wis = ?, cha = ?,
      color = ?, synced_ac = ?, death_saves_success = ?, death_saves_fail = ?,
      sheet_json = ?, live_json = ?
    WHERE id = ?
  `);

  for (const row of playerRows) {
    const sheetText = String(row.sheet_json ?? "").trim();
    const liveText = String(row.live_json ?? "").trim();
    if ((!sheetText || sheetText === "{}") && (!liveText || liveText === "{}")) continue;
    const sheet = parseJsonObject(row.sheet_json) ?? {};
    const live = parseJsonObject(row.live_json) ?? {};
    const deathSaves = toDeathSaves(live.deathSaves);

    const compactLive: Record<string, unknown> = {};
    if (live.overrides && typeof live.overrides === "object" && !Array.isArray(live.overrides)) {
      compactLive.overrides = live.overrides;
    }
    if (Array.isArray(live.conditions)) {
      compactLive.conditions = live.conditions;
    }

    updatePlayer.run(
      typeof sheet.playerName === "string" ? sheet.playerName : String(row.player_name ?? ""),
      typeof sheet.characterName === "string" ? sheet.characterName : String(row.character_name ?? ""),
      typeof sheet.class === "string" ? sheet.class : String(row.class_name ?? ""),
      typeof sheet.species === "string" ? sheet.species : String(row.species ?? ""),
      toIntOrNull(sheet.level) ?? toIntOrNull(row.level) ?? 1,
      toIntOrNull(sheet.hpMax) ?? toIntOrNull(row.hp_max) ?? 10,
      toIntOrNull(live.hpCurrent) ?? toIntOrNull(row.hp_current) ?? toIntOrNull(sheet.hpMax) ?? 10,
      toIntOrNull(sheet.ac) ?? toIntOrNull(row.ac) ?? 10,
      toIntOrNull(sheet.speed) ?? toIntOrNull(row.speed),
      toIntOrNull(sheet.str) ?? toIntOrNull(row.str),
      toIntOrNull(sheet.dex) ?? toIntOrNull(row.dex),
      toIntOrNull(sheet.con) ?? toIntOrNull(row.con),
      toIntOrNull(sheet.int) ?? toIntOrNull(row.int),
      toIntOrNull(sheet.wis) ?? toIntOrNull(row.wis),
      toIntOrNull(sheet.cha) ?? toIntOrNull(row.cha),
      toStringOrNull(sheet.color) ?? toStringOrNull(row.color),
      toIntOrNull(sheet.syncedAc) ?? toIntOrNull(row.synced_ac),
      deathSaves?.success ?? toIntOrNull(row.death_saves_success),
      deathSaves?.fail ?? toIntOrNull(row.death_saves_fail),
      "{}",
      Object.keys(compactLive).length > 0 ? JSON.stringify(compactLive) : "{}",
      row.id,
    );
  }

  const characterRows = db.prepare(`
    SELECT
      id,
      name, player_name, class_name, species, level, hp_max, hp_current, ac, speed,
      str_score, dex_score, con_score, int_score, wis_score, cha_score, color,
      death_saves_success, death_saves_fail,
      sheet_json
    FROM user_characters
  `).all() as Array<Record<string, unknown>>;
  const updateCharacter = db.prepare(`
    UPDATE user_characters
    SET
      name = ?, player_name = ?, class_name = ?, species = ?, level = ?,
      hp_max = ?, hp_current = ?, ac = ?, speed = ?,
      str_score = ?, dex_score = ?, con_score = ?, int_score = ?, wis_score = ?, cha_score = ?,
      color = ?, death_saves_success = ?, death_saves_fail = ?,
      sheet_json = ?
    WHERE id = ?
  `);

  for (const row of characterRows) {
    const sheetText = String(row.sheet_json ?? "").trim();
    if (!sheetText || sheetText === "{}") continue;
    const sheet = parseJsonObject(row.sheet_json) ?? {};
    const deathSaves = toDeathSaves(sheet.deathSaves);

    updateCharacter.run(
      typeof sheet.name === "string" ? sheet.name : String(row.name ?? ""),
      typeof sheet.playerName === "string" ? sheet.playerName : String(row.player_name ?? ""),
      typeof sheet.className === "string" ? sheet.className : String(row.class_name ?? ""),
      typeof sheet.species === "string" ? sheet.species : String(row.species ?? ""),
      toIntOrNull(sheet.level) ?? toIntOrNull(row.level) ?? 1,
      toIntOrNull(sheet.hpMax) ?? toIntOrNull(row.hp_max) ?? 0,
      toIntOrNull(sheet.hpCurrent) ?? toIntOrNull(row.hp_current) ?? 0,
      toIntOrNull(sheet.ac) ?? toIntOrNull(row.ac) ?? 10,
      toIntOrNull(sheet.speed) ?? toIntOrNull(row.speed) ?? 30,
      toIntOrNull(sheet.strScore) ?? toIntOrNull(row.str_score),
      toIntOrNull(sheet.dexScore) ?? toIntOrNull(row.dex_score),
      toIntOrNull(sheet.conScore) ?? toIntOrNull(row.con_score),
      toIntOrNull(sheet.intScore) ?? toIntOrNull(row.int_score),
      toIntOrNull(sheet.wisScore) ?? toIntOrNull(row.wis_score),
      toIntOrNull(sheet.chaScore) ?? toIntOrNull(row.cha_score),
      toStringOrNull(sheet.color) ?? toStringOrNull(row.color),
      deathSaves?.success ?? toIntOrNull(row.death_saves_success),
      deathSaves?.fail ?? toIntOrNull(row.death_saves_fail),
      "{}",
      row.id,
    );
  }
}

export function backfillStructuredContentColumns(db: Db) {
  const notesRows = db.prepare("SELECT id, title, text, note_json FROM notes").all() as Array<{
    id: string;
    title: string;
    text: string;
    note_json: string;
  }>;
  const noteUpdate = db.prepare("UPDATE notes SET title = ?, text = ?, note_json = ? WHERE id = ?");
  for (const row of notesRows) {
    const jsonText = String(row.note_json ?? "").trim();
    if (!jsonText || jsonText === "{}") {
      const inferredTitle = inferNoteTitleFromText(row.text);
      if (row.title === "Note" && inferredTitle) {
        noteUpdate.run(inferredTitle, row.text ?? "", "{}", row.id);
      }
      continue;
    }
    const parsed = parseJsonObject(row.note_json);
    const text = typeof parsed?.text === "string" ? parsed.text : row.text ?? "";
    const title = typeof parsed?.title === "string" && parsed.title.trim()
      ? parsed.title
      : row.title === "Note"
        ? inferNoteTitleFromText(text) ?? row.title
        : row.title;
    noteUpdate.run(title, text, "{}", row.id);
  }

  const treasureRows = db.prepare("SELECT id, entry_json FROM treasure").all() as Array<{ id: string; entry_json: string }>;
  const treasureUpdate = db.prepare(
    "UPDATE treasure SET source = ?, item_id = ?, name = ?, rarity = ?, type = ?, type_key = ?, attunement = ?, magic = ?, text = ?, qty = ?, entry_json = ? WHERE id = ?",
  );
  for (const row of treasureRows) {
    const jsonText = String(row.entry_json ?? "").trim();
    if (!jsonText || jsonText === "{}") continue;
    const parsed = parseJsonObject(row.entry_json);
    const source = parsed?.source === "compendium" ? "compendium" : "custom";
    const itemId = typeof parsed?.itemId === "string" ? parsed.itemId : null;
    const name = typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name : "New Item";
    const rarity = typeof parsed?.rarity === "string" ? parsed.rarity : null;
    const type = typeof parsed?.type === "string" ? parsed.type : null;
    const typeKey = typeof parsed?.type_key === "string"
      ? parsed.type_key
      : typeof parsed?.typeKey === "string"
        ? parsed.typeKey
        : null;
    const attunement = toBoolInt(parsed?.attunement);
    const magic = toBoolInt(parsed?.magic);
    const text = typeof parsed?.text === "string" ? parsed.text : "";
    const qty = toSafeInt(parsed?.qty, 1);
    treasureUpdate.run(source, itemId, name, rarity, type, typeKey, attunement, magic, text, qty, "{}", row.id);
  }

  const partyRows = db.prepare("SELECT id, item_json FROM party_inventory").all() as Array<{ id: string; item_json: string }>;
  const partyUpdate = db.prepare(
    "UPDATE party_inventory SET name = ?, quantity = ?, weight = ?, notes = ?, source = ?, item_id = ?, rarity = ?, type = ?, description = ?, item_json = ? WHERE id = ?",
  );
  for (const row of partyRows) {
    const jsonText = String(row.item_json ?? "").trim();
    if (!jsonText || jsonText === "{}") continue;
    const parsed = parseJsonObject(row.item_json);
    const name = typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name : "New Item";
    const quantity = toSafeInt(parsed?.quantity, 1);
    const weight = typeof parsed?.weight === "number" ? parsed.weight : null;
    const notes = typeof parsed?.notes === "string" ? parsed.notes : "";
    const source = typeof parsed?.source === "string" ? parsed.source : null;
    const itemId = typeof parsed?.itemId === "string" ? parsed.itemId : null;
    const rarity = typeof parsed?.rarity === "string" ? parsed.rarity : null;
    const type = typeof parsed?.type === "string" ? parsed.type : null;
    const description = typeof parsed?.description === "string" ? parsed.description : null;
    partyUpdate.run(name, quantity, weight, notes, source, itemId, rarity, type, description, "{}", row.id);
  }
}

export function backfillCharacterDerivedColumns(db: Db) {
  const rows = db.prepare(`SELECT ${CHARACTER_SHEET_COLS} FROM user_characters`).all() as Array<Record<string, unknown>>;
  const updateCharacter = db.prepare(`
    UPDATE user_characters
    SET
      name = ?, player_name = ?, class_name = ?, species = ?, level = ?,
      hp_max = ?, hp_current = ?, ac = ?, speed = ?,
      str_score = ?, dex_score = ?, con_score = ?, int_score = ?, wis_score = ?, cha_score = ?,
      color = ?, death_saves_success = ?, death_saves_fail = ?, sheet_json = ?, character_data_json = ?
    WHERE id = ?
  `);
  const linkedPlayersByCharacter = db.prepare(`
    SELECT
      id, player_name, character_name, class_name, species, level, hp_max, ac, speed,
      str, dex, con, int, wis, cha, color, sheet_json
    FROM players
    WHERE character_id = ?
  `);
  const updateLinkedPlayer = db.prepare(`
    UPDATE players
    SET
      player_name = ?, character_name = ?, class_name = ?, species = ?, level = ?,
      hp_max = ?, ac = ?, speed = ?,
      str = ?, dex = ?, con = ?, int = ?, wis = ?, cha = ?,
      color = ?, sheet_json = ?
    WHERE id = ?
  `);

  for (const row of rows) {
    const readCharacter = rowToCharacterSheet(row);
    const normalized = normalizeCharacterSheetForStorage({
      name: readCharacter.name,
      playerName: readCharacter.playerName,
      className: readCharacter.className,
      species: readCharacter.species,
      level: readCharacter.level,
      hpMax: readCharacter.hpMax,
      hpCurrent: readCharacter.hpCurrent,
      ac: readCharacter.ac,
      speed: readCharacter.speed,
      strScore: readCharacter.strScore,
      dexScore: readCharacter.dexScore,
      conScore: readCharacter.conScore,
      intScore: readCharacter.intScore,
      wisScore: readCharacter.wisScore,
      chaScore: readCharacter.chaScore,
      color: readCharacter.color,
      ...(readCharacter.deathSaves ? { deathSaves: readCharacter.deathSaves } : {}),
    }, readCharacter.characterData);
    const sheet = normalized.sheet;
    const characterDataJson = jsonOrNull(normalized.characterData);
    const sheetJson = compactSheetJson(sheet);

    const shouldUpdateCharacter =
      valuesDiffer(row.name, sheet.name)
      || valuesDiffer(row.player_name, sheet.playerName)
      || valuesDiffer(row.class_name, sheet.className)
      || valuesDiffer(row.species, sheet.species)
      || valuesDiffer(row.level, sheet.level)
      || valuesDiffer(row.hp_max, sheet.hpMax)
      || valuesDiffer(row.hp_current, sheet.hpCurrent)
      || valuesDiffer(row.ac, sheet.ac)
      || valuesDiffer(row.speed, sheet.speed)
      || valuesDiffer(row.str_score, sheet.strScore)
      || valuesDiffer(row.dex_score, sheet.dexScore)
      || valuesDiffer(row.con_score, sheet.conScore)
      || valuesDiffer(row.int_score, sheet.intScore)
      || valuesDiffer(row.wis_score, sheet.wisScore)
      || valuesDiffer(row.cha_score, sheet.chaScore)
      || valuesDiffer(row.color, sheet.color)
      || valuesDiffer(row.death_saves_success, sheet.deathSaves?.success ?? null)
      || valuesDiffer(row.death_saves_fail, sheet.deathSaves?.fail ?? null)
      || valuesDiffer(row.sheet_json, sheetJson)
      || valuesDiffer(normalizeJsonText(row.character_data_json), characterDataJson);

    if (shouldUpdateCharacter) {
      updateCharacter.run(
        sheet.name,
        sheet.playerName,
        sheet.className,
        sheet.species,
        sheet.level,
        sheet.hpMax,
        sheet.hpCurrent,
        sheet.ac,
        sheet.speed,
        sheet.strScore,
        sheet.dexScore,
        sheet.conScore,
        sheet.intScore,
        sheet.wisScore,
        sheet.chaScore,
        sheet.color ?? null,
        sheet.deathSaves?.success ?? null,
        sheet.deathSaves?.fail ?? null,
        sheetJson,
        characterDataJson,
        row.id,
      );
    }

    for (const player of linkedPlayersByCharacter.all(row.id) as Array<Record<string, unknown>>) {
      const shouldUpdatePlayer =
        valuesDiffer(player.player_name, sheet.playerName)
        || valuesDiffer(player.character_name, sheet.name)
        || valuesDiffer(player.class_name, sheet.className)
        || valuesDiffer(player.species, sheet.species)
        || valuesDiffer(player.level, sheet.level)
        || valuesDiffer(player.hp_max, sheet.hpMax)
        || valuesDiffer(player.ac, sheet.ac)
        || valuesDiffer(player.speed, sheet.speed)
        || valuesDiffer(player.str, sheet.strScore)
        || valuesDiffer(player.dex, sheet.dexScore)
        || valuesDiffer(player.con, sheet.conScore)
        || valuesDiffer(player.int, sheet.intScore)
        || valuesDiffer(player.wis, sheet.wisScore)
        || valuesDiffer(player.cha, sheet.chaScore)
        || valuesDiffer(player.color, sheet.color)
        || valuesDiffer(player.sheet_json, "{}");
      if (!shouldUpdatePlayer) continue;
      updateLinkedPlayer.run(
        sheet.playerName,
        sheet.name,
        sheet.className,
        sheet.species,
        sheet.level,
        sheet.hpMax,
        sheet.ac,
        sheet.speed,
        sheet.strScore,
        sheet.dexScore,
        sheet.conScore,
        sheet.intScore,
        sheet.wisScore,
        sheet.chaScore,
        sheet.color ?? null,
        "{}",
        player.id,
      );
    }
  }
}
