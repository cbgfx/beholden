/**
 * Dice expression evaluator.
 *
 * Supports standard NdM notation with additive/subtractive chaining:
 *   "d6"           → roll 1d6
 *   "2d6"          → roll 2d6, sum them
 *   "2d6+3"        → roll 2d6, sum, add 3
 *   "1d4+6d8+3d4"  → roll each group, sum all
 *   "-2d6+10"      → negate the 2d6 roll, add 10 (minimum result 0)
 *   "8"            → constant 8 (no dice, passthrough)
 *
 * Returns 0 for empty / unparseable expressions.
 * Result is always clamped to ≥ 0 (HP can't go negative from a dice roll alone).
 */
export function rollDiceExpr(expr: string): number {
  const raw = String(expr ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return 0;

  // Tokenise into signed groups.
  // Pattern matches (optional sign)(NdM | d6 | constant):
  //   [+-]?  optional leading sign
  //   (?:    followed by one of:
  //     [1-9]\d*d\d+   e.g. 2d6, 10d4
  //     d\d+           e.g. d6, d20  (implicit 1 die)
  //     \d+            e.g. 3, 10    (flat constant)
  //   )
  const TOKEN_RE = /[+-]?(?:[1-9]\d*d\d+|d\d+|\d+)/g;
  const tokens = raw.match(TOKEN_RE);
  if (!tokens) return 0;

  let total = 0;

  for (const token of tokens) {
    const sign = token[0] === "-" ? -1 : 1;
    const part = token.replace(/^[+-]/, "");

    if (part.includes("d")) {
      const dIdx = part.indexOf("d");
      const countStr = part.slice(0, dIdx);
      const sidesStr = part.slice(dIdx + 1);

      const count = countStr ? Math.max(0, Math.floor(Number(countStr))) : 1;
      const sides = Math.max(1, Math.floor(Number(sidesStr)));

      if (!Number.isFinite(count) || !Number.isFinite(sides)) continue;

      for (let i = 0; i < count; i++) {
        total += sign * (Math.floor(Math.random() * sides) + 1);
      }
    } else {
      const n = Number(part);
      if (Number.isFinite(n)) total += sign * Math.floor(n);
    }
  }

  return Math.max(0, total);
}

/**
 * Returns true when the string contains at least one dice term (NdM).
 * Used to decide whether to show roll preview vs. a plain number.
 */
export function hasDiceTerm(expr: string): boolean {
  return /\dd/i.test(String(expr ?? ""));
}
