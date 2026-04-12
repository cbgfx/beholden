import * as React from "react";
import type { EncounterActor } from "@/domain/types/domain";
import { rollDiceExpr } from "@/views/CombatView/utils/dice";
import { resolveCombatantDamage } from "@/views/CombatView/utils/polymorphDamage";
import { putEncounterCombatant } from "@/services/encounterApi";

type Props = {
  encounterId: string | undefined;
  delta: string;
  setDelta: (v: string) => void;
  orderedCombatants: EncounterActor[];
};

export function useBulkDamageMode({ encounterId, delta, setDelta, orderedCombatants }: Props) {
  const [bulkMode, setBulkMode] = React.useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = React.useState<Set<string>>(new Set());

  const toggleBulkMode = React.useCallback(() => {
    setBulkMode((prev) => {
      if (prev) setBulkSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleBulkSelect = React.useCallback((id: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const applyBulkDamage = React.useCallback(async () => {
    if (!encounterId || bulkSelectedIds.size === 0 || !delta.trim()) return;
    const amount = rollDiceExpr(delta.trim());
    if (amount <= 0) return;
    const targets = orderedCombatants.filter((c) => bulkSelectedIds.has(c.id));
    await Promise.all(
      targets.map(async (c) => {
        const resolved = resolveCombatantDamage(c, amount);
        if (!resolved) return;
        await putEncounterCombatant(encounterId, c.id, {
          hpCurrent: resolved.hpCurrent,
          overrides: resolved.overrides,
          ...(resolved.conditions ? { conditions: resolved.conditions } : {}),
        });
      })
    );
    setDelta("");
    setBulkSelectedIds(new Set());
    setBulkMode(false);
  }, [encounterId, bulkSelectedIds, delta, orderedCombatants, setDelta]);

  return {
    bulkMode,
    bulkSelectedIds,
    toggleBulkMode,
    toggleBulkSelect,
    applyBulkDamage,
  };
}
