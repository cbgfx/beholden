import { api, jsonInit } from "@/services/api";

export const myCharacterPath = (id: string, resource?: string): string =>
  resource ? `/api/me/characters/${id}/${resource}` : `/api/me/characters/${id}`;

export function putMyCharacter<T = unknown>(id: string, payload: unknown): Promise<T> {
  return api<T>(myCharacterPath(id), jsonInit("PUT", payload));
}

export function patchMyCharacter<T = unknown>(id: string, resource: string, payload: unknown): Promise<T> {
  return api<T>(myCharacterPath(id, resource), jsonInit("PATCH", payload));
}
