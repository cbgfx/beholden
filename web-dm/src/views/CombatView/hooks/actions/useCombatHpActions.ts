import * as React from "react";
import type { EncounterActor } from "@/domain/types/domain";
import { rollDiceExpr } from "@/views/CombatView/utils/dice";
import { resolveCombatantDamage } from "@/views/CombatView/utils/polymorphDamage";
import { putEncounterCombatant } from "@/services/encounterApi";

function parseSignedDelta(
  input: string,
  defaultKind: "damage" | "heal"
): { kind: "damage" | "heal"; amount: number } {
  const raw = String(input ?? "").trim();
  if (!raw) return { kind: defaultKind, amount: 0 };

  // Sign override rules (leading sign only; the rest is a dice expression):
  //  - "+2d6"  => heal (roll 2d6)
  //  - "-2d6"  => damage (roll 2d6)
  //  - "2d6"   => defaultKind (roll 2d6)
  //  - "+10"   => heal 10
  //  - "10"    => defaultKind 10
  const first = raw[0];
  const hasPlus = first === "+";
  const hasMinus = first === "-";
  const expr = hasPlus || hasMinus ? raw.slice(1) : raw;
  const amount = rollDiceExpr(expr);
  if (amount <= 0) return { kind: defaultKind, amount: 0 };
  if (hasPlus) return { kind: "heal", amount };
  if (hasMinus) return { kind: "damage", amount };
  return { kind: defaultKind, amount };
}

function normalizeHpMaxBonus(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Args = {
  encounterId: string | undefined;
  delta: string;
  setDelta: (v: string) => void;
  target: EncounterActor | null;
};

export function useCombatHpActions({ encounterId, delta, setDelta, target }: Args) {
  const [concentrationAlert, setConcentrationAlert] = React.useState<{ name: string; dc: number } | null>(null);

  const applyHpDelta = React.useCallback(
    async (defaultKind: "damage" | "heal") => {
      if (!encounterId || !target) return;
      const { kind, amount } = parseSignedDelta(delta, defaultKind);
      if (amount <= 0) return;

      const cur = target.hpCurrent;
      const overrides = target.overrides ?? null;
      const rawMax = target.hpMax;

      const hpMod = normalizeHpMaxBonus(overrides?.hpMaxBonus) ?? 0;
      const max = rawMax != null ? Math.max(1, Number(rawMax) + hpMod) : null;
      const tempHp = Math.max(0, Number(overrides.tempHp ?? 0) || 0);
      if (cur == null) return;

      let nextHp = cur;
      let nextTemp = tempHp;

      if (kind === "damage") {
        const resolved = resolveCombatantDamage(target, amount);
        if (!resolved) return;
        nextHp = resolved.hpCurrent;
        await putEncounterCombatant(encounterId, target.id, {
          hpCurrent: resolved.hpCurrent,
          overrides: resolved.overrides,
          ...(resolved.conditions ? { conditions: resolved.conditions } : {}),
        });
        setDelta("");

        if (amount > 0 && target.conditions?.some(c => c.key === "concentration")) {
          const dc = Math.max(10, Math.floor(amount / 2));
          setConcentrationAlert({ name: target.label || target.name, dc });
        }
        return;
      }
      if (kind === "heal") {
        if (max != null) nextHp = Math.min(max, nextHp + amount);
        else nextHp = nextHp + amount;
      }

      await putEncounterCombatant(encounterId, target.id, {
        hpCurrent: nextHp,
        overrides: {
          ...overrides,
          tempHp: nextTemp
        }
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
