import * as React from "react";
import type { EncounterActor } from "@/domain/types/domain";
import { resolveCombatantDamage } from "@/views/CombatView/utils/polymorphDamage";
import { parseSignedHpDelta, resolveCombatantHealing } from "@/views/CombatView/utils/hpDelta";
import { putEncounterCombatant } from "@/services/encounterApi";
import { concentrationSaveDc } from "@beholden/shared/domain";

type Args = {
  encounterId: string | undefined;
  delta: string;
  setDelta: (v: string) => void;
  target: EncounterActor | null;
};

export function useCombatHpActions({ encounterId, delta, setDelta, target }: Args) {
  const [concentrationAlert, setConcentrationAlert] = React.useState<{ name: string; dc: number } | null>(null);

  const applyHpDelta = React.useCallback(
    async (defaultKind: "damage" | "heal", deltaOverride?: string) => {
      if (!encounterId || !target) return;
      const { kind, amount } = parseSignedHpDelta(deltaOverride ?? delta, defaultKind);
      if (amount <= 0) return;

      if (kind === "damage") {
        const resolved = resolveCombatantDamage(target, amount);
        if (!resolved) return;
        await putEncounterCombatant(encounterId, target.id, {
          hpCurrent: resolved.hpCurrent,
          overrides: resolved.overrides,
          ...(resolved.conditions ? { conditions: resolved.conditions } : {}),
        });
        setDelta("");

        if (amount > 0 && target.conditions?.some(c => c.key === "concentration")) {
          const dc = concentrationSaveDc(amount);
          setConcentrationAlert({ name: target.label || target.name, dc });
        }
        return;
      }

      const resolved = resolveCombatantHealing(target, amount);
      if (!resolved) return;

      await putEncounterCombatant(encounterId, target.id, {
        hpCurrent: resolved.hpCurrent,
        overrides: resolved.overrides,
      });
      setDelta("");
    },
    [encounterId, target, delta, setDelta]
  );

  return {
    applyHpDelta,
    concentrationAlert,
    dismissConcentrationAlert: () => setConcentrationAlert(null),
  };
}
