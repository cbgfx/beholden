import { rollDiceExpr } from "@/lib/dice";

export type HpDeltaKind = "damage" | "heal";

export interface ParsedHpDelta {
  amount: number;
  kind: HpDeltaKind;
  sign: "" | "+" | "-";
  expression: string;
}

export function parseCharacterHpDelta(input: string, defaultKind: HpDeltaKind): ParsedHpDelta {
  const raw = String(input ?? "").trim();
  const sign = raw.startsWith("+") ? "+" : raw.startsWith("-") ? "-" : "";
  const expression = sign ? raw.slice(1).trim() : raw;
  const amount = rollDiceExpr(expression);
  return {
    amount,
    kind: sign === "+" ? "heal" : sign === "-" ? "damage" : defaultKind,
    sign,
    expression,
  };
}
