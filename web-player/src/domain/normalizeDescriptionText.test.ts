import { describe, expect, it } from "vitest";
import { normalizeDescriptionText } from "@beholden/shared/domain";

describe("normalizeDescriptionText", () => {
  it("rejoins tab-indented PDF line wraps", () => {
    expect(normalizeDescriptionText("At 9th level, your charm\n\t\tbecomes extraordinarily beguiling."))
      .toBe("At 9th level, your charm becomes extraordinarily beguiling.");
  });

  it("preserves paragraphs, arrays, and list rows", () => {
    expect(normalizeDescriptionText(["First paragraph.", "Second paragraph."]))
      .toBe("First paragraph.\n\nSecond paragraph.");
    expect(normalizeDescriptionText("Offers:\n\t• Shelter\n\t• Information"))
      .toBe("Offers:\n• Shelter\n• Information");
  });

  it("handles empty values", () => {
    expect(normalizeDescriptionText(null)).toBe("");
  });
});
