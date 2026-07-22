import { describe, expect, it } from "vitest";

import { coalesceSharedClassResources, collectClassResources, isSpellLinkedResource, mergeResourceState } from "./CharacterViewResourceHelpers";
import type { ClassRestDetail } from "./CharacterViewTypes";
import type { ResourceCounter } from "./CharacterSheetTypes";

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

describe("coalesceSharedClassResources", () => {
  it("uses one Channel Divinity pool with the highest explicitly granted use count", () => {
    expect(coalesceSharedClassResources([
      { key: "class:cleric:channel_divinity", name: "Channel Divinity", current: 2, max: 2, reset: "S", restoreAmount: "all" },
      { key: "class:paladin:channel_divinity", name: "Channel Divinity", current: 1, max: 1, reset: "S", restoreAmount: "all" },
      { key: "class:paladin:lay_on_hands", name: "Lay on Hands", current: 15, max: 15, reset: "L", restoreAmount: "all" },
    ])).toEqual([
      { key: "class:paladin:lay_on_hands", name: "Lay on Hands", current: 15, max: 15, reset: "L", restoreAmount: "all" },
      { key: "class:shared:channel_divinity", name: "Channel Divinity", current: 2, max: 2, reset: "S", restoreAmount: "all" },
    ]);
  });
});

describe("mergeResourceState", () => {
  it("does not duplicate a resource whose saved key predates a class/feat migration to a new key format, and carries its current value forward", () => {
    // Reproduces the real bug: a class feature migrated from a counter-table resource (saved
    // under normalizeResourceKey's hyphenated slug, e.g. "beguiling-magic") to a structured
    // resource_grant effect (derived key is the effect's own snake_case resourceKey, "beguiling_magic").
    // Same resource, same name, two different key formats — only the name still ties them together.
    const saved: ResourceCounter[] = [
      { key: "beguiling-magic", name: "Beguiling Magic", current: 0, max: 1, reset: "L", restoreAmount: "all" },
    ];
    const derived: ResourceCounter[] = [
      { key: "beguiling_magic", name: "Beguiling Magic", current: 1, max: 1, reset: "L", restoreAmount: "all" },
    ];

    const result = mergeResourceState(saved, derived);

    expect(result).toEqual([
      { key: "beguiling_magic", name: "Beguiling Magic", current: 0, max: 1, reset: "L", restoreAmount: "all" },
    ]);
  });

  it("keeps a genuinely different saved resource that has no derived counterpart", () => {
    const saved: ResourceCounter[] = [
      { key: "custom-boon", name: "Custom Boon", current: 1, max: 2, reset: "L", restoreAmount: "all" },
    ];
    const derived: ResourceCounter[] = [
      { key: "bardic_inspiration", name: "Bardic Inspiration", current: 4, max: 4, reset: "SL", restoreAmount: "all" },
    ];

    const result = mergeResourceState(saved, derived);

    expect(result).toEqual([
      { key: "bardic_inspiration", name: "Bardic Inspiration", current: 4, max: 4, reset: "SL", restoreAmount: "all" },
      { key: "custom-boon", name: "Custom Boon", current: 1, max: 2, reset: "L", restoreAmount: "all" },
    ]);
  });
});

describe("isSpellLinkedResource", () => {
  it("hides both current feat-use pools and Alarion's legacy Misty Step tracker", () => {
    const grantedSpells = [{
      key: "granted-spell:feat:fey:use:1",
      spellName: "Misty Step",
      sourceName: "Fey-Touched (Intelligence)",
      mode: "limited" as const,
      note: "Free cast once per Long Rest.",
      resourceKey: "feat:fey:use:1",
    }];
    const spellLinkedResourceKeys = new Set(["feat:fey:use:1", "feat:fey:use:2"]);

    expect(isSpellLinkedResource({
      resource: { key: "feat:fey:use:2", name: "Fey-Touched (Intelligence) (2)", current: 1, max: 1, reset: "L" },
      grantedSpells,
      spellLinkedResourceKeys,
    })).toBe(true);
    expect(isSpellLinkedResource({
      resource: { key: "fey-touched-intelligence-misty-step", name: "Misty Step (Fey-Touched (Intelligence))", current: 1, max: 1, reset: "L" },
      grantedSpells,
      spellLinkedResourceKeys,
    })).toBe(true);
  });
});
