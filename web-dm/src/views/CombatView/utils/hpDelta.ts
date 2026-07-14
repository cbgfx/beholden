import type { EncounterActor } from "@/domain/types/domain";
import { rollDiceExpr } from "@/views/CombatView/utils/dice";
import { resolveActorHealing } from "@beholden/shared/domain";

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

/**
 * Client-side preview only — see the comment on `resolveCombatantDamage` in polymorphDamage.ts.
 * The server recomputes this authoritatively from fresh data.
 */
export function resolveCombatantHealing(
  combatant: EncounterActor,
  amount: number
): { hpCurrent: number; overrides: EncounterActor["overrides"] } | null {
  return resolveActorHealing(combatant, amount);
}
