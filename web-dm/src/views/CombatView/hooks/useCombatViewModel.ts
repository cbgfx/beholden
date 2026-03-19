import * as React from "react";
import type { Combatant } from "@/domain/types/domain";
import { allHaveInitiative, orderByInitiative } from "@/views/CombatView/engine/CombatEngine";
import { useRosterMaps } from "@/views/CombatView/hooks/useRosterMaps";
import type { State } from "@/store/state";

type Args = {
  encounterId: string | undefined;
  state: State;
  targetId: string | null;
};

export function useCombatViewModel({ encounterId, state, targetId }: Args) {
  const encounter = React.useMemo(() => {
    if (!encounterId) return null;
    return state.encounters.find((e) => e.id === encounterId) ?? null;
  }, [encounterId, state.encounters]);

  // Store is the single source of truth.
  const combatants = React.useMemo(() => state.combatants, [state.combatants]);
  const orderedCombatants = React.useMemo(() => orderByInitiative(combatants) as Combatant[], [combatants]);
  const canNavigate = React.useMemo(() => allHaveInitiative(combatants), [combatants]);

  const target = React.useMemo(
    () => combatants.find((c) => c.id === targetId) ?? null,
    [combatants, targetId]
  );

  const { playersById, inpcsById } = useRosterMaps(state.players, state.inpcs);

  return {
    encounter,
    combatants,
    orderedCombatants,
    canNavigate,
    target,
    playersById,
    inpcsById
  };
}
