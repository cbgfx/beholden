import type { ConditionInstance } from "@/views/character/CharacterSheetTypes";

export function toggleConditionInstance(
  current: readonly ConditionInstance[],
  key: string,
  condition?: ConditionInstance,
): ConditionInstance[] {
  const conditionIndex = condition ? current.indexOf(condition) : -1;
  if (conditionIndex >= 0) {
    return current.filter((_, index) => index !== conditionIndex);
  }
  if (current.some((entry) => entry.key === key)) {
    return current.filter((entry) => entry.key !== key);
  }
  return [...current, { key }];
}
