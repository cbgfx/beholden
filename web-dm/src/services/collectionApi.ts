import {
  flattenNoteDto,
  flattenTreasureDto,
  type FlatNoteDto,
  type FlatTreasureDto,
  type NoteDto,
  type TreasureDto,
} from "@beholden/shared/api";
import { api, jsonInit } from "@/services/api";

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

