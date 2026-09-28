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
 *   "4x5"            → "x"/"X"/"×" treated as "*", "÷" as "/", "−" (typographic minus) as "-"
 *   "8"              → constant 8 (no dice, passthrough)
 *
 * rollDiceExpr returns 0 (evaluateDiceExpr: null) for empty, unparseable, or
 * partially-parseable (trailing garbage) expressions -- deliberately strict, since a silently-wrong partial parse is
 * worse than a visible 0 for something that feeds HP math. Result is always
 * clamped to >= 0 for HP inputs. Calculator mode retains negative answers
 * and floors each division, matching the calculator's integer arithmetic.
 *
 * Each individual die roll uses crypto.getRandomValues with rejection
 * sampling (falling back to Math.random in non-crypto environments) to avoid
 * modulo bias -- this matters for fairness at a real table.
 */
export function rollDiceExpr(expr: string, options: { calculator?: boolean } = {}): number {
  return evaluateDiceExpr(expr, options) ?? 0;
}

/**
 * The same evaluation, but an expression that cannot be read comes back as null instead of 0.
 * The dice calculator needs the difference: a typo like "2d6+" must not look like a roll of 0.
 */
export function evaluateDiceExpr(expr: string, options: { calculator?: boolean } = {}): number | null {
  const raw = String(expr ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[x×]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-");
  // Bound work on the UI thread, including the 32-bit rejection sampler.
  if (!raw || raw.length > 4096) return null;

  let i = 0;
  let remainingDice = 10000;
  let depth = 0;

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
    // A die needs at least one side: "d0" is a typo, not a d1.
    if (sides < 1) return NaN;
    const s = Math.floor(sides);
    if (c > remainingDice || s > 0x1_0000_0000) return NaN;
    remainingDice -= c;
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
    if (++depth > 64) { depth--; return NaN; }
    try {
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
    } finally { depth--; }
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
        if (options.calculator) left = Math.floor(left);
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
  if (!Number.isFinite(value) || i < raw.length) return null;
  return options.calculator ? Math.floor(value) : Math.max(0, Math.floor(value));
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
 * What a dice or HP input field keeps as the user types: digits, "d" for dice, the operators the
 * evaluator understands (+ - * / x × ÷ and the typographic minus), parentheses, decimal points and
 * spaces. Every such field uses this one list, so an operator the evaluator accepts is never
 * stripped before it gets there - the player's HP box used to drop "/" and "*".
 */
export function sanitizeDiceInput(raw: string): string {
  return String(raw ?? "").replace(/[^0-9dD+\-−–*/xX×÷(). ]/g, "");
}

/**
 * Returns true when the string contains at least one dice term (NdM or dM).
 * Used to decide whether to show a roll preview vs. a plain number.
 */
export function hasDiceTerm(expr: string): boolean {
  return /(?:\d+d\d+|d\d+)/i.test(String(expr ?? ""));
}
