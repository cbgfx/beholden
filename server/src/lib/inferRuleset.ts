// server/src/lib/inferRuleset.ts
// Shared helper used by compendium routes and XML import.

export type Ruleset = "5.5e";

export function inferRuleset(...values: Array<unknown>): Ruleset {
  void values;
  return "5.5e";
}
