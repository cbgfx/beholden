export type SplitNumberAndDetail = { numText: string; num: number | null; detail: string };

/** Splits the first integer from a string, with any remaining text returned as `detail`. */
export function splitLeadingNumberAndDetail(raw: unknown): SplitNumberAndDetail {
  const s = String(raw ?? "").trim();
  if (!s) return { numText: "", num: null, detail: "" };

  const m = s.match(/-?\d+/);
  if (!m || m.index == null) return { numText: "", num: null, detail: s };

  const numText = m[0];
  const num = Number(numText);
  const after = s.slice(m.index + m[0].length).trim();

  // Drop leading punctuation.
  const detail = after.replace(/^[:\-–—]+\s*/, "").trim();
  return { numText, num: Number.isFinite(num) ? num : null, detail };
}

export function parseLeadingNumber(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  const m = s.match(/-?\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
