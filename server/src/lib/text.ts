export function normalizeKey(s: unknown): string {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function parseLeadingInt(v: unknown): number | null {
  const s = String(v ?? "").trim();
  const m = s.match(/^(-?\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Recursively extract the first finite integer from a monster stat block value.
 * Handles: number, "17 (natural armor)", arrays, and nested objects (value/average/ac/…).
 */
export function extractLeadingNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v === "string") {
    const m = v.match(/\d+/);
    return m ? Number(m[0]) : null;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const n = extractLeadingNumber(item);
      if (n != null) return n;
    }
    return null;
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    for (const key of ["value", "ac", "armorClass", "average", "hp", "max", "#text", "_text"]) {
      const n = extractLeadingNumber(obj[key]);
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * Extract a note/detail string from a monster AC or HP stat block value.
 * e.g. "17 (natural armor)" → "natural armor", { note: "shield" } → "shield"
 */
export function extractDetails(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const m = v.match(/\(([^)]+)\)/);
    return m?.[1]?.trim() ?? null;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const d = extractDetails(item);
      if (d) return d;
    }
    return null;
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    return (obj.note ?? obj.type ?? obj.detail ?? obj.details ?? obj.formula ?? obj.roll ?? null) as string | null;
  }
  return null;
}

