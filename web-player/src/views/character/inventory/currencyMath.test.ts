import { describe, expect, it } from "vitest";
import { evaluateCurrencyInput } from "./currencyMath";

describe("evaluateCurrencyInput", () => {
  it("evaluates inline addition and subtraction", () => {
    expect(evaluateCurrencyInput("125-12+5")).toBe(118);
    expect(evaluateCurrencyInput("0 + 25")).toBe(25);
  });

  it("clamps currency at zero", () => {
    expect(evaluateCurrencyInput("0-12")).toBe(0);
    expect(evaluateCurrencyInput("5-12")).toBe(0);
  });

  it("rejects invalid or unsafe expressions", () => {
    expect(evaluateCurrencyInput("" )).toBeNull();
    expect(evaluateCurrencyInput("12*2")).toBeNull();
    expect(evaluateCurrencyInput("12+")).toBeNull();
    expect(evaluateCurrencyInput("9007199254740992+1")).toBeNull();
  });
});
