import * as React from "react";
import type { StoreDispatch } from "./types";

type Args = {
  encounterId: string | undefined;
  round: number;
  dispatch: StoreDispatch;
};

export function useCombatDrawerActions({ encounterId, round, dispatch }: Args) {
  const onOpenOverrides = React.useCallback(
    (combatantId: string | null) =>
      combatantId && encounterId ? dispatch({ type: "openDrawer", drawer: { type: "combatantOverrides", encounterId, combatantId } }) : void 0,
    [dispatch, encounterId]
  );

  const onOpenConditions = React.useCallback(
    (combatantId: string | null, role: "active" | "target", activeIdForCaster: string | null) =>
      combatantId && encounterId
        ? dispatch({
            type: "openDrawer",
            drawer: { type: "combatantConditions", encounterId, combatantId, role, activeIdForCaster, currentRound: round }
          })
        : void 0,
    [dispatch, encounterId, round]
  );

  const onOpenPolymorph = React.useCallback(
    (combatantId: string | null, combatantName: string) =>
      combatantId && encounterId
        ? dispatch({
            type: "openDrawer",
            drawer: { type: "polymorphTransform", encounterId, combatantId, combatantName }
          })
        : void 0,
    [dispatch, encounterId]
  );

  return { onOpenOverrides, onOpenConditions, onOpenPolymorph };
}
