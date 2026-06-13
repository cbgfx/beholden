import React from "react";
import type { EncounterActor } from "@/domain/types/domain";
import { allHaveInitiative } from "@/views/CombatView/engine/CombatEngine";

export function useCombatOrderModel(args: { combatants: EncounterActor[]; activeId: string | null }) {
  const { combatants, activeId } = args;
  const hasCompleteInitiative = React.useMemo(() => allHaveInitiative(combatants), [combatants]);

  const activeIndex = React.useMemo(() => {
    if (!combatants.length) return 0;
    if (!hasCompleteInitiative) return 0;
    if (activeId) {
      const idx = combatants.findIndex((c) => c.id === activeId);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [combatants, activeId, hasCompleteInitiative]);

  const upcoming = React.useMemo(() => {
    if (!hasCompleteInitiative) return combatants;
    return combatants.slice(activeIndex);
  }, [combatants, activeIndex, hasCompleteInitiative]);

  const wrapped = React.useMemo(() => {
    if (!hasCompleteInitiative) return [];
    return combatants.slice(0, activeIndex);
  }, [combatants, activeIndex, hasCompleteInitiative]);

  return { activeIndex, upcoming, wrapped };
}
