export type HpDeltaKind = "damage" | "heal";

export interface ParsedHpDelta {
  amount: number;
  kind: HpDeltaKind;
  sign: "" | "+" | "-";
  expression: string;
}

/** Parse the sign semantics shared by character-sheet and combat HP controls. */
export function parseHpDelta(
  input: string,
  defaultKind: HpDeltaKind,
  evaluate: (expression: string) => number,
): ParsedHpDelta {
  const raw = String(input ?? "").trim();
  const sign = raw.startsWith("+") ? "+" : raw.startsWith("-") ? "-" : "";
  const expression = sign ? raw.slice(1).trim() : raw;
  return {
    amount: expression ? evaluate(expression) : 0,
    kind: sign === "+" ? "heal" : sign === "-" ? "damage" : defaultKind,
    sign,
    expression,
  };
}
