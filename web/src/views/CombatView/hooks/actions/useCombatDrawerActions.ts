import * as React from "react";
import type { StoreDispatch } from "./types";

type Args = {
  encounterId: string | undefined;
  dispatch: StoreDispatch;
};

export function useCombatDrawerActions({ encounterId, dispatch }: Args) {
  const onOpenOverrides = React.useCallback(
    (combatantId: string | null) =>
      combatantId ? dispatch({ type: "openDrawer", drawer: { type: "combatantOverrides", encounterId, combatantId } }) : void 0,
    [dispatch, encounterId]
  );

  const onOpenConditions = React.useCallback(
    (combatantId: string | null, role: "active" | "target", activeIdForCaster: string | null) =>
      combatantId
        ? dispatch({
            type: "openDrawer",
            drawer: { type: "combatantConditions", encounterId, combatantId, role, activeIdForCaster }
          })
        : void 0,
    [dispatch, encounterId]
  );

  return { onOpenOverrides, onOpenConditions };
}
