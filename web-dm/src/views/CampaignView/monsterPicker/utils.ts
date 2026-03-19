export function formatCr(raw: unknown): string {
  if (raw == null) return "?";
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return "?";
    // If the compendium already provides a fraction (e.g. "1/4"), preserve it.
    if (s.includes("/")) return s;
    // Try numeric conversion so "0.125", "0.25", "0.5" get the fraction treatment
   const n = Number(s);
   if (Number.isFinite(n)) {
     if (Math.abs(n - 0.125) < 1e-9) return "1/8";
     if (Math.abs(n - 0.25) < 1e-9) return "1/4";
     if (Math.abs(n - 0.5) < 1e-9) return "1/2";
   }
   return s;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return "?";
  // Common CR fractions.
  if (Math.abs(n - 0.125) < 1e-9) return "1/8";
  if (Math.abs(n - 0.25) < 1e-9) return "1/4";
  if (Math.abs(n - 0.5) < 1e-9) return "1/2";
  // Integers should render without trailing .0
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n);
}

export function parseCrNumber(cr: unknown): number {
  if (cr == null) return NaN;
  if (typeof cr === "number") return cr;
  const s = String(cr).trim();
  if (!s) return NaN;
  if (s.includes("/")) {
    const [a, b] = s.split("/").map((x) => Number(x));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return NaN;
    return a / b;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function parseLeadingNumberLoose(v: unknown): number {
  const s = String(v ?? "");
  const match = s.match(/-?\d+/);
  return match ? Number(match[0]) : NaN;
}
