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
  if (trimmed.length > 2) return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return SCHOOL_MAP[trimmed.toUpperCase()] ?? trimmed;
}
