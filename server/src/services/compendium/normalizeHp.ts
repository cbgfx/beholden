function avgFromDiceFormula(formula: unknown): number | null {
  if (!formula) return null;
  const s = String(formula).replace(/\s+/g, "").toLowerCase();
  const m = s.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const die = Number(m[2]);
  const mod = m[3] ? Number(m[3]) : 0;
  if (!Number.isFinite(n) || !Number.isFinite(die) || !Number.isFinite(mod) || n <= 0 || die <= 0) {
    return null;
  }
  const avg = n * ((die + 1) / 2) + mod;
  return Number.isFinite(avg) ? Math.floor(avg) : null;
}

export function normalizeHp(hpVal: unknown): unknown {
  if (hpVal == null) return hpVal;
  if (typeof hpVal !== "string") return hpVal;
  const s = hpVal.trim();
  if (!s) return s;

  const plain = s.replace(/<\/?[^>]+>/g, "").trim();

  const numMatch = plain.match(/-?\d+/);
  const parsed = numMatch ? Number(numMatch[0]) : null;
  const formulaMatch = plain.match(/\(([^)]+)\)/);
  const formula = formulaMatch ? formulaMatch[1] : null;
  const avg = avgFromDiceFormula(formula);

  if (avg != null && parsed != null && Number.isFinite(avg) && Number.isFinite(parsed)) {
    const parsedStr = String(parsed);
    const avgStr = String(avg);
    if (avg >= 10 && parsedStr.length < avgStr.length && avgStr.startsWith(parsedStr)) {
      return plain.replace(/-?\d+/, avgStr);
    }
  }

  return plain;
}
