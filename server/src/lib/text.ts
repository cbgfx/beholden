export function normalizeKey(s: unknown): string {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return asText(v[0]);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(obj, "#text")) return asText(obj["#text"]);
    if (Object.prototype.hasOwnProperty.call(obj, "_")) return asText(obj["_"]);
    if (Object.prototype.hasOwnProperty.call(obj, "text")) return asText(obj["text"]);
    if (Object.prototype.hasOwnProperty.call(obj, "value")) return asText(obj["value"]);
  }
  return "";
}

export function asArray<T = unknown>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
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

// Challenge Rating parsing must support fractional CRs from XML like "1/2" and "1/4".
// NOTE: Do NOT strip non-digits naively ("1/2" -> "12").
export function parseCrValue(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const frac = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }

  const num = s.match(/-?\d+(?:\.\d+)?/);
  if (num) {
    const n = Number(num[0]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}
