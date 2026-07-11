import * as React from "react";
import { putEncounterCombatant } from "@/services/encounterApi";
import type { EncounterActor } from "@/domain/types/domain";
import type { EncounterActorDto } from "@beholden/shared/api";
import { flattenEncounterActorDto } from "@beholden/shared/api";
import type { StoreDispatch } from "@/views/CombatView/hooks/actions/types";

type Args = {
  encounterId: string | undefined;
  combatants: EncounterActor[];
  dispatch: StoreDispatch;
  refresh: () => Promise<void>;
};

export function useCombatantPatchActions({ encounterId, combatants, dispatch, refresh }: Args) {
  const mutationVersionRef = React.useRef<Record<string, number>>({});

  const updateCombatant = React.useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      if (!encounterId) return;
      const snapshot = combatants.find((combatant) => combatant.id === id);
      if (!snapshot) return;
      const version = (mutationVersionRef.current[id] ?? 0) + 1;
      mutationVersionRef.current[id] = version;

      dispatch({
        type: "upsertCombatant",
        combatant: { ...snapshot, ...patch } as EncounterActor,
      });

      try {
        const dto = await putEncounterCombatant<EncounterActorDto>(encounterId, id, patch);
        if (mutationVersionRef.current[id] !== version) return;
        dispatch({
          type: "upsertCombatant",
          combatant: flattenEncounterActorDto(dto) as EncounterActor,
        });
      } catch (error) {
        if (mutationVersionRef.current[id] === version) {
          dispatch({ type: "upsertCombatant", combatant: snapshot });
          await refresh().catch(() => {});
        }
        throw error;
      }
    },
    [encounterId, combatants, dispatch, refresh]
  );

  return { updateCombatant };
}
