import { afterEach, describe, expect, it, vi } from "vitest";
import { rollDiceExpr, hasDiceTerm } from "@beholden/shared/domain";
import { evaluateDiceExpr } from "@beholden/shared/domain/dice";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("rollDiceExpr", () => {
  it("rejects dice sizes outside the 32-bit sampler and excessive roll counts", () => {
    expect(rollDiceExpr("d4294967297")).toBe(0);
    expect(rollDiceExpr("1000000000d1")).toBe(0);
    expect(rollDiceExpr("6000d1+6000d1")).toBe(0);
    expect(rollDiceExpr("10000d1")).toBe(10000);
    expect(rollDiceExpr("d4294967296")).toBeGreaterThanOrEqual(1);
  });

  it("rejects excessive nesting and input length without overflowing the stack", () => {
    expect(rollDiceExpr("(".repeat(1000) + "1" + ")".repeat(1000))).toBe(0);
    expect(rollDiceExpr("-".repeat(1000) + "1")).toBe(0);
    expect(rollDiceExpr("1+".repeat(3000) + "1")).toBe(0);
  });

  it("preserves calculator negatives and integer division without changing HP math", () => {
    expect(rollDiceExpr("2-5", { calculator: true })).toBe(-3);
    expect(rollDiceExpr("7/2*2", { calculator: true })).toBe(6);
    expect(rollDiceExpr("2-5")).toBe(0);
    expect(rollDiceExpr("7/2*2")).toBe(7);
  });
  it("rolls a flat constant unchanged", () => {
    expect(rollDiceExpr("8")).toBe(8);
  });

  it.each([
    ["d6", [0], 1], ["d6", [5], 6], ["3d6", [0, 1, 2], 6],
    ["1d4+6d8+3d4+2", [3, 7, 7, 7, 7, 7, 7, 3, 3, 3], 66],
  ] as const)("evaluates %s exactly with controlled random values", (formula, values, expected) => {
    let index = 0;
    vi.stubGlobal("crypto", { getRandomValues: (buffer: Uint32Array) => { buffer[0] = values[index++]; return buffer; } });
    expect(rollDiceExpr(formula)).toBe(expected); expect(index).toBe(values.length);
  });

  it("rejects biased samples before selecting a die face", () => {
    const values = [0xffff_ffff, 5]; let index = 0;
    vi.stubGlobal("crypto", { getRandomValues: (buffer: Uint32Array) => { buffer[0] = values[index++]; return buffer; } });
    expect(rollDiceExpr("d6")).toBe(6); expect(index).toBe(2);
  });

  it("supports both endpoints of the non-crypto fallback", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(1 - Number.EPSILON);
    expect(rollDiceExpr("d6")).toBe(1); expect(rollDiceExpr("d6")).toBe(6);
  });

  it("supports parentheses and multiplication/division", () => {
    expect(rollDiceExpr("(2+3)*2")).toBe(10);
    expect(rollDiceExpr("12/3")).toBe(4);
    expect(rollDiceExpr("4x5")).toBe(20);
  });

  it("negates a dice group and clamps the overall result to zero", () => {
    expect(rollDiceExpr("-2+1")).toBe(0);
  });

  it("tells an unreadable expression apart from a roll of 0", () => {
    expect(evaluateDiceExpr("2d6+", { calculator: true })).toBeNull();
    expect(evaluateDiceExpr("fireball", { calculator: true })).toBeNull();
    expect(evaluateDiceExpr("", { calculator: true })).toBeNull();
    expect(evaluateDiceExpr("3-3", { calculator: true })).toBe(0);
    expect(evaluateDiceExpr("d0")).toBeNull();
    expect(evaluateDiceExpr("2d0+1")).toBeNull();
    expect(rollDiceExpr("d0")).toBe(0);
  });

  it("returns 0 for empty or unparseable expressions", () => {
    expect(rollDiceExpr("")).toBe(0);
    expect(rollDiceExpr("   ")).toBe(0);
  });

  it("returns 0 rather than a partial result for trailing garbage", () => {
    expect(rollDiceExpr("5 banana")).toBe(0);
  });

  it("floors a fractional division result", () => {
    expect(rollDiceExpr("7/2")).toBe(3);
  });
});

describe("hasDiceTerm", () => {
  it("detects NdM and dM forms", () => {
    expect(hasDiceTerm("2d6")).toBe(true);
    expect(hasDiceTerm("d20")).toBe(true);
  });

  it("returns false for plain numbers and non-dice text", () => {
    expect(hasDiceTerm("8")).toBe(false);
    expect(hasDiceTerm("hexed")).toBe(false);
  });
});
