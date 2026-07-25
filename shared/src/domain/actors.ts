export type SharedAbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type SharedConditionInstance = {
  key: string;
  casterId?: string | null;
  /** Ability whose checks are disadvantaged by Hex. Only applies when key is "hexed". */
  hexAbility?: SharedAbilityKey;
  /** Identifies a specific concentration session — lets a dependent condition (e.g. Hexed, Marked)
   * be tied to the exact casting it came from, not just its caster. */
  concentrationId?: string | null;
  [k: string]: unknown;
};

export interface SharedPolymorphCondition extends SharedConditionInstance {
  key: "polymorphed";
  polymorphName?: string;
  polymorphMonsterId?: string | null;
  originalAcBonus?: number;
  originalHpMaxBonus?: number;
  originalHpCurrent?: number | null;
}

export interface SharedDeathSaves {
  success: number;
  fail: number;
}

export interface SharedAbilityScoreOverrides {
  str?: number | undefined;
  dex?: number | undefined;
  con?: number | undefined;
  int?: number | undefined;
  wis?: number | undefined;
  cha?: number | undefined;
}

export interface SharedCombatOverrides {
  tempHp: number;
  acBonus: number;
  hpMaxBonus: number;
  inspiration?: boolean;
  abilityScores?: SharedAbilityScoreOverrides | undefined;
}

export function isPolymorphCondition(condition: SharedConditionInstance | null | undefined): condition is SharedPolymorphCondition {
  return condition?.key === "polymorphed";
}

export function getPolymorphCondition(
  conditions: readonly SharedConditionInstance[] | null | undefined
): SharedPolymorphCondition | null {
  const condition = (conditions ?? []).find(isPolymorphCondition);
  return condition ?? null;
}

export interface SharedDamageableActor {
  hpCurrent: number | null | undefined;
  overrides: SharedCombatOverrides | null | undefined;
  conditions?: readonly SharedConditionInstance[] | null;
}

export interface SharedHealableActor {
  hpCurrent: number | null | undefined;
  hpMax: number | null | undefined;
  overrides: SharedCombatOverrides | null | undefined;
}

export interface ResolvedHpChange {
  hpCurrent: number;
  overrides: SharedCombatOverrides;
  conditions?: SharedConditionInstance[];
}

/**
 * Authoritative damage resolution: temp HP absorbs damage before real HP does, and a
 * polymorphed creature reverts (rather than dying) once damage exceeds its temporary form's HP.
 * Callers on both server and client should resolve damage through this single implementation —
 * computing it independently client-side and persisting the result invites a race where a
 * concurrent temp-HP change (e.g. a player granting themselves temp HP) isn't reflected in the
 * numbers actually saved.
 */
export function resolveActorDamage(actor: SharedDamageableActor, amount: number): ResolvedHpChange | null {
  if (actor.hpCurrent == null || amount <= 0) return null;

  const overrides = actor.overrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
  const tempHp = Math.max(0, Number(overrides.tempHp ?? 0) || 0);
  const fromTemp = Math.min(tempHp, Math.max(0, amount));
  const nextTemp = tempHp - fromTemp;
  const remaining = Math.max(0, amount - fromTemp);
  const currentHp = Math.max(0, Number(actor.hpCurrent ?? 0) || 0);
  const polymorph = getPolymorphCondition(actor.conditions);

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
  const restoredHp = typeof polymorph.originalHpCurrent === "number" ? polymorph.originalHpCurrent : 0;
  const nextConditions = (actor.conditions ?? []).filter((condition) => condition.key !== "polymorphed");
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

/** Authoritative healing resolution: clamps to (base max + any hpMaxBonus override). */
export function resolveActorHealing(actor: SharedHealableActor, amount: number): ResolvedHpChange | null {
  if (actor.hpCurrent == null || amount <= 0) return null;

  const overrides = actor.overrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
  const hpMaxBonus = Number(overrides.hpMaxBonus ?? 0);
  const normalizedBonus = Number.isFinite(hpMaxBonus) ? hpMaxBonus : 0;
  const max = actor.hpMax == null ? null : Math.max(1, Number(actor.hpMax) + normalizedBonus);
  const hpCurrent = max == null
    ? actor.hpCurrent + amount
    : Math.min(max, actor.hpCurrent + amount);

  return {
    hpCurrent,
    overrides: { ...overrides, tempHp: Math.max(0, Number(overrides.tempHp ?? 0) || 0) },
  };
}
