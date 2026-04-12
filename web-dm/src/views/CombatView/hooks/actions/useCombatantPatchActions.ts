import * as React from "react";
import { putEncounterCombatant } from "@/services/encounterApi";

type Args = {
  encounterId: string | undefined;
};

export function useCombatantPatchActions({ encounterId }: Args) {
  const updateCombatant = React.useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      if (!encounterId) return;
      await putEncounterCombatant(encounterId, id, patch);
    },
    [encounterId]
  );

  return { updateCombatant };
}
