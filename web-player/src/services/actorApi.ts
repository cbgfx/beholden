import type { CharacterSheetDto, FlatCharacterSheetDto } from "@beholden/shared/api";
import { flattenCharacterSheetDto } from "@beholden/shared/api";
import { api, jsonInit } from "@/services/api";

let myCharactersRequest: Promise<FlatCharacterSheetDto[]> | null = null;

export async function fetchMyCharacters(): Promise<FlatCharacterSheetDto[]> {
  if (myCharactersRequest) return myCharactersRequest;

  myCharactersRequest = api<CharacterSheetDto[]>("/api/me/characters")
    .then((characters) => characters.map(flattenCharacterSheetDto));
  try {
    return await myCharactersRequest;
  } finally {
    myCharactersRequest = null;
  }
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
