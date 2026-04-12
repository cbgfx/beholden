import * as React from "react";
import { api, jsonInit } from "@/services/api";

type Args = {
  encounterId: string | undefined;
};

export function useCombatantPatchActions({ encounterId }: Args) {
  const updateCombatant = React.useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      if (!encounterId) return;
      await api(`/api/encounters/${encounterId}/combatants/${id}`, jsonInit("PUT", patch));
    },
    [encounterId]
  );

  return { updateCombatant };
}
