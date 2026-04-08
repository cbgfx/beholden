import * as React from "react";
import { api } from "@/services/api";

type Args = {
  encounterId: string | undefined;
  refresh: () => Promise<void>;
};

export function useCombatantPatchActions({ encounterId, refresh }: Args) {
  const updateCombatant = React.useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      if (!encounterId) return;
      await api(`/api/encounters/${encounterId}/combatants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      await refresh();
    },
    [encounterId, refresh]
  );

  return { updateCombatant };
}
