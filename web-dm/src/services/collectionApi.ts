import {
  flattenNoteDto,
  flattenTreasureDto,
  type FlatNoteDto,
  type FlatTreasureDto,
  type NoteDto,
  type TreasureDto,
} from "@beholden/shared/api";
import { api, jsonInit } from "@/services/api";

export type TreasureListRow = {
  id: string;
  campaignId: string;
  adventureId: string | null;
  encounterId?: string | null;
  itemId?: string | null;
  name: string;
  qty: number;
  rarity?: string | null;
  type?: string | null;
  attunement?: boolean;
  magic?: boolean;
  sort: number;
  createdAt?: number;
  updatedAt?: number;
};

export function treasureListRowToFlat(row: TreasureListRow): FlatTreasureDto {
  return {
    id: row.id,
    scope: row.encounterId ? "encounter" : row.adventureId ? "adventure" : "campaign",
    scopeId: row.encounterId ?? row.adventureId ?? row.campaignId,
    name: row.name,
    qty: row.qty,
    order: row.sort,
    ...(row.rarity ? { rarity: row.rarity } : {}),
    ...(row.type ? { type: row.type } : {}),
    ...(row.attunement ? { attunement: row.attunement } : {}),
    ...(row.magic ? { magic: row.magic } : {}),
    ...(row.itemId !== undefined ? { itemId: row.itemId } : {}),
    ...(row.createdAt !== undefined ? { createdAt: row.createdAt } : {}),
    ...(row.updatedAt !== undefined ? { updatedAt: row.updatedAt } : {}),
  };
}

// The list view sends the same note shape as everything else, with the text left out.
export function fetchCampaignNotesList(campaignId: string): Promise<FlatNoteDto[]> {
  return api<NoteDto[]>(`/api/campaigns/${campaignId}/notes?view=list`).then((rows) =>
    rows.map(flattenNoteDto),
  );
}

export function fetchAdventureNotesList(adventureId: string, signal?: AbortSignal): Promise<FlatNoteDto[]> {
  return api<NoteDto[]>(`/api/adventures/${adventureId}/notes?view=list`, { signal }).then((rows) =>
    rows.map(flattenNoteDto),
  );
}

export function fetchNoteById(noteId: string): Promise<FlatNoteDto> {
  return api<NoteDto>(`/api/notes/${noteId}`).then(flattenNoteDto);
}

export function fetchCampaignTreasureList(
  campaignId: string,
): Promise<FlatTreasureDto[]> {
  return api<TreasureListRow[]>(`/api/campaigns/${campaignId}/treasure?view=list`).then((rows) =>
    rows.map(treasureListRowToFlat),
  );
}

export function fetchAdventureTreasureList(
  adventureId: string,
  signal?: AbortSignal,
): Promise<FlatTreasureDto[]> {
  return api<TreasureListRow[]>(`/api/adventures/${adventureId}/treasure?view=list`, { signal }).then((rows) =>
    rows.map(treasureListRowToFlat),
  );
}

export function fetchEncounterTreasureList(
  encounterId: string,
): Promise<FlatTreasureDto[]> {
  return api<TreasureListRow[]>(`/api/encounters/${encounterId}/treasure?view=list`).then((rows) =>
    rows.map(treasureListRowToFlat),
  );
}

export function fetchTreasureById(treasureId: string): Promise<FlatTreasureDto> {
  return api<TreasureDto>(`/api/treasure/${treasureId}`).then(flattenTreasureDto);
}

export function createCampaignNote(campaignId: string, body: { title: string; text: string }) {
  return api<NoteDto>(`/api/campaigns/${campaignId}/notes`, jsonInit("POST", body)).then(
    flattenNoteDto,
  );
}

export function createAdventureNote(adventureId: string, body: { title: string; text: string }) {
  return api<NoteDto>(`/api/adventures/${adventureId}/notes`, jsonInit("POST", body)).then(
    flattenNoteDto,
  );
}
