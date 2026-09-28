import type { EncounterActor } from "@/domain/types/domain";
import { rollDiceExpr } from "@/views/CombatView/utils/dice";
import { parseHpDelta, resolveActorHealing } from "@beholden/shared/domain";

export type HpDelta = { kind: "damage" | "heal"; amount: number };

export function parseSignedHpDelta(
  input: string,
  defaultKind: HpDelta["kind"]
): HpDelta {
  const parsed = parseHpDelta(input, defaultKind, rollDiceExpr);
  return parsed.amount > 0
    ? { kind: parsed.kind, amount: parsed.amount }
    : { kind: defaultKind, amount: 0 };
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
