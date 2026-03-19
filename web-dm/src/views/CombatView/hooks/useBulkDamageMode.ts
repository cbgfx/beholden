import * as React from "react";
import type { Combatant } from "@/domain/types/domain";
import { api } from "@/services/api";
import { rollDiceExpr } from "@/views/CombatView/utils/dice";

type Props = {
  encounterId: string | undefined;
  delta: string;
  setDelta: (v: string) => void;
  orderedCombatants: Combatant[];
  refresh: () => Promise<void>;
};

export function useBulkDamageMode({ encounterId, delta, setDelta, orderedCombatants, refresh }: Props) {
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
        if (c.hpCurrent == null) return;
        const overrides = c.overrides ?? {};
        const tempHp = Math.max(0, Number(overrides.tempHp ?? 0) || 0);
        const fromTemp = Math.min(tempHp, amount);
        const nextTemp = tempHp - fromTemp;
        const nextHp = Math.max(0, c.hpCurrent - (amount - fromTemp));
        await api(`/api/encounters/${encounterId}/combatants/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hpCurrent: nextHp, overrides: { ...overrides, tempHp: nextTemp } }),
        });
      })
    );
    await refresh();
    setDelta("");
    setBulkSelectedIds(new Set());
    setBulkMode(false);
  }, [encounterId, bulkSelectedIds, delta, orderedCombatants, refresh, setDelta]);

  return {
    bulkMode,
    bulkSelectedIds,
    toggleBulkMode,
    toggleBulkSelect,
    applyBulkDamage,
  };
}
