import { describe, expect, it } from "vitest";
import { appearanceCssVariables, backgroundPatternImage, normalizeAppearance } from "./characterAppearance";

describe("character appearance", () => {
  it("normalizes missing and out-of-range stored values", () => {
    expect(normalizeAppearance(undefined)).toMatchObject({
      backgroundColor: "#0d1525",
      panelBackgroundColor: "#1a2231",
      textColor: "#e8edf5",
      backgroundPattern: "none",
      backgroundIntensity: 0,
    });
    expect(normalizeAppearance({ backgroundColor: "#112233", backgroundPattern: "stars", backgroundIntensity: 140 })).toMatchObject({
      backgroundColor: "#112233",
      backgroundPattern: "stars",
      backgroundIntensity: 100,
    });
  });

  it("falls back on malformed color values instead of storing invalid CSS", () => {
    expect(normalizeAppearance({ backgroundColor: "not-a-color", textColor: "red" })).toMatchObject({
      backgroundColor: "#0d1525",
      textColor: "#e8edf5",
    });
  });

  it("builds panel variables and only renders visible patterns", () => {
    expect((appearanceCssVariables({ panelBackgroundColor: "#223344" }) as Record<string, unknown>)["--character-panel-bg"]).toBe("#223344");
    expect(backgroundPatternImage("none", "#fff", 100)).toBeUndefined();
    expect(backgroundPatternImage("grid", "#abcdef", 50)).toContain("linear-gradient");
  });
});
