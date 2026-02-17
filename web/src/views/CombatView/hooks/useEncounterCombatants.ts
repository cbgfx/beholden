import * as React from "react";
import type { Combatant } from "@/domain/types/domain";
import { api } from "@/services/api";
import { useWs } from "@/services/ws";

type StoreDispatch = (action: any) => void;

/**
 * View-layer orchestration hook.
 * - Fetches combatants for an encounter and writes them into the store.
 * - Subscribes to WS updates to keep the store fresh.
 *
 * CombatView should treat the store as the single source of truth; this hook does not keep a local roster copy.
 */
export function useEncounterCombatants(encounterId: string | undefined, dispatch: StoreDispatch) {
  const refresh = React.useCallback(async () => {
    if (!encounterId) return;
    const rows = await api<Combatant[]>(`/api/encounters/${encounterId}/combatants`);
    dispatch({ type: "setCombatants", combatants: rows });
  }, [encounterId, dispatch]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  useWs((msg) => {
    if (msg.type === "encounter:combatantsChanged" && msg.payload?.encounterId === encounterId) refresh();
  });

  return { refresh };
}
