export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type FeatPrerequisite = string | number | {
  level?: number;
  ability?: { any: AbilityKey[]; min?: number } | Array<{ any: AbilityKey[]; min?: number }>;
  class?: string;
  feature?: "spellcasting" | "fighting_style";
  training?: "martial_weapon" | "heavy_weapon" | "light_armor" | "medium_armor" | "heavy_armor" | "shield";
  feat?: string;
  anyOfFeats?: string[];
  noneOfFeats?: string[];
  any?: Array<{ feat?: string; feature?: "spellcasting" | "fighting_style"; training?: string }>;
};

export interface FeatEligibilityFacts {
  level: number;
  classNames: string[];
  scores: Partial<Record<AbilityKey, number | null | undefined>>;
  featIds: string[];
  features: string[];
  armor: string[];
  weapons: string[];
  spellcaster: boolean;
}

const has = (values: string[], expected: string) => values.some((value) => value.trim().toLowerCase() === expected.toLowerCase());

function simpleRequirementMet(requirement: { feat?: string; feature?: string; training?: string }, facts: FeatEligibilityFacts): boolean {
  if (requirement.feat) return facts.featIds.includes(requirement.feat);
  if (requirement.feature === "spellcasting") return facts.spellcaster;
  if (requirement.feature === "fighting_style") return facts.features.some((feature) => feature === "fighting_style" || feature.endsWith("_fighting_style"));
  if (requirement.training === "martial_weapon") return has(facts.weapons, "Martial Weapons");
  if (requirement.training === "heavy_weapon") return has(facts.weapons, "Heavy Weapons") || has(facts.weapons, "Martial Weapons");
  const armor = { light_armor: "Light Armor", medium_armor: "Medium Armor", heavy_armor: "Heavy Armor", shield: "Shields" }[String(requirement.training)];
  return !requirement.training || Boolean(armor && has(facts.armor, armor));
}

export function featEligibilityProblem(prerequisite: FeatPrerequisite | null | undefined, facts: FeatEligibilityFacts): string | null {
  if (prerequisite == null) return null;
  // Legacy 2014 prerequisites sometimes exist only as rules prose. Preserve and display them,
  // but do not pretend the eligibility engine can prove them from structured character facts.
  if (typeof prerequisite === "string") return null;
  const rule = typeof prerequisite === "number" ? { level: prerequisite } : prerequisite;
  if (rule.level && facts.level < rule.level) return `requires character level ${rule.level}`;
  if (rule.ability) {
    const groups = Array.isArray(rule.ability) ? rule.ability : [rule.ability];
    if (!groups.every((group) => group.any.some((ability) => Number(facts.scores[ability] ?? 0) >= (group.min ?? 13)))) return "has unmet ability score prerequisites";
  }
  if (rule.class && !facts.classNames.some((name) => name.toLowerCase().includes(rule.class!.toLowerCase()))) return `requires the ${rule.class} class`;
  if (!simpleRequirementMet(rule, facts)) return "has an unmet feature or training prerequisite";
  if (rule.anyOfFeats && !rule.anyOfFeats.some((id) => facts.featIds.includes(id))) return "requires another feat";
  if (rule.noneOfFeats?.some((id) => facts.featIds.includes(id))) return "conflicts with another selected feat";
  if (rule.any && !rule.any.some((alternative) => simpleRequirementMet(alternative, facts))) return "has no satisfied alternative prerequisite";
  return null;
}
