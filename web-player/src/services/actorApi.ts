import type { CharacterSheetDto, FlatCharacterSheetDto } from "@beholden/shared/api";
import { flattenCharacterSheetDto } from "@beholden/shared/api";
import { api, jsonInit } from "@/services/api";

export async function fetchMyCharacters(): Promise<FlatCharacterSheetDto[]> {
  return (await api<CharacterSheetDto[]>("/api/me/characters")).map(flattenCharacterSheetDto);
}

export async function fetchMyCharacter(id: string): Promise<FlatCharacterSheetDto> {
  return flattenCharacterSheetDto(await api<CharacterSheetDto>(`/api/me/characters/${id}`));
}

export async function updateMyCharacter(id: string, body: unknown): Promise<FlatCharacterSheetDto> {
  return flattenCharacterSheetDto(await api<CharacterSheetDto>(`/api/me/characters/${id}`, jsonInit("PUT", body)));
}

export async function createMyCharacter(body: unknown): Promise<FlatCharacterSheetDto> {
  return flattenCharacterSheetDto(await api<CharacterSheetDto>("/api/me/characters", jsonInit("POST", body)));
}
