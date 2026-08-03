import { rollDiceExpr } from "@/lib/dice";
import { parseHpDelta, type HpDeltaKind, type ParsedHpDelta } from "@beholden/shared/domain";

export type { HpDeltaKind, ParsedHpDelta };

export function parseCharacterHpDelta(input: string, defaultKind: HpDeltaKind): ParsedHpDelta {
  return parseHpDelta(input, defaultKind, rollDiceExpr);
}
