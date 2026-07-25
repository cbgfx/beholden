/**
 * Dice/math expression evaluator for combat delta input.
 *
 * Supported examples:
 * - d6
 * - 2d6+3
 * - (2d6+3)/2
 * - 12/3
 * - 4x5 ("x" is treated as "*")
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
    for (let idx = 0; idx < c; idx += 1) {
      total += Math.floor(Math.random() * s) + 1;
    }
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

/**
 * Returns true when the string contains at least one dice term (NdM).
 */
export function hasDiceTerm(expr: string): boolean {
  return /(?:\d+d\d+|d\d+)/i.test(String(expr ?? ""));
}
