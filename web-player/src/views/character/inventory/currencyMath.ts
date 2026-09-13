export function evaluateCurrencyInput(input: string): number | null {
  const normalized = input.replace(/\s+/g, "");
  if (!/^\d+(?:[+-]\d+)*$/.test(normalized)) return null;

  const terms = normalized.match(/[+-]?\d+/g);
  if (!terms) return null;

  const total = terms.reduce((sum, term) => sum + Number(term), 0);
  return Number.isSafeInteger(total) ? Math.max(0, total) : null;
}
