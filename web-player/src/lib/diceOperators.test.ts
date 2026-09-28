import { describe, expect, it } from "vitest";
import { evaluateDiceExpr } from "@beholden/shared/domain/dice";
import { sanitizeDiceInput } from "@/lib/dice";
import { parseCharacterHpDelta } from "@/views/character/combat/CharacterHpDelta";

// Every operator, through the same path each field takes: what survives typing (sanitizeDiceInput,
// shared by the player's HUD and the DM's combat box), then the HP parse or the calculator.
// The player's HUD used to strip "/" and "*" as they were typed, so 12/2 applied 122.
const typed = (text: string) => sanitizeDiceInput(text);

describe("every operator survives typing and evaluates", () => {
  const cases: Array<[string, number]> = [
    ["7+5", 12],
    ["20-8", 12],
    ["3*4", 12],
    ["3x4", 12],
    ["3X4", 12],
    ["3×4", 12],
    ["24/2", 12],
    ["24÷2", 12],
    ["(20+4)/2", 12],
    ["2 * (3 + 3)", 12],
    ["20−8", 12], // typographic minus
  ];

  for (const [input, expected] of cases) {
    it(`${input} = ${expected} in the HP box and the calculator`, () => {
      expect(typed(input)).toBe(input);
      expect(parseCharacterHpDelta(typed(input), "damage").amount).toBe(expected);
      expect(evaluateDiceExpr(typed(input), { calculator: true })).toBe(expected);
    });
  }

  it("a leading sign still picks heal or damage, whatever follows", () => {
    expect(parseCharacterHpDelta(typed("+24/2"), "damage")).toMatchObject({ kind: "heal", amount: 12 });
    expect(parseCharacterHpDelta(typed("-3x4"), "heal")).toMatchObject({ kind: "damage", amount: 12 });
    expect(parseCharacterHpDelta(typed("−3*4"), "heal")).toMatchObject({ kind: "damage", amount: 12 });
  });

  it("dice mix with every operator", () => {
    const halved = parseCharacterHpDelta(typed("2d6/2"), "damage").amount;
    expect(halved).toBeGreaterThanOrEqual(1);
    expect(halved).toBeLessThanOrEqual(6);
    const doubled = evaluateDiceExpr(typed("1d4x2"), { calculator: true })!;
    expect([2, 4, 6, 8]).toContain(doubled);
  });

  it("strips only what the evaluator cannot use", () => {
    expect(typed("12/2 fire damage")).toBe("12/2  d");
    expect(typed("abc")).toBe("");
  });
});
