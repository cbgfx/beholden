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
  const sheet = parseJson<Partial<StoredCharacterSheetState>>(row.sheet_json, {});
  return {
    name: typeof sheet.name === "string" ? sheet.name : "",
    playerName: typeof sheet.playerName === "string" ? sheet.playerName : "",
    className: typeof sheet.className === "string" ? sheet.className : "",
    species: typeof sheet.species === "string" ? sheet.species : "",
    level: typeof sheet.level === "number" ? sheet.level : 1,
    hpMax: typeof sheet.hpMax === "number" ? sheet.hpMax : 0,
    hpCurrent: typeof sheet.hpCurrent === "number" ? sheet.hpCurrent : 0,
    ac: typeof sheet.ac === "number" ? sheet.ac : 10,
    speed: typeof sheet.speed === "number" ? sheet.speed : 30,
    strScore: sheet.strScore ?? null,
    dexScore: sheet.dexScore ?? null,
    conScore: sheet.conScore ?? null,
    intScore: sheet.intScore ?? null,
    wisScore: sheet.wisScore ?? null,
    chaScore: sheet.chaScore ?? null,
    color: typeof sheet.color === "string" || sheet.color === null ? sheet.color ?? null : null,
    ...(sheet.deathSaves ? { deathSaves: sheet.deathSaves } : {}),
  };
}

function readCampaignCharacterSheetState(
  row: Record<string, unknown>,
): StoredCampaignCharacterSheetState {
  const sheet = parseJson<Partial<StoredCampaignCharacterSheetState>>(row.sheet_json, {});
  return {
    playerName: typeof sheet.playerName === "string" ? sheet.playerName : "",
    characterName: typeof sheet.characterName === "string" ? sheet.characterName : "",
    class: typeof sheet.class === "string" ? sheet.class : "",
    species: typeof sheet.species === "string" ? sheet.species : "",
    level: typeof sheet.level === "number" ? sheet.level : 1,
    hpMax: typeof sheet.hpMax === "number" ? sheet.hpMax : 10,
    ac: typeof sheet.ac === "number" ? sheet.ac : 10,
    ...(typeof sheet.speed === "number" ? { speed: sheet.speed } : {}),
    ...(sheet.str != null ? { str: sheet.str } : {}),
    ...(sheet.dex != null ? { dex: sheet.dex } : {}),
    ...(sheet.con != null ? { con: sheet.con } : {}),
    ...(sheet.int != null ? { int: sheet.int } : {}),
    ...(sheet.wis != null ? { wis: sheet.wis } : {}),
    ...(sheet.cha != null ? { cha: sheet.cha } : {}),
    ...(typeof sheet.color === "string" || sheet.color === null ? { color: sheet.color ?? null } : {}),
    ...(typeof sheet.syncedAc === "number" ? { syncedAc: sheet.syncedAc } : {}),
  };
}

function readCampaignCharacterLiveState(
  row: Record<string, unknown>,
): StoredCampaignCharacterLiveState {
  const live = parseJson<Partial<StoredCampaignCharacterLiveState>>(row.live_json, {});
  return {
    hpCurrent: typeof live.hpCurrent === "number" ? live.hpCurrent : 0,
    overrides: live.overrides ?? DEFAULT_OVERRIDES,
    conditions: live.conditions ?? [],
    ...(live.deathSaves ? { deathSaves: live.deathSaves } : {}),
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
  const note = parseJson<Partial<StoredNoteState>>(row.note_json, {});
  return {
    title: typeof note.title === "string" ? note.title : "Note",
    text: typeof note.text === "string" ? note.text : "",
  };
}

function readTreasureState(row: Record<string, unknown>): StoredTreasureState {
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
