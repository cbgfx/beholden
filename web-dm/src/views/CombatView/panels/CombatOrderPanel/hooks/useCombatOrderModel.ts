import React from "react";
import type { Combatant } from "@/domain/types/domain";

export function useCombatOrderModel(args: { combatants: Combatant[]; activeId: string | null }) {
  const { combatants, activeId } = args;

  const activeIndex = React.useMemo(() => {
    if (!combatants.length) return 0;
    if (activeId) {
      const idx = combatants.findIndex((c) => c.id === activeId);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [combatants, activeId]);

  const upcoming = React.useMemo(() => combatants.slice(activeIndex), [combatants, activeIndex]);
  const wrapped = React.useMemo(() => combatants.slice(0, activeIndex), [combatants, activeIndex]);

  return { activeIndex, upcoming, wrapped };
}
