import { describe, expect, it } from "vitest";

import { collectClassResources } from "./CharacterViewResourceHelpers";
import type { ClassRestDetail } from "./CharacterViewTypes";

describe("collectClassResources", () => {
  it("handles compact class records without autolevels", () => {
    const classDetail = {
      id: "fighter",
      name: "Fighter",
      hd: 10,
      autolevels: undefined,
    } as unknown as ClassRestDetail;

    expect(collectClassResources(classDetail, 1)).toEqual([]);
  });
});
