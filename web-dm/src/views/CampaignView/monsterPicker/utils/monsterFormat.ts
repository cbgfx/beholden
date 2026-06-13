// Helpers for dealing with the various monster JSON shapes we import.
// Keep these pure and reusable across the monster picker UI.

export function formatAcString(m: any): string {
  const raw = m?.raw_json ?? m;
  const acVal = raw?.ac ?? raw?.armor_class;
  if (acVal == null) return "";

  const first = Array.isArray(acVal) ? acVal[0] : acVal;
  if (typeof first === "string" || typeof first === "number") return String(first).trim();

  const v = first?.value ?? first?.ac ?? first?.armor_class;
  const note = first?.note ?? first?.type ?? first?.name;
  if (v == null) return "";
  return note ? `${String(v).trim()} (${String(note).trim()})` : String(v).trim();
}

export function formatHpString(m: any): string {
  const raw = m?.raw_json ?? m;
  const hpVal = raw?.hp ?? raw?.hit_points;
  if (hpVal == null) return "";

  if (typeof hpVal === "string" || typeof hpVal === "number") return String(hpVal).trim();

  const v = hpVal?.value;
  if (typeof v === "string" || typeof v === "number") return String(v).trim();

  const avg = hpVal?.average ?? hpVal?.avg;
  const formula = hpVal?.formula ?? hpVal?.roll;
  if (avg == null && formula == null) return "";
  if ((avg === 0 || String(avg) === "0") && !formula) return "";
  if (avg != null && formula) return `${String(avg).trim()} (${String(formula).trim()})`;
  return String(avg ?? formula).trim();
}
