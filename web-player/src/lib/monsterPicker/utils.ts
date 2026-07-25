export function formatCr(raw: unknown): string {
  if (raw == null) return "?";
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return "?";
    if (s.includes("/")) return s;
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
  if (Math.abs(n - 0.125) < 1e-9) return "1/8";
  if (Math.abs(n - 0.25) < 1e-9) return "1/4";
  if (Math.abs(n - 0.5) < 1e-9) return "1/2";
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n);
}

