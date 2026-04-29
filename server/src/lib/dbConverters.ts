// server/src/lib/dbConverters.ts
// Row → domain object converters, shared across all route files.

import { DEFAULT_OVERRIDES, DEFAULT_DEATH_SAVES } from "./defaults.js";
import { absolutizePublicUrl } from "./publicUrl.js";
import type {
  StoredCampaign,
  StoredAdventure,
  StoredEncounter,
  StoredCampaignCharacter,
  StoredCampaignCharacterLiveState,
  StoredCampaignCharacterSheetState,
  StoredINpc,
  StoredNote,
  StoredNoteState,
  StoredPartyInventoryItem,
  StoredPartyInventoryItemState,
  StoredTreasure,
  StoredTreasureState,
  StoredCondition,
  StoredEncounterActor,
  StoredEncounterActorBaseType,
  StoredEncounterActorLiveState,
  StoredEncounterActorSnapshot,
  StoredCharacterSheet,
  StoredCharacterSheetState,
} from "../server/userData.js";

export function parseJson<T>(s: unknown, fallback: T): T {
  if (!s || typeof s !== "string") return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function readTimestamps(row: Record<string, unknown>) {
  return {
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

function readOptionalAbilities(row: Record<string, unknown>) {
  return {
    ...(row.str != null ? { str: row.str as number } : {}),
    ...(row.dex != null ? { dex: row.dex as number } : {}),
    ...(row.con != null ? { con: row.con as number } : {}),
    ...(row.int != null ? { int: row.int as number } : {}),
    ...(row.wis != null ? { wis: row.wis as number } : {}),
    ...(row.cha != null ? { cha: row.cha as number } : {}),
  };
}

function readSheetAbilities(row: Record<string, unknown>) {
  return {
    strScore: (row.str_score as number | null) ?? null,
    dexScore: (row.dex_score as number | null) ?? null,
    conScore: (row.con_score as number | null) ?? null,
    intScore: (row.int_score as number | null) ?? null,
    wisScore: (row.wis_score as number | null) ?? null,
    chaScore: (row.cha_score as number | null) ?? null,
  };
}

function readActorVitals(row: Record<string, unknown>) {
  return {
    hpMax: row.hp_max as number,
    hpCurrent: row.hp_current as number,
    ac: row.ac as number,
  };
}

function readCharacterSheetState(row: Record<string, unknown>): StoredCharacterSheetState {
  const hasStructuredColumns = row.name !== undefined || row.player_name !== undefined;
  const sheet = parseJson<Partial<StoredCharacterSheetState>>(row.sheet_json, {});
  const deathSavesFromCols =
    typeof row.death_saves_success === "number" && typeof row.death_saves_fail === "number"
      ? {
          success: Math.max(0, Math.min(3, Math.floor(row.death_saves_success))),
          fail: Math.max(0, Math.min(3, Math.floor(row.death_saves_fail))),
        }
      : undefined;
  const deathSaves = deathSavesFromCols ?? sheet.deathSaves;
  return {
    name: hasStructuredColumns
      ? (typeof row.name === "string" ? row.name : "")
      : (typeof sheet.name === "string" ? sheet.name : ""),
    playerName: hasStructuredColumns
      ? (typeof row.player_name === "string" ? row.player_name : "")
      : (typeof sheet.playerName === "string" ? sheet.playerName : ""),
    className: hasStructuredColumns
      ? (typeof row.class_name === "string" ? row.class_name : "")
      : (typeof sheet.className === "string" ? sheet.className : ""),
    species: hasStructuredColumns
      ? (typeof row.species === "string" ? row.species : "")
      : (typeof sheet.species === "string" ? sheet.species : ""),
    level: hasStructuredColumns
      ? (typeof row.level === "number" ? row.level : 1)
      : (typeof sheet.level === "number" ? sheet.level : 1),
    hpMax: hasStructuredColumns
      ? (typeof row.hp_max === "number" ? row.hp_max : 0)
      : (typeof sheet.hpMax === "number" ? sheet.hpMax : 0),
    hpCurrent: hasStructuredColumns
      ? (typeof row.hp_current === "number" ? row.hp_current : 0)
      : (typeof sheet.hpCurrent === "number" ? sheet.hpCurrent : 0),
    ac: hasStructuredColumns
      ? (typeof row.ac === "number" ? row.ac : 10)
      : (typeof sheet.ac === "number" ? sheet.ac : 10),
    speed: hasStructuredColumns
      ? (typeof row.speed === "number" ? row.speed : 30)
      : (typeof sheet.speed === "number" ? sheet.speed : 30),
    strScore: hasStructuredColumns ? (typeof row.str_score === "number" ? row.str_score : null) : (sheet.strScore ?? null),
    dexScore: hasStructuredColumns ? (typeof row.dex_score === "number" ? row.dex_score : null) : (sheet.dexScore ?? null),
    conScore: hasStructuredColumns ? (typeof row.con_score === "number" ? row.con_score : null) : (sheet.conScore ?? null),
    intScore: hasStructuredColumns ? (typeof row.int_score === "number" ? row.int_score : null) : (sheet.intScore ?? null),
    wisScore: hasStructuredColumns ? (typeof row.wis_score === "number" ? row.wis_score : null) : (sheet.wisScore ?? null),
    chaScore: hasStructuredColumns ? (typeof row.cha_score === "number" ? row.cha_score : null) : (sheet.chaScore ?? null),
    color: hasStructuredColumns
      ? (typeof row.color === "string" || row.color === null ? (row.color as string | null) ?? null : null)
      : (typeof sheet.color === "string" || sheet.color === null ? sheet.color ?? null : null),
    ...(deathSaves ? { deathSaves } : {}),
  };
}

function readCampaignCharacterSheetState(
  row: Record<string, unknown>,
): StoredCampaignCharacterSheetState {
  const hasStructuredColumns = row.player_name !== undefined || row.character_name !== undefined;
  const sheet = parseJson<Partial<StoredCampaignCharacterSheetState>>(row.sheet_json, {});
  return {
    playerName: hasStructuredColumns
      ? (typeof row.player_name === "string" ? row.player_name : "")
      : (typeof sheet.playerName === "string" ? sheet.playerName : ""),
    characterName: hasStructuredColumns
      ? (typeof row.character_name === "string" ? row.character_name : "")
      : (typeof sheet.characterName === "string" ? sheet.characterName : ""),
    class: hasStructuredColumns
      ? (typeof row.class_name === "string" ? row.class_name : "")
      : (typeof sheet.class === "string" ? sheet.class : ""),
    species: hasStructuredColumns
      ? (typeof row.species === "string" ? row.species : "")
      : (typeof sheet.species === "string" ? sheet.species : ""),
    level: hasStructuredColumns
      ? (typeof row.level === "number" ? row.level : 1)
      : (typeof sheet.level === "number" ? sheet.level : 1),
    hpMax: hasStructuredColumns
      ? (typeof row.hp_max === "number" ? row.hp_max : 10)
      : (typeof sheet.hpMax === "number" ? sheet.hpMax : 10),
    ac: hasStructuredColumns
      ? (typeof row.ac === "number" ? row.ac : 10)
      : (typeof sheet.ac === "number" ? sheet.ac : 10),
    ...(hasStructuredColumns
      ? (typeof row.speed === "number" ? { speed: row.speed } : {})
      : (typeof sheet.speed === "number" ? { speed: sheet.speed } : {})),
    ...(hasStructuredColumns
      ? (typeof row.str === "number" ? { str: row.str } : {})
      : (sheet.str != null ? { str: sheet.str } : {})),
    ...(hasStructuredColumns
      ? (typeof row.dex === "number" ? { dex: row.dex } : {})
      : (sheet.dex != null ? { dex: sheet.dex } : {})),
    ...(hasStructuredColumns
      ? (typeof row.con === "number" ? { con: row.con } : {})
      : (sheet.con != null ? { con: sheet.con } : {})),
    ...(hasStructuredColumns
      ? (typeof row.int === "number" ? { int: row.int } : {})
      : (sheet.int != null ? { int: sheet.int } : {})),
    ...(hasStructuredColumns
      ? (typeof row.wis === "number" ? { wis: row.wis } : {})
      : (sheet.wis != null ? { wis: sheet.wis } : {})),
    ...(hasStructuredColumns
      ? (typeof row.cha === "number" ? { cha: row.cha } : {})
      : (sheet.cha != null ? { cha: sheet.cha } : {})),
    ...(hasStructuredColumns
      ? (typeof row.color === "string" || row.color === null ? { color: (row.color as string | null) ?? null } : {})
      : (typeof sheet.color === "string" || sheet.color === null ? { color: sheet.color ?? null } : {})),
    ...(hasStructuredColumns
      ? (typeof row.synced_ac === "number" ? { syncedAc: row.synced_ac } : {})
      : (typeof sheet.syncedAc === "number" ? { syncedAc: sheet.syncedAc } : {})),
  };
}

function readCampaignCharacterLiveState(
  row: Record<string, unknown>,
): StoredCampaignCharacterLiveState {
  const live = parseJson<Partial<StoredCampaignCharacterLiveState>>(row.live_json, {});
  const deathSavesFromCols =
    typeof row.death_saves_success === "number" && typeof row.death_saves_fail === "number"
      ? {
          success: Math.max(0, Math.min(3, Math.floor(row.death_saves_success))),
          fail: Math.max(0, Math.min(3, Math.floor(row.death_saves_fail))),
        }
      : undefined;
  return {
    hpCurrent: typeof row.hp_current === "number" ? row.hp_current : (typeof live.hpCurrent === "number" ? live.hpCurrent : 0),
    overrides: live.overrides ?? DEFAULT_OVERRIDES,
    conditions: live.conditions ?? [],
    ...(deathSavesFromCols ?? live.deathSaves ? { deathSaves: deathSavesFromCols ?? live.deathSaves } : {}),
  };
}

function readEncounterActorSnapshot(
  row: Record<string, unknown>,
): StoredEncounterActorSnapshot {
  const snapshot = parseJson<Partial<StoredEncounterActorSnapshot>>(row.snapshot_json, {});
  return {
    name: typeof snapshot.name === "string" ? snapshot.name : "",
    label: typeof snapshot.label === "string" ? snapshot.label : "",
    friendly: Boolean(snapshot.friendly),
    color: typeof snapshot.color === "string" ? snapshot.color : "#cccccc",
    hpMax: typeof snapshot.hpMax === "number" ? snapshot.hpMax : null,
    hpDetails: typeof snapshot.hpDetails === "string" || snapshot.hpDetails === null
      ? snapshot.hpDetails ?? null
      : null,
    ac: typeof snapshot.ac === "number" ? snapshot.ac : null,
    acDetails: typeof snapshot.acDetails === "string" || snapshot.acDetails === null
      ? snapshot.acDetails ?? null
      : null,
    attackOverrides: snapshot.attackOverrides ?? null,
  };
}

function readEncounterActorLiveState(
  row: Record<string, unknown>,
): StoredEncounterActorLiveState {
  const live = parseJson<Partial<StoredEncounterActorLiveState>>(row.live_json, {});
  return {
    initiative: typeof live.initiative === "number" ? live.initiative : null,
    hpCurrent: typeof live.hpCurrent === "number" ? live.hpCurrent : null,
    overrides: live.overrides ?? DEFAULT_OVERRIDES,
    conditions: live.conditions ?? [],
    ...((live.deathSaves ?? undefined) ? { deathSaves: live.deathSaves } : {}),
    ...(typeof live.usedReaction === "boolean" ? { usedReaction: live.usedReaction } : {}),
    ...(typeof live.usedLegendaryActions === "number"
      ? { usedLegendaryActions: live.usedLegendaryActions }
      : {}),
    ...(typeof live.usedLegendaryResistances === "number"
      ? { usedLegendaryResistances: live.usedLegendaryResistances }
      : {}),
    ...(live.usedSpellSlots ? { usedSpellSlots: live.usedSpellSlots } : {}),
  };
}

function readNoteState(row: Record<string, unknown>): StoredNoteState {
  const titleCol = typeof row.title === "string" ? row.title : null;
  const textCol = typeof row.text === "string" ? row.text : null;
  const note = parseJson<Partial<StoredNoteState>>(row.note_json, {});
  const jsonTitle = typeof note.title === "string" ? note.title : null;
  const jsonText = typeof note.text === "string" ? note.text : null;
  if (titleCol != null || textCol != null) {
    return {
      title: titleCol === "Note" && jsonTitle && jsonTitle !== "Note" ? jsonTitle : titleCol ?? jsonTitle ?? "Note",
      text: textCol === "" && jsonText ? jsonText : textCol ?? jsonText ?? "",
    };
  }
  return {
    title: jsonTitle ?? "Note",
    text: jsonText ?? "",
  };
}

function readTreasureState(row: Record<string, unknown>): StoredTreasureState {
  const sourceCol = row.source === "custom" ? "custom" : row.source === "compendium" ? "compendium" : null;
  if (sourceCol) {
    return {
      source: sourceCol,
      itemId: typeof row.item_id === "string" || row.item_id === null ? (row.item_id as string | null) : null,
      name: typeof row.name === "string" ? row.name : "New Item",
      rarity: typeof row.rarity === "string" || row.rarity === null ? (row.rarity as string | null) : null,
      type: typeof row.type === "string" || row.type === null ? (row.type as string | null) : null,
      type_key: typeof row.type_key === "string" || row.type_key === null ? (row.type_key as string | null) : null,
      attunement: Boolean(row.attunement),
      magic: Boolean(row.magic),
      text: typeof row.text === "string" ? row.text : "",
      qty: typeof row.qty === "number" ? row.qty : 1,
    };
  }
  const entry = parseJson<Partial<StoredTreasureState>>(row.entry_json, {});
  return {
    source: entry.source === "custom" ? "custom" : "compendium",
    itemId: typeof entry.itemId === "string" || entry.itemId === null ? entry.itemId ?? null : null,
    name: typeof entry.name === "string" ? entry.name : "New Item",
    rarity: typeof entry.rarity === "string" || entry.rarity === null ? entry.rarity ?? null : null,
    type: typeof entry.type === "string" || entry.type === null ? entry.type ?? null : null,
    type_key: typeof entry.type_key === "string" || entry.type_key === null ? entry.type_key ?? null : null,
    attunement: Boolean(entry.attunement),
    magic: Boolean(entry.magic),
    text: typeof entry.text === "string" ? entry.text : "",
    qty: typeof entry.qty === "number" ? entry.qty : 1,
  };
}

function readPartyInventoryItemState(row: Record<string, unknown>): StoredPartyInventoryItemState {
  const nameCol = typeof row.name === "string" ? row.name : null;
  if (nameCol != null) {
    return {
      name: nameCol,
      quantity: typeof row.quantity === "number" ? row.quantity : 1,
      weight: typeof row.weight === "number" ? row.weight : null,
      notes: typeof row.notes === "string" ? row.notes : "",
      source: typeof row.source === "string" || row.source === null ? (row.source as string | null) : null,
      itemId: typeof row.item_id === "string" || row.item_id === null ? (row.item_id as string | null) : null,
      rarity: typeof row.rarity === "string" || row.rarity === null ? (row.rarity as string | null) : null,
      type: typeof row.type === "string" || row.type === null ? (row.type as string | null) : null,
      description:
        typeof row.description === "string" || row.description === null
          ? (row.description as string | null)
          : null,
    };
  }
  const item = parseJson<Partial<StoredPartyInventoryItemState>>(row.item_json, {});
  return {
    name: typeof item.name === "string" ? item.name : "New Item",
    quantity: typeof item.quantity === "number" ? item.quantity : 1,
    weight: typeof item.weight === "number" ? item.weight : null,
    notes: typeof item.notes === "string" ? item.notes : "",
    source: typeof item.source === "string" || item.source === null ? item.source ?? null : null,
    itemId: typeof item.itemId === "string" || item.itemId === null ? item.itemId ?? null : null,
    rarity: typeof item.rarity === "string" || item.rarity === null ? item.rarity ?? null : null,
    type: typeof item.type === "string" || item.type === null ? item.type ?? null : null,
    description: typeof item.description === "string" || item.description === null ? item.description ?? null : null,
  };
}

export function rowToUser(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCampaign(row: Record<string, unknown>): StoredCampaign {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string | null) ?? null,
    imageUrl: absolutizePublicUrl((row.image_url as string | null) ?? null),
    sharedNotes: (row.shared_notes as string | null) ?? "",
    ...readTimestamps(row),
  };
}

export function rowToAdventure(row: Record<string, unknown>): StoredAdventure {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    name: row.name as string,
    status: row.status as string,
    sort: row.sort as number,
    ...readTimestamps(row),
  };
}

export function rowToEncounter(row: Record<string, unknown>): StoredEncounter {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: row.adventure_id as string,
    name: row.name as string,
    status: row.status as string,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    ...(row.combat_round != null
      ? { combat: { round: row.combat_round as number, activeCombatantId: (row.combat_active_combatant_id as string | null) ?? null } }
      : {}),
    ...readTimestamps(row),
  };
}

export function rowToCampaignCharacter(row: Record<string, unknown>): StoredCampaignCharacter {
  const sheet = readCampaignCharacterSheetState(row);
  const live = readCampaignCharacterLiveState(row);
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    userId: (row.user_id as string | null) ?? null,
    characterId: (row.character_id as string | null) ?? null,
    playerName: sheet.playerName,
    characterName: sheet.characterName,
    class: sheet.class,
    species: sheet.species,
    level: sheet.level,
    hpMax: sheet.hpMax,
    hpCurrent: live.hpCurrent,
    ac: sheet.ac,
    ...(sheet.speed != null ? { speed: sheet.speed } : {}),
    ...(sheet.str != null ? { str: sheet.str } : {}),
    ...(sheet.dex != null ? { dex: sheet.dex } : {}),
    ...(sheet.con != null ? { con: sheet.con } : {}),
    ...(sheet.int != null ? { int: sheet.int } : {}),
    ...(sheet.wis != null ? { wis: sheet.wis } : {}),
    ...(sheet.cha != null ? { cha: sheet.cha } : {}),
    ...(sheet.color != null ? { color: sheet.color } : {}),
    ...(sheet.syncedAc != null ? { syncedAc: sheet.syncedAc } : {}),
    imageUrl: absolutizePublicUrl((row.image_url as string | null) ?? null),
    overrides: live.overrides ?? DEFAULT_OVERRIDES,
    conditions: live.conditions ?? [],
    ...(live.deathSaves ? { deathSaves: live.deathSaves } : {}),
    sharedNotes: (row.shared_notes as string | null) ?? "",
    ...readTimestamps(row),
  };
}

export function rowToCharacterSheet(row: Record<string, unknown>): StoredCharacterSheet {
  const sheet = readCharacterSheetState(row);
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: sheet.name,
    playerName: sheet.playerName,
    className: sheet.className,
    species: sheet.species,
    level: sheet.level,
    hpMax: sheet.hpMax,
    hpCurrent: sheet.hpCurrent,
    ac: sheet.ac,
    speed: sheet.speed,
    strScore: sheet.strScore,
    dexScore: sheet.dexScore,
    conScore: sheet.conScore,
    intScore: sheet.intScore,
    wisScore: sheet.wisScore,
    chaScore: sheet.chaScore,
    color: sheet.color,
    imageUrl: absolutizePublicUrl((row.image_url as string | null) ?? null),
    characterData: parseJson(row.character_data_json, null) as Record<string, unknown> | null,
    ...(sheet.deathSaves ? { deathSaves: sheet.deathSaves } : {}),
    sharedNotes: (row.shared_notes as string | null) ?? "",
    ...readTimestamps(row),
  };
}

export function rowToINpc(row: Record<string, unknown>): StoredINpc {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    monsterId: row.monster_id as string,
    name: row.name as string,
    label: (row.label as string | null) ?? null,
    friendly: Boolean(row.friendly),
    hpMax: row.hp_max as number,
    hpCurrent: row.hp_current as number,
    hpDetails: (row.hp_details as string | null) ?? null,
    ac: row.ac as number,
    acDetails: (row.ac_details as string | null) ?? null,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    ...readTimestamps(row),
  };
}

export function rowToNote(row: Record<string, unknown>): StoredNote {
  const note = readNoteState(row);
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: (row.adventure_id as string | null) ?? null,
    title: note.title,
    text: note.text,
    sort: row.sort as number,
    ...readTimestamps(row),
  };
}

export function rowToTreasure(row: Record<string, unknown>): StoredTreasure {
  const entry = readTreasureState(row);
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: (row.adventure_id as string | null) ?? null,
    source: entry.source,
    itemId: entry.itemId,
    name: entry.name,
    rarity: entry.rarity,
    type: entry.type,
    type_key: entry.type_key,
    attunement: entry.attunement,
    magic: entry.magic,
    text: entry.text,
    qty: entry.qty,
    sort: row.sort as number,
    ...readTimestamps(row),
  };
}

export function rowToPartyInventoryItem(row: Record<string, unknown>): StoredPartyInventoryItem {
  const item = readPartyInventoryItemState(row);
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    name: item.name,
    quantity: item.quantity,
    weight: item.weight,
    notes: item.notes,
    source: item.source,
    itemId: item.itemId,
    rarity: item.rarity,
    type: item.type,
    description: item.description,
    sort: row.sort as number,
    ...readTimestamps(row),
  };
}

export function rowToCondition(row: Record<string, unknown>): StoredCondition {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    key: row.key as string,
    name: row.name as string,
    ...(row.description != null ? { description: row.description as string } : {}),
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    ...readTimestamps(row),
  };
}

export function rowToEncounterActor(row: Record<string, unknown>): StoredEncounterActor {
  const snapshot = readEncounterActorSnapshot(row);
  const live = readEncounterActorLiveState(row);
  return {
    id: row.id as string,
    encounterId: row.encounter_id as string,
    baseType: row.base_type as StoredEncounterActorBaseType,
    baseId: row.base_id as string,
    name: snapshot.name,
    label: snapshot.label,
    initiative: live.initiative,
    friendly: snapshot.friendly,
    color: snapshot.color,
    hpCurrent: live.hpCurrent,
    hpMax: snapshot.hpMax,
    hpDetails: snapshot.hpDetails,
    ac: snapshot.ac,
    acDetails: snapshot.acDetails,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    usedReaction: live.usedReaction ?? false,
    usedLegendaryActions: live.usedLegendaryActions ?? 0,
    usedLegendaryResistances: live.usedLegendaryResistances ?? 0,
    overrides: live.overrides,
    conditions: live.conditions,
    ...(live.deathSaves ? { deathSaves: live.deathSaves } : {}),
    ...(live.usedSpellSlots ? { usedSpellSlots: live.usedSpellSlots } : {}),
    attackOverrides: snapshot.attackOverrides,
    ...readTimestamps(row),
  };
}
