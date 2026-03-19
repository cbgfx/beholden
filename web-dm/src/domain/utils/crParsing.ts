/**
 * Shared CR parsing utilities used by xp.ts and difficulty.ts
 */

export const toNumberOrNull = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, ]/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Parses a 5e-style CR value.
 *
 * Handles common formats safely:
 * - 0, 1, 2, 10, 12
 * - 1/8, 1/4, 1/2 (including with a leading "CR" prefix)
 * - "CR 1/2", "CR1/4", "challenge 2" etc.
 *
 * IMPORTANT: do NOT strip non-digits naively; "1/2" must remain 0.5 (not "12").
 */
export const parseCrToNumberOrNull = (cr: unknown): number | null => {
  if (cr == null) return null;
  if (typeof cr === "number" && Number.isFinite(cr)) return cr;

  const s = String(cr).trim();
  if (!s) return null;

  const frac = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac?.[1] && frac?.[2]) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }

  const num = s.match(/-?\d+(?:\.\d+)?/);
  if (num?.[0]) {
    const n = Number(num[0]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
};

/**
 * Given a numeric value and a record keyed by numeric strings,
 * returns the value whose key is numerically closest to `n`.
 */
export function findNearestValue<T>(n: number, table: Record<string, T>): T | null {
  const keys = Object.keys(table).map(Number).filter(Number.isFinite);
  if (!keys.length) return null;
  let best = keys[0];
  let bestDist = Math.abs(n - best);
  for (const k of keys) {
    const d = Math.abs(n - k);
    if (d < bestDist) { best = k; bestDist = d; }
  }
  const snapped = table[String(best)];
  return snapped !== undefined ? snapped : null;
}
