import * as React from "react";
import type { Combatant } from "@/domain/types/domain";
import { allHaveInitiative, orderCombatants } from "@/views/CombatView/utils/combat";
import { useRosterMaps } from "@/views/CombatView/hooks/useRosterMaps";

type StateLike = {
  combatants?: Combatant[];
  players?: any[];
  encounters?: any[];
  inpcs?: any[];
  [k: string]: unknown;
};

type Args = {
  encounterId: string | undefined;
  state: StateLike;
  targetId: string | null;
};

export function useCombatViewModel({ encounterId, state, targetId }: Args) {
  const encounter = React.useMemo(() => {
    if (!encounterId) return null as any;
    return (state as any).encounters?.find((e: any) => e.id === encounterId) ?? null;
  }, [encounterId, (state as any).encounters]);

  // Store is the single source of truth.
  const combatants = React.useMemo(() => ((state as any).combatants ?? []) as Combatant[], [
    (state as any).combatants
  ]);

  const orderedCombatants = React.useMemo(() => orderCombatants(combatants), [combatants]);
  const canNavigate = React.useMemo(() => allHaveInitiative(combatants), [combatants]);

  const target = React.useMemo(
    () => combatants.find((c: any) => (c as any).id === targetId) ?? null,
    [combatants, targetId]
  );

  const { playersById, inpcsById } = useRosterMaps((state as any).players, (state as any).inpcs);

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
