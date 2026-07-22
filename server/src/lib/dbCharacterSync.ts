import type { Db } from "./db.js";
import { CHARACTER_SHEET_COLS } from "./dbColumns.js";
import { normalizeCharacterSheetForStorage, rowToCharacterSheet } from "./dbConverters.js";

function normalizedJson(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value.trim()) return String(value);
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? JSON.stringify(parsed)
      : String(value);
  } catch {
    return String(value);
  }
}

function valuesDiffer(a: unknown, b: unknown): boolean {
  return (a ?? null) !== (b ?? null);
}

export function syncCharacterDerivedColumns(db: Db): void {
  // Linked characters use the canonical AC column. Clear the retired client
  // projection so stale values cannot leak through older API consumers.
  db.prepare(
    "UPDATE players SET synced_ac = NULL WHERE character_id IS NOT NULL AND synced_ac IS NOT NULL",
  ).run();

  const characterColumns = CHARACTER_SHEET_COLS.split(", ").map((column) => `uc.${column}`).join(", ");
  const rows = db.prepare(`
    SELECT ${characterColumns}, u.name AS owner_name
    FROM user_characters uc
    JOIN users u ON u.id = uc.user_id
  `).all() as Array<Record<string, unknown>>;
  const updateCharacter = db.prepare(`
    UPDATE user_characters
    SET
      name = ?, player_name = ?, class_name = ?, species = ?, level = ?,
      hp_max = ?, hp_current = ?, ac = ?, speed = ?,
      str_score = ?, dex_score = ?, con_score = ?, int_score = ?, wis_score = ?, cha_score = ?,
      color = ?, death_saves_success = ?, death_saves_fail = ?, character_data_json = ?
    WHERE id = ?
  `);

  const allLinkedPlayers = db.prepare(`
    SELECT
      id, user_id, character_id, player_name, character_name, class_name, species, level, hp_max, ac, speed,
      str, dex, con, int, wis, cha, color
    FROM players
    WHERE character_id IS NOT NULL
  `).all() as Array<Record<string, unknown>>;
  const playersByCharacterId = new Map<string, Array<Record<string, unknown>>>();
  for (const player of allLinkedPlayers) {
    const characterId = player.character_id as string;
    if (!playersByCharacterId.has(characterId)) {
      playersByCharacterId.set(characterId, []);
    }
    playersByCharacterId.get(characterId)!.push(player);
  }

  const updateLinkedPlayer = db.prepare(`
    UPDATE players
    SET
      user_id = ?, player_name = ?, character_name = ?, class_name = ?, species = ?, level = ?,
      hp_max = ?, ac = ?, speed = ?,
      str = ?, dex = ?, con = ?, int = ?, wis = ?, cha = ?,
      color = ?
    WHERE id = ?
  `);

  for (const row of rows) {
    const readCharacter = rowToCharacterSheet(row);
    const ownerName = String(row.owner_name ?? "").trim() || readCharacter.playerName;
    const normalized = normalizeCharacterSheetForStorage({
      name: readCharacter.name,
      playerName: ownerName,
      ruleset: readCharacter.ruleset,
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
    const characterData = normalized.characterData;
    const characterDataJson = characterData ? JSON.stringify(characterData) : null;
    const persistedDerivedHpMax = Number(characterData?.derivedHpMax);
    const mirroredHpMax = Number.isFinite(persistedDerivedHpMax) && persistedDerivedHpMax >= 1
      ? Math.floor(persistedDerivedHpMax)
      : sheet.hpMax;
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
      || valuesDiffer(normalizedJson(row.character_data_json), characterDataJson);

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
        characterDataJson,
        row.id,
      );
    }

    const linkedPlayers = playersByCharacterId.get(row.id as string) ?? [];
    for (const player of linkedPlayers) {
      const shouldUpdatePlayer =
        valuesDiffer(player.user_id, row.user_id)
        || valuesDiffer(player.player_name, sheet.playerName)
        || valuesDiffer(player.character_name, sheet.name)
        || valuesDiffer(player.class_name, sheet.className)
        || valuesDiffer(player.species, sheet.species)
        || valuesDiffer(player.level, sheet.level)
        || valuesDiffer(player.hp_max, mirroredHpMax)
        || valuesDiffer(player.ac, sheet.ac)
        || valuesDiffer(player.speed, sheet.speed)
        || valuesDiffer(player.str, sheet.strScore)
        || valuesDiffer(player.dex, sheet.dexScore)
        || valuesDiffer(player.con, sheet.conScore)
        || valuesDiffer(player.int, sheet.intScore)
        || valuesDiffer(player.wis, sheet.wisScore)
        || valuesDiffer(player.cha, sheet.chaScore)
        || valuesDiffer(player.color, sheet.color);
      if (!shouldUpdatePlayer) continue;
      updateLinkedPlayer.run(
        row.user_id,
        sheet.playerName,
        sheet.name,
        sheet.className,
        sheet.species,
        sheet.level,
        mirroredHpMax,
        sheet.ac,
        sheet.speed,
        sheet.strScore,
        sheet.dexScore,
        sheet.conScore,
        sheet.intScore,
        sheet.wisScore,
        sheet.chaScore,
        sheet.color ?? null,
        player.id,
      );
    }
  }

  // Player combatants are encounter projections. Repair stale snapshots so any
  // raw combatant reads agree with the current campaign player baseline.
  db.exec(`
    UPDATE combatants
    SET snapshot_json = json_set(
      snapshot_json,
      '$.name', (SELECT p.character_name FROM players p WHERE p.id = combatants.base_id),
      '$.hpMax', (SELECT p.hp_max FROM players p WHERE p.id = combatants.base_id),
      '$.ac', (SELECT p.ac FROM players p WHERE p.id = combatants.base_id)
    )
    WHERE base_type = 'player'
      AND EXISTS (SELECT 1 FROM players p WHERE p.id = combatants.base_id);
  `);
}
