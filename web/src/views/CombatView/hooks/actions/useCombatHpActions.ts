import * as React from "react";
import { api } from "@/services/api";
import type { Combatant } from "@/domain/types/domain";
import { parsePositiveInt } from "@/views/CombatView/utils/combat";

function parseSignedDelta(
  input: string,
  defaultKind: "damage" | "heal"
): { kind: "damage" | "heal"; amount: number } {
  const raw = String(input ?? "").trim();
  if (!raw) return { kind: defaultKind, amount: 0 };

  // Sign override rules:
  //  - "+10" => heal 10
  //  - "-10" => damage 10
  //  - "10" => defaultKind 10
  const first = raw[0];
  const hasPlus = first === "+";
  const hasMinus = first === "-";
  const digits = hasPlus || hasMinus ? raw.slice(1) : raw;
  const amount = parsePositiveInt(digits);
  if (amount <= 0) return { kind: defaultKind, amount: 0 };
  if (hasPlus) return { kind: "heal", amount };
  if (hasMinus) return { kind: "damage", amount };
  return { kind: defaultKind, amount };
}

function normalizeHpMaxOverride(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Args = {
  encounterId: string | undefined;
  delta: string;
  setDelta: (v: string) => void;
  target: Combatant | null;
  refresh: () => Promise<void>;
};

export function useCombatHpActions({ encounterId, delta, setDelta, target, refresh }: Args) {
  const applyHpDelta = React.useCallback(
    async (defaultKind: "damage" | "heal") => {
      if (!encounterId || !target) return;
      const { kind, amount } = parseSignedDelta(delta, defaultKind);
      if (amount <= 0) return;

      const targetAny: any = target as any;
      const cur = targetAny.hpCurrent;
      const overrides = targetAny.overrides || null;
      const rawMax = targetAny.hpMax;

      const maxOverride = normalizeHpMaxOverride(overrides?.hpMaxOverride);
      const max = maxOverride ?? rawMax;
      const tempHp = Math.max(0, Number(overrides?.tempHp ?? 0) || 0);
      if (cur == null) return;

      let nextHp = cur;
      let nextTemp = tempHp;

      if (kind === "damage") {
        // Damage consumes temp HP first.
        const fromTemp = Math.min(nextTemp, amount);
        nextTemp -= fromTemp;
        const remaining = amount - fromTemp;
        nextHp = Math.max(0, nextHp - remaining);
      }
      if (kind === "heal") {
        if (max != null) nextHp = Math.min(max, nextHp + amount);
        else nextHp = nextHp + amount;
      }

      await api(`/api/encounters/${encounterId}/combatants/${targetAny.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hpCurrent: nextHp,
          overrides: {
            ...(overrides ?? { tempHp: 0, acBonus: 0, hpMaxOverride: null }),
            tempHp: nextTemp
          }
        })
      });
      await refresh();
      setDelta("");
    },
    [encounterId, target, delta, refresh, setDelta]
  );

  return { applyHpDelta };
}
