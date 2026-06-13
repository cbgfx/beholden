import * as React from "react";
import type { EncounterActor } from "@/domain/types/domain";
import { fetchEncounterActor, fetchEncounterActors } from "@/services/actorApi";
import { useWs } from "@/services/ws";
import type { Action } from "@/store/actions";
import { flattenEncounterActorDto, type EncounterActorDto } from "@beholden/shared/api";

type StoreDispatch = (action: Action) => void;

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
    const rows = await fetchEncounterActors(encounterId);
    dispatch({ type: "setCombatants", combatants: rows as EncounterActor[] });
  }, [encounterId, dispatch]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  useWs((msg) => {
    if (msg.type !== "encounter:combatantsDelta") return;
    const p = msg.payload;
    if (!p || typeof p !== "object") return;
    const payload = p as {
      encounterId?: unknown;
      action?: unknown;
      combatantId?: unknown;
      combatant?: EncounterActorDto;
    };
    const encId = payload.encounterId;
    if (typeof encId !== "string" || encId !== encounterId) return;

    const action = payload.action;
    if (action === "delete" && typeof payload.combatantId === "string") {
      dispatch({ type: "removeCombatant", combatantId: payload.combatantId });
      return;
    }
    if (action === "upsert" && typeof payload.combatantId === "string") {
      if (payload.combatant && typeof payload.combatant === "object") {
        dispatch({ type: "upsertCombatant", combatant: flattenEncounterActorDto(payload.combatant) as EncounterActor });
        return;
      }
      const combatantId = payload.combatantId;
      void (async () => {
        try {
          const row = await fetchEncounterActor(encId, combatantId);
          dispatch({ type: "upsertCombatant", combatant: row as EncounterActor });
        } catch {
          // If the row changed again or was removed before fetch resolves, wait for the next delta.
        }
      })();
      return;
    }
    void refresh();
  });

  return { refresh };
}
