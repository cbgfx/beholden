// server/src/lib/dbConverters.ts
// Row → domain object converters, shared across all route files.

import { DEFAULT_OVERRIDES } from "./defaults.js";
import { absolutizePublicUrl } from "./publicUrl.js";
import {
  normalizeCharacterSheetForRead,
  normalizeCharacterSheetForStorage,
} from "./characterSheetNormalization.js";
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

export { normalizeCharacterSheetForStorage };

function readTimestamps(row: Record<string, unknown>) {
  return {
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

function readVersionedImageUrl(row: Record<string, unknown>): string | null {
  const url = absolutizePublicUrl((row.image_url as string | null) ?? null);
  if (!url) return null;
  const version = typeof row.image_updated_at === "number" ? row.image_updated_at : 0;
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}

export function cleanStoredImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  try {
    const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
    const parsed = new URL(raw, "http://beholden.local");
    parsed.searchParams.delete("v");
    const query = parsed.searchParams.toString();
    const localValue = `${parsed.pathname}${query ? `?${query}` : ""}${parsed.hash}`;
    if (!absolute || /^\/(?:campaign|player|character)-images\//.test(parsed.pathname)) return localValue;
    return `${parsed.origin}${localValue}`;
  } catch {
    return raw.replace(/([?&])v=[^&#]*(&?)/g, (_match, prefix: string, suffix: string) => (
      prefix === "?" && suffix ? "?" : suffix ? "&" : ""
    ));
  }
}

function readCharacterSheetState(row: Record<string, unknown>): StoredCharacterSheetState {
  const deathSaves =
    typeof row.death_saves_success === "number" && typeof row.death_saves_fail === "number"
      ? {
          success: Math.max(0, Math.min(3, Math.floor(row.death_saves_success))),
          fail: Math.max(0, Math.min(3, Math.floor(row.death_saves_fail))),
        }
      : undefined;
  return {
    name: typeof row.name === "string" ? row.name : "",
    playerName: typeof row.player_name === "string" ? row.player_name : "",
    className: typeof row.class_name === "string" ? row.class_name : "",
    species: typeof row.species === "string" ? row.species : "",
    level: typeof row.level === "number" ? row.level : 1,
    hpMax: typeof row.hp_max === "number" ? row.hp_max : 0,
    hpCurrent: typeof row.hp_current === "number" ? row.hp_current : 0,
    ac: typeof row.ac === "number" ? row.ac : 10,
    speed: typeof row.speed === "number" ? row.speed : 30,
    strScore: typeof row.str_score === "number" ? row.str_score : null,
    dexScore: typeof row.dex_score === "number" ? row.dex_score : null,
    conScore: typeof row.con_score === "number" ? row.con_score : null,
    intScore: typeof row.int_score === "number" ? row.int_score : null,
    wisScore: typeof row.wis_score === "number" ? row.wis_score : null,
    chaScore: typeof row.cha_score === "number" ? row.cha_score : null,
    color: typeof row.color === "string" || row.color === null ? (row.color as string | null) ?? null : null,
    ...(deathSaves ? { deathSaves } : {}),
  };
}

function readCampaignCharacterSheetState(
  row: Record<string, unknown>,
): StoredCampaignCharacterSheetState {
  return {
    playerName: typeof row.player_name === "string" ? row.player_name : "",
    characterName: typeof row.character_name === "string" ? row.character_name : "",
    class: typeof row.class_name === "string" ? row.class_name : "",
    species: typeof row.species === "string" ? row.species : "",
    level: typeof row.level === "number" ? row.level : 1,
    hpMax: typeof row.hp_max === "number" ? row.hp_max : 10,
    ac: typeof row.ac === "number" ? row.ac : 10,
    ...(typeof row.speed === "number" ? { speed: row.speed } : {}),
    ...(typeof row.str === "number" ? { str: row.str } : {}),
    ...(typeof row.dex === "number" ? { dex: row.dex } : {}),
    ...(typeof row.con === "number" ? { con: row.con } : {}),
    ...(typeof row.int === "number" ? { int: row.int } : {}),
    ...(typeof row.wis === "number" ? { wis: row.wis } : {}),
    ...(typeof row.cha === "number" ? { cha: row.cha } : {}),
    ...(typeof row.color === "string" || row.color === null ? { color: (row.color as string | null) ?? null } : {}),
    ...(typeof row.synced_ac === "number" && row.synced_ac > 0 ? { syncedAc: row.synced_ac } : {}),
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

function titleFromNoteText(text: string | null): string | null {
  if (!text) return null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const title = (heading?.[1] ?? line).trim();
    return title || null;
  }
  return null;
}

export function displayNoteTitle(titleValue: unknown, textValue: unknown): string {
  const title = typeof titleValue === "string" ? titleValue : "Note";
  const text = typeof textValue === "string" ? textValue : "";
  const inferredTitle = titleFromNoteText(text);
  return title === "Note" && inferredTitle ? inferredTitle : title || "Note";
}

function readNoteState(row: Record<string, unknown>): StoredNoteState {
  const text = typeof row.text === "string" ? row.text : "";
  return {
    title: displayNoteTitle(row.title, text),
    text,
  };
}

function readTreasureState(row: Record<string, unknown>): StoredTreasureState {
  return {
    source: row.source === "custom" ? "custom" : row.source === "compendium" ? "compendium" : "custom",
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

function readPartyInventoryItemState(row: Record<string, unknown>): StoredPartyInventoryItemState {
  return {
    name: typeof row.name === "string" ? row.name : "New Item",
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

export function rowToUser(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    isAdmin: Boolean(row.is_admin),
    lastLoginAt: typeof row.last_login_at === "number" ? row.last_login_at : null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCampaign(row: Record<string, unknown>): StoredCampaign {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string | null) ?? null,
    imageUrl: readVersionedImageUrl(row),
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
    imageUrl: readVersionedImageUrl(row),
    overrides: live.overrides ?? DEFAULT_OVERRIDES,
    conditions: live.conditions ?? [],
    ...(live.deathSaves ? { deathSaves: live.deathSaves } : {}),
    sharedNotes: (row.shared_notes as string | null) ?? "",
    ...readTimestamps(row),
  };
}

export function rowToCharacterSheet(row: Record<string, unknown>): StoredCharacterSheet {
  const storedSheet = readCharacterSheetState(row);
  const characterData = parseJson(row.character_data_json, null) as Record<string, unknown> | null;
  const { sheet, characterData: normalizedCharacterData } =
    normalizeCharacterSheetForRead(storedSheet, characterData);
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
    imageUrl: readVersionedImageUrl(row),
    characterData: normalizedCharacterData,
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
    encounterId: (row.encounter_id as string | null) ?? null,
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
