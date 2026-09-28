import { api, jsonInit } from "@/services/api";

const myCharacterPath = (id: string, resource?: string): string =>
  resource ? `/api/me/characters/${id}/${resource}` : `/api/me/characters/${id}`;

export function putMyCharacter<T = unknown>(id: string, payload: unknown): Promise<T> {
  return api<T>(myCharacterPath(id), jsonInit("PUT", payload));
}

export function patchMyCharacter<T = unknown>(id: string, resource: string, payload: unknown): Promise<T> {
  return api<T>(myCharacterPath(id, resource), jsonInit("PATCH", payload));
}

// Shared notes are written one note at a time. The whole list used to be sent on every change,
// so a DM editing a note while the player added another meant one of the two was lost.

export function upsertMySharedNote(id: string, noteId: string, note: { title: string; text: string }): Promise<unknown> {
  return api(`${myCharacterPath(id, "sharedNotes")}/${noteId}`, jsonInit("PUT", note));
}

export function deleteMySharedNote(id: string, noteId: string): Promise<unknown> {
  return api(`${myCharacterPath(id, "sharedNotes")}/${noteId}`, { method: "DELETE" });
}

export function reorderMySharedNotes(id: string, ids: string[]): Promise<unknown> {
  return api(`${myCharacterPath(id, "sharedNotes")}/reorder`, jsonInit("POST", { ids }));
}
