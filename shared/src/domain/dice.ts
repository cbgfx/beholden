/**
 * Dice/math expression evaluator, shared by both apps' combat HP-delta inputs
 * and dice-calculator tools.
 *
 * Supported syntax:
 *   "d6"             → roll 1d6
 *   "2d6"            → roll 2d6, sum them
 *   "2d6+3"          → roll 2d6, sum, add 3
 *   "1d4+6d8+3d4"    → roll each group, sum all
 *   "-2d6+10"        → negate the 2d6 roll, add 10
 *   "(2d6+3)/2"      → parentheses, + - * / with standard precedence
 *   "4x5"            → "x"/"×" treated as "*"
 *   "8"              → constant 8 (no dice, passthrough)
 *
 * Returns 0 for empty, unparseable, or partially-parseable (trailing garbage)
 * expressions -- deliberately strict, since a silently-wrong partial parse is
 * worse than a visible 0 for something that feeds HP math. Result is always
 * clamped to >= 0.
 *
 * Each individual die roll uses crypto.getRandomValues with rejection
 * sampling (falling back to Math.random in non-crypto environments) to avoid
 * modulo bias -- this matters for fairness at a real table.
 */
export function rollDiceExpr(expr: string): number {
  const raw = String(expr ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[x×]/g, "*");
  if (!raw) return 0;

  let i = 0;

  const peek = () => raw[i] ?? "";
  const consume = () => raw[i++] ?? "";

  const parseNumber = (): number => {
    const start = i;
    while (/\d/.test(peek())) consume();
    if (peek() === ".") {
      consume();
      while (/\d/.test(peek())) consume();
    }
    const text = raw.slice(start, i);
    if (!text) return NaN;
    const n = Number(text);
    return Number.isFinite(n) ? n : NaN;
  };

  const rollDice = (count: number, sides: number): number => {
    if (!Number.isFinite(count) || !Number.isFinite(sides)) return NaN;
    const c = Math.max(0, Math.floor(count));
    const s = Math.max(1, Math.floor(sides));
    let total = 0;
    for (let idx = 0; idx < c; idx += 1) total += rollDie(s);
    return total;
  };

  const parsePrimary = (): number => {
    if (peek() === "(") {
      consume();
      const v = parseExpression();
      if (peek() !== ")") return NaN;
      consume();
      return v;
    }

    if (peek() === "d") {
      consume();
      const sides = parseNumber();
      if (!Number.isFinite(sides)) return NaN;
      return rollDice(1, sides);
    }

    const n = parseNumber();
    if (!Number.isFinite(n)) return NaN;

    // Dice literal: <count>d<sides>
    if (peek() === "d") {
      consume();
      const sides = parseNumber();
      if (!Number.isFinite(sides)) return NaN;
      return rollDice(n, sides);
    }
    return n;
  };

  const parseUnary = (): number => {
    if (peek() === "+") {
      consume();
      return parseUnary();
    }
    if (peek() === "-") {
      consume();
      const v = parseUnary();
      return Number.isFinite(v) ? -v : NaN;
    }
    return parsePrimary();
  };

  const parseTerm = (): number => {
    let left = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseUnary();
      if (!Number.isFinite(left) || !Number.isFinite(right)) return NaN;
      if (op === "*") left *= right;
      else {
        if (right === 0) return NaN;
        left /= right;
      }
    }
    return left;
  };

  const parseExpression = (): number => {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      if (!Number.isFinite(left) || !Number.isFinite(right)) return NaN;
      if (op === "+") left += right;
      else left -= right;
    }
    return left;
  };

  const value = parseExpression();
  if (!Number.isFinite(value) || i < raw.length) return 0;
  return Math.max(0, Math.floor(value));
}

function rollDie(sides: number): number {
  const boundedSides = Math.max(1, Math.floor(Number(sides) || 1));
  if (boundedSides <= 1) return 1;
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi?.getRandomValues) {
    // Rejection-sampling to avoid modulo bias.
    const maxUint = 0x1_0000_0000;
    const limit = Math.floor(maxUint / boundedSides) * boundedSides;
    const buf = new Uint32Array(1);
    let value = 0;
    do {
      cryptoApi.getRandomValues(buf);
      value = buf[0] ?? 0;
    } while (value >= limit);
    return (value % boundedSides) + 1;
  }
  return Math.floor(Math.random() * boundedSides) + 1;
}

/**
 * Returns true when the string contains at least one dice term (NdM or dM).
 * Used to decide whether to show a roll preview vs. a plain number.
 */
export function hasDiceTerm(expr: string): boolean {
  return /(?:\d+d\d+|d\d+)/i.test(String(expr ?? ""));
}
