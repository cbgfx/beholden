import {
  flattenNoteDto,
  flattenTreasureDto,
  type FlatNoteDto,
  type FlatTreasureDto,
  type NoteDto,
  type TreasureDto,
} from "@beholden/shared/api";
import { api, jsonInit } from "@/services/api";

type NoteListRow = {
  id: string;
  campaignId: string;
  adventureId: string | null;
  title: string;
  sort: number;
  createdAt?: number;
  updatedAt?: number;
};

type TreasureListRow = {
  id: string;
  campaignId: string;
  adventureId: string | null;
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

function noteListRowToFlat(row: NoteListRow): FlatNoteDto {
  return {
    id: row.id,
    scope: row.adventureId ? "adventure" : "campaign",
    scopeId: row.adventureId ?? row.campaignId,
    title: row.title,
    text: "",
    order: row.sort,
    ...(row.createdAt !== undefined ? { createdAt: row.createdAt } : {}),
    ...(row.updatedAt !== undefined ? { updatedAt: row.updatedAt } : {}),
  };
}

function treasureListRowToFlat(row: TreasureListRow): FlatTreasureDto {
  return {
    id: row.id,
    scope: row.adventureId ? "adventure" : "campaign",
    scopeId: row.adventureId ?? row.campaignId,
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

export function fetchCampaignNotes(campaignId: string): Promise<FlatNoteDto[]> {
  return api<NoteDto[]>(`/api/campaigns/${campaignId}/notes`).then((rows) =>
    rows.map(flattenNoteDto),
  );
}

export function fetchAdventureNotes(adventureId: string): Promise<FlatNoteDto[]> {
  return api<NoteDto[]>(`/api/adventures/${adventureId}/notes`).then((rows) =>
    rows.map(flattenNoteDto),
  );
}

export function fetchCampaignNotesList(campaignId: string): Promise<FlatNoteDto[]> {
  return api<NoteListRow[]>(`/api/campaigns/${campaignId}/notes?view=list`).then((rows) =>
    rows.map(noteListRowToFlat),
  );
}

export function fetchAdventureNotesList(adventureId: string): Promise<FlatNoteDto[]> {
  return api<NoteListRow[]>(`/api/adventures/${adventureId}/notes?view=list`).then((rows) =>
    rows.map(noteListRowToFlat),
  );
}

export function fetchNoteById(noteId: string): Promise<FlatNoteDto> {
  return api<NoteDto>(`/api/notes/${noteId}`).then(flattenNoteDto);
}

export function fetchCampaignTreasure(
  campaignId: string,
): Promise<FlatTreasureDto[]> {
  return api<TreasureDto[]>(`/api/campaigns/${campaignId}/treasure`).then((rows) =>
    rows.map(flattenTreasureDto),
  );
}

export function fetchAdventureTreasure(
  adventureId: string,
): Promise<FlatTreasureDto[]> {
  return api<TreasureDto[]>(`/api/adventures/${adventureId}/treasure`).then((rows) =>
    rows.map(flattenTreasureDto),
  );
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
): Promise<FlatTreasureDto[]> {
  return api<TreasureListRow[]>(`/api/adventures/${adventureId}/treasure?view=list`).then((rows) =>
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
