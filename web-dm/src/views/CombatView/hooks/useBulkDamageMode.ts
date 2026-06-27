import * as React from "react";
import type { EncounterActor } from "@/domain/types/domain";
import { resolveCombatantDamage } from "@/views/CombatView/utils/polymorphDamage";
import { parseSignedHpDelta, resolveCombatantHealing } from "@/views/CombatView/utils/hpDelta";
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

  const applyBulkHpDelta = React.useCallback(async (defaultKind: "damage" | "heal", deltaOverride?: string) => {
    const resolvedDelta = deltaOverride ?? delta;
    if (!encounterId || bulkSelectedIds.size === 0 || !resolvedDelta.trim()) return;
    const { kind, amount } = parseSignedHpDelta(resolvedDelta, defaultKind);
    if (amount <= 0) return;
    const targets = orderedCombatants.filter((c) => bulkSelectedIds.has(c.id));
    await Promise.all(
      targets.map(async (c) => {
        const resolved = kind === "heal"
          ? resolveCombatantHealing(c, amount)
          : resolveCombatantDamage(c, amount);
        if (!resolved) return;
        await putEncounterCombatant(encounterId, c.id, {
          hpCurrent: resolved.hpCurrent,
          overrides: resolved.overrides,
          ...("conditions" in resolved && resolved.conditions ? { conditions: resolved.conditions } : {}),
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
    applyBulkHpDelta,
  };
}
