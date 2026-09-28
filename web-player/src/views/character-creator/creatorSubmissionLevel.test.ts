import { describe, expect, it } from "vitest";
import { resolveCreatorTotalLevel } from "./creatorSubmission";

describe("resolveCreatorTotalLevel", () => {
  it("keeps secondary class levels while the primary class moves down and back up", () => {
    const classes = [{ level: 5 }, { level: 2 }, { level: 1 }];
    expect(resolveCreatorTotalLevel(3, classes)).toBe(6);
    expect(resolveCreatorTotalLevel(5, classes)).toBe(8);
  });

  it("uses the primary level directly for a single-class character", () => {
    expect(resolveCreatorTotalLevel(7, [{ level: 7 }])).toBe(7);
  });
});
