export type ConcentrationSpellLookupRow = {
  query: string;
  match: {
    concentration?: boolean;
  } | null;
};

export function concentrationSpellNamesFromLookup(rows: ConcentrationSpellLookupRow[]): string[] {
  const names = new Map<string, string>();

  for (const row of rows) {
    const name = String(row.query ?? "").trim();
    if (!name || row.match?.concentration !== true) continue;
    const key = name.toLocaleLowerCase();
    if (!names.has(key)) names.set(key, name);
  }

  return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}
