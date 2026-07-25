import * as React from "react";
import type { EncounterActor } from "@/domain/types/domain";
import { fetchEncounterActors } from "@/services/actorApi";
import type { Action } from "@/store/actions";

type StoreDispatch = (action: Action) => void;

/**
 * Fetches combatants for an encounter and writes them into the store.
 * WS delta handling is consolidated in useAppWebSocket to avoid double-dispatch.
 */
export function useEncounterCombatants(encounterId: string | undefined, dispatch: StoreDispatch) {
  const refresh = React.useCallback(async () => {
    if (!encounterId) return;
    const rows = await fetchEncounterActors(encounterId);
    dispatch({ type: "setCombatants", combatants: rows as EncounterActor[] });
  }, [encounterId, dispatch]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { refresh };
}
