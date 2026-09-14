/**
 * Normalizes a monster name for the A-Z jump bar: drops leading punctuation and a leading "the ",
 * so "The Abbot" files under A.
 *
 * Shared because the letter index is computed on the server (it needs the whole result set) while
 * the bar is rendered in the browser. If the two normalized differently, clicking a letter would
 * land on the wrong row.
 */
export function normalizeMonsterSortName(name: string): string {
  return String(name ?? "")
    .trim()
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/^the\s+/i, "")
    .trim();
}

/** The A-Z bucket a monster falls in, or null when its name doesn't start with a letter. */
export function monsterSortLetter(name: string): string | null {
  const first = normalizeMonsterSortName(name).charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : null;
}
