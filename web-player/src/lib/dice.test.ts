import { describe, expect, it } from "vitest";
import { rollDiceExpr, hasDiceTerm } from "@beholden/shared/domain";

describe("rollDiceExpr", () => {
  it("rolls a flat constant unchanged", () => {
    expect(rollDiceExpr("8")).toBe(8);
  });

  it("rolls a single die within its range", () => {
    for (let i = 0; i < 50; i++) {
      const n = rollDiceExpr("d6");
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it("sums multiple dice of the same size within range", () => {
    for (let i = 0; i < 50; i++) {
      const n = rollDiceExpr("3d6");
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(18);
    }
  });

  it("sums additive dice groups of different sizes plus a constant", () => {
    for (let i = 0; i < 50; i++) {
      const n = rollDiceExpr("1d4+6d8+3d4+2");
      expect(n).toBeGreaterThanOrEqual(1 + 6 + 3 + 2);
      expect(n).toBeLessThanOrEqual(4 + 48 + 12 + 2);
    }
  });

  it("supports parentheses and multiplication/division", () => {
    expect(rollDiceExpr("(2+3)*2")).toBe(10);
    expect(rollDiceExpr("12/3")).toBe(4);
    expect(rollDiceExpr("4x5")).toBe(20);
  });

  it("negates a dice group and clamps the overall result to zero", () => {
    expect(rollDiceExpr("-2+1")).toBe(0);
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
