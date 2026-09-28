import { api, jsonInit } from "@/services/api";

export interface SpellLookupMatch {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  classes: string | null;
  text: string | null;
  rolls?: Array<{ effect?: string | string[] | null }>;
  check?: string | null;
}

interface SpellLookupResponseRow {
  query: string;
  match: SpellLookupMatch | null;
}

/** Fetches full spell records for a fixed list of spell names -- used for "Expanded Spell List"
 * style patron/subclass features (e.g. Warlock patrons), where a spell is added to a class's
 * spell list by name and won't necessarily match a `classes` search filter on its own (Burning
 * Hands isn't naturally a Warlock spell; The Fiend's Expanded Spell List adds it as one). Returns
 * [] for an empty `names` list so callers don't need to special-case that. */
export async function fetchSpellsByName(names: string[], ruleset: "5e" | "5.5e"): Promise<SpellLookupMatch[]> {
  if (names.length === 0) return [];
  const { rows } = await api<{ rows: SpellLookupResponseRow[] }>("/api/spells/lookup", jsonInit("POST", { names, includeText: true, ruleset }));
  return rows.map((row) => row.match).filter((match): match is SpellLookupMatch => match != null);
}

/** Merges extra spell matches (e.g. from `fetchSpellsByName`) into a base spell list, keyed by id
 * so a spell already reachable through the normal class list search isn't duplicated. */
export function mergeSpellsById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const seen = new Set(base.map((entry) => entry.id));
  return [...base, ...extra.filter((entry) => !seen.has(entry.id))];
}
