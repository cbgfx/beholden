import { api, jsonInit } from "@/services/api";

export const encounterPath = (encounterId: string, resource?: string): string =>
  resource ? `/api/encounters/${encounterId}/${resource}` : `/api/encounters/${encounterId}`;

export const encounterCombatantsPath = (encounterId: string, resource?: string): string =>
  encounterPath(encounterId, resource ? `combatants/${resource}` : "combatants");

export function putEncounter<T = unknown>(encounterId: string, payload: unknown): Promise<T> {
  return api<T>(encounterPath(encounterId), jsonInit("PUT", payload));
}

export function postEncounter<T = unknown>(encounterId: string, resource: string, payload?: unknown): Promise<T> {
  return api<T>(
    encounterPath(encounterId, resource),
    payload === undefined ? { method: "POST" } : jsonInit("POST", payload),
  );
}

export function deleteEncounterById<T = unknown>(encounterId: string): Promise<T> {
  return api<T>(encounterPath(encounterId), { method: "DELETE" });
}

export function putEncounterCombatant<T = unknown>(
  encounterId: string,
  combatantId: string,
  payload: unknown,
): Promise<T> {
  return api<T>(encounterCombatantsPath(encounterId, combatantId), jsonInit("PUT", payload));
}

export function deleteEncounterCombatant<T = unknown>(encounterId: string, combatantId: string): Promise<T> {
  return api<T>(encounterCombatantsPath(encounterId, combatantId), { method: "DELETE" });
}

export function postEncounterCombatants<T = unknown>(encounterId: string, resource: string, payload?: unknown): Promise<T> {
  return api<T>(
    encounterCombatantsPath(encounterId, resource),
    payload === undefined ? { method: "POST" } : jsonInit("POST", payload),
  );
}

export function fetchEncounterCombatState<T = unknown>(encounterId: string): Promise<T> {
  return api<T>(encounterPath(encounterId, "combatState"));
}

export function putEncounterCombatState<T = unknown>(
  encounterId: string,
  payload: { round: number; activeCombatantId: string | null },
): Promise<T> {
  return api<T>(encounterPath(encounterId, "combatState"), jsonInit("PUT", payload));
}
