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

  it("derives Barbarian's Rage uses from the compendium's per-level resource table, with no class-name-specific code", () => {
    // Shape matches the real compendium data verbatim: Barbarian's `resources` array only
    // appears at levels where the Rage use count changes (2 at level 1, 3 at level 3), not at
    // every level — collectClassResources must scan up to the character's level and keep the
    // most recent value, the same way it would for any other class's named resource.
    const classDetail = {
      id: "c_barbarian",
      name: "Barbarian",
      hd: 12,
      autolevels: [
        { level: 1, slots: null, counters: [{ name: "Rage", value: 2, reset: "L" }] },
        { level: 2, slots: null, counters: [] },
        { level: 3, slots: null, counters: [{ name: "Rage", value: 3, reset: "L" }] },
      ],
    } as unknown as ClassRestDetail;

    expect(collectClassResources(classDetail, 1)).toEqual([
      { key: "rage", name: "Rage", current: 2, max: 2, reset: "L", restoreAmount: "all" },
    ]);
    expect(collectClassResources(classDetail, 2)).toEqual([
      { key: "rage", name: "Rage", current: 2, max: 2, reset: "L", restoreAmount: "all" },
    ]);
    expect(collectClassResources(classDetail, 3)).toEqual([
      { key: "rage", name: "Rage", current: 3, max: 3, reset: "L", restoreAmount: "all" },
    ]);
  });
});
