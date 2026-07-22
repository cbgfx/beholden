import type { AbilKey } from "@/views/character/CharacterSheetTypes";

export type MulticlassAbilityRequirement = AbilKey | { any: AbilKey[] } | { all: AbilKey[] };

export function multiclassRequirementMet(
  requirement: MulticlassAbilityRequirement | null | undefined,
  minimum: number | null | undefined,
  scores: Partial<Record<AbilKey, number | null>>,
): boolean {
  if (!requirement) return true;
  const threshold = minimum ?? 13;
  const meets = (ability: AbilKey) => (scores[ability] ?? 0) >= threshold;
  if (typeof requirement === "string") return meets(requirement);
  if ("all" in requirement) return requirement.all.every(meets);
  return requirement.any.some(meets);
}

export function describeMulticlassRequirement(requirement: MulticlassAbilityRequirement, minimum = 13): string {
  const label = (ability: AbilKey) => ability.toUpperCase();
  if (typeof requirement === "string") return `${label(requirement)} ${minimum}`;
  if ("all" in requirement) return `${requirement.all.map(label).join(" and ")} ${minimum}`;
  return `${requirement.any.map(label).join(" or ")} ${minimum}`;
}
