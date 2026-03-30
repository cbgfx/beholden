import React from "react";
import type { Combatant } from "@/domain/types/domain";
import {
  CONDITION_DEFS,
  conditionLabel,
  buildRosterById,
  type ConditionInstance,
} from "@/domain/conditions";

type Role = "active" | "target";

export function useCombatantConditions(args: {
  selected: Combatant | null;
  role: Role;
  roster: Combatant[];
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  const { selected, role, roster, onUpdate } = args;

  const allowedConditionKeys = React.useMemo(() => {
    if (role === "active") return new Set<string>(["concentration", "invisible"]);
    if (role === "target") {
      const s = new Set<string>(CONDITION_DEFS.map((c) => c.key));
      s.delete("concentration");
      return s;
    }
    return new Set<string>(CONDITION_DEFS.map((c) => c.key));
  }, [role]);

  const rosterById = React.useMemo(() => buildRosterById(roster ?? []), [roster]);

  const selectedConditions: ConditionInstance[] = React.useMemo(() => {
    const raw = selected?.conditions ?? [];
    if (!Array.isArray(raw)) return [];
    return raw.map((c) => ({
      key: String(c.key),
      casterId: c?.casterId != null ? String(c.casterId) : null,
    }));
  }, [selected?.id, selected?.conditions]);

  const commitConditions = React.useCallback(
    (next: ConditionInstance[]) => {
      if (!selected) return;
      onUpdate({ conditions: next });
    },
    [selected, onUpdate]
  );

  const removeConditionAt = React.useCallback(
    (index: number) => {
      const next = [...selectedConditions];
      next.splice(index, 1);
      commitConditions(next);
    },
    [selectedConditions, commitConditions]
  );

  return {
    CONDITIONS: CONDITION_DEFS,
    conditionLabel,
    allowedConditionKeys,
    rosterById,
    selectedConditions,
    removeConditionAt,
    commitConditions,
  };
}
