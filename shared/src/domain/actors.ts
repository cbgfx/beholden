export type SharedConditionInstance = {
  key: string;
  casterId?: string | null;
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
  abilityScores?: SharedAbilityScoreOverrides;
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
