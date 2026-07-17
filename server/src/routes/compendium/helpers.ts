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
