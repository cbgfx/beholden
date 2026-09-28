// Shared lookup normalization for compendium routes. Editor payload schemas live in the
// Grand category schemas; this file deliberately contains no parallel editor model.
export function normalizeLookupName(value: string): string {
  return value
    .trim()
    .replace(/\s*\[[^\]]+\]\s*$/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

/** For a ruleset-scoped compendium category (composite (id, ruleset) primary key). */
export function parseRulesetFilter(value: unknown): "5e" | "5.5e" | null {
  return value === "5e" || value === "5.5e" ? value : null;
}
