import * as React from "react";
import type { EncounterActor } from "@/domain/types/domain";
import { resolveCombatantDamage } from "@/views/CombatView/utils/polymorphDamage";
import { parseSignedHpDelta, resolveCombatantHealing } from "@/views/CombatView/utils/hpDelta";
import { concentrationSaveDc } from "@beholden/shared/domain";

type Args = {
  encounterId: string | undefined;
  delta: string;
  setDelta: (v: string) => void;
  target: EncounterActor | null;
  updateCombatant: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

export function useCombatHpActions({ encounterId, delta, setDelta, target, updateCombatant }: Args) {
  const [concentrationAlert, setConcentrationAlert] = React.useState<{ name: string; dc: number } | null>(null);

  const applyHpDelta = React.useCallback(
    async (defaultKind: "damage" | "heal", deltaOverride?: string) => {
      if (!encounterId || !target) return;
      const { kind, amount } = parseSignedHpDelta(deltaOverride ?? delta, defaultKind);
      if (amount <= 0) return;

      if (kind === "damage") {
        // resolved is only an optimistic preview for instant UI feedback — the server resolves
        // hpDelta authoritatively against its own freshly-read state (see combat.ts), so a
        // concurrent change (e.g. someone else granting temp HP right now) can't get clobbered.
        const resolved = resolveCombatantDamage(target, amount);
        if (!resolved) return;
        await updateCombatant(target.id, {
          hpCurrent: resolved.hpCurrent,
          overrides: resolved.overrides,
          ...(resolved.conditions ? { conditions: resolved.conditions } : {}),
          hpDelta: { kind: "damage", amount },
        });
        setDelta("");

        if (amount > 0 && resolved.hpCurrent > 0 && target.conditions?.some(c => c.key === "concentration")) {
          const dc = concentrationSaveDc(amount);
          setConcentrationAlert({ name: target.label || target.name, dc });
        }
        return;
      }

      const resolved = resolveCombatantHealing(target, amount);
      if (!resolved) return;

      await updateCombatant(target.id, {
        hpCurrent: resolved.hpCurrent,
        overrides: resolved.overrides,
        hpDelta: { kind: "heal", amount },
      });
      setDelta("");
    },
    [encounterId, target, delta, setDelta, updateCombatant]
  );

  return {
    applyHpDelta,
    concentrationAlert,
    dismissConcentrationAlert: () => setConcentrationAlert(null),
  };
}
