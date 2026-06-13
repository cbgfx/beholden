import type { EncounterActor } from "@/domain/types/domain";
import { rollDiceExpr } from "@/views/CombatView/utils/dice";

export type HpDelta = { kind: "damage" | "heal"; amount: number };

export function parseSignedHpDelta(
  input: string,
  defaultKind: HpDelta["kind"]
): HpDelta {
  const raw = String(input ?? "").trim();
  if (!raw) return { kind: defaultKind, amount: 0 };

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

export function resolveCombatantHealing(
  combatant: EncounterActor,
  amount: number
): { hpCurrent: number; overrides: EncounterActor["overrides"] } | null {
  if (combatant.hpCurrent == null || amount <= 0) return null;

  const overrides = combatant.overrides ?? {};
  const hpMaxBonus = Number(overrides.hpMaxBonus ?? 0);
  const normalizedBonus = Number.isFinite(hpMaxBonus) ? hpMaxBonus : 0;
  const max = combatant.hpMax == null
    ? null
    : Math.max(1, Number(combatant.hpMax) + normalizedBonus);
  const hpCurrent = max == null
    ? combatant.hpCurrent + amount
    : Math.min(max, combatant.hpCurrent + amount);

  return {
    hpCurrent,
    overrides: {
      ...overrides,
      tempHp: Math.max(0, Number(overrides.tempHp ?? 0) || 0),
    },
  };
}
