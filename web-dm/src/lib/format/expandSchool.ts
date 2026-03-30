/** Maps spell school abbreviations from XML imports to full names. */
const SCHOOL_MAP: Record<string, string> = {
  A:  "Abjuration",
  C:  "Conjuration",
  D:  "Divination",
  EN: "Enchantment",
  EV: "Evocation",
  I:  "Illusion",
  N:  "Necromancy",
  T:  "Transmutation",
};

export function expandSchool(s: string | null | undefined): string {
  if (!s) return "";
  const trimmed = s.trim();
  // Already a full name — return title-cased
  if (trimmed.length > 2) return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return SCHOOL_MAP[trimmed.toUpperCase()] ?? trimmed;
}
