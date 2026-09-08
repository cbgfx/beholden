import { expect, it } from "vitest";
import { virtualListRange } from "@beholden/shared/domain/compendium/virtualListRange";

it("renders filtered results even when the saved scroll position is beyond them", () => {
  const range = virtualListRange(3, 25000, 520, 52, 8);
  expect(range).toEqual({ start: 0, end: 3, padTop: 0, padBottom: 0 });
});

it("removes all spacer height when filtering returns no results", () => {
  expect(virtualListRange(0, 25000, 520, 52, 8))
    .toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 });
});

it("keeps the rendered window bounded and preserves total height", () => {
  const range = virtualListRange(10000, 25000, 520, 52, 8);
  expect(range.end - range.start).toBe(26);
  expect(range.start).toBeGreaterThan(0);
  expect(range.padTop + (range.end - range.start) * 52 + range.padBottom).toBe(10000 * 52);
});
