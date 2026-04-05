import { getPolymorphCondition } from "@beholden/shared/domain";
import type { EncounterActor } from "@/domain/types/domain";

export function resolveCombatantDamage(combatant: Combatant, amount: number): {
  hpCurrent: number;
  overrides: Record<string, unknown>;
  conditions?: EncounterActor["conditions"];
} | null {
  if (combatant.hpCurrent == null) return null;

  const overrides = combatant.overrides ?? {};
  const tempHp = Math.max(0, Number(combatant.overrides?.tempHp ?? 0) || 0);
  const fromTemp = Math.min(tempHp, Math.max(0, amount));
  const nextTemp = tempHp - fromTemp;
  const remaining = Math.max(0, amount - fromTemp);
  const currentHp = Math.max(0, Number(combatant.hpCurrent ?? 0) || 0);
  const polymorph = getPolymorphCondition(combatant);

  if (!polymorph) {
    return {
      hpCurrent: Math.max(0, currentHp - remaining),
      overrides: { ...overrides, tempHp: nextTemp },
    };
  }

  if (remaining < currentHp) {
    return {
      hpCurrent: currentHp - remaining,
      overrides: { ...overrides, tempHp: nextTemp },
    };
  }

  const overflow = remaining - currentHp;
  const restoredHp = typeof polymorph.originalHpCurrent === "number"
    ? polymorph.originalHpCurrent
    : 0;
  const nextConditions = (combatant.conditions ?? []).filter((c) => c.key !== "polymorphed");
  return {
    hpCurrent: Math.max(0, restoredHp - overflow),
    overrides: {
      ...overrides,
      tempHp: nextTemp,
      acBonus: Number(polymorph.originalAcBonus ?? 0),
      hpMaxBonus: Number(polymorph.originalHpMaxBonus ?? 0),
    },
    conditions: nextConditions,
  };
}
