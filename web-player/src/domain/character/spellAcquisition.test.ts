import { describe, expect, it } from "vitest";
import { buildAcquisitionLevelIndex, tagAcquisitionLevel, tagAcquisitionLevelMap, trimAcquiredIdsForLevel } from "./spellAcquisition";

describe("tagAcquisitionLevel", () => {
  it("preserves an existing entry's already-tagged level instead of re-stamping it", () => {
    const existingById = buildAcquisitionLevelIndex([{ id: "s_hex", level: 1 }]);
    const [tagged] = tagAcquisitionLevel([{ id: "s_hex", name: "Hex" }], existingById, 12);
    expect(tagged.level).toBe(1);
  });

  it("leaves a known-but-untagged (legacy) entry untagged rather than guessing", () => {
    const existingById = buildAcquisitionLevelIndex([{ id: "s_hex" }]);
    const [tagged] = tagAcquisitionLevel([{ id: "s_hex", name: "Hex" }], existingById, 12);
    expect(tagged.level).toBeNull();
  });

  it("stamps a genuinely new entry with the fallback level", () => {
    const existingById = buildAcquisitionLevelIndex([]);
    const [tagged] = tagAcquisitionLevel([{ id: "s_hex", name: "Hex" }], existingById, 12);
    expect(tagged.level).toBe(12);
  });

  it("keeps a new entry's own precise level instead of the coarser fallback", () => {
    const existingById = buildAcquisitionLevelIndex([]);
    const [tagged] = tagAcquisitionLevel(
      [{ id: "s_arcanum", name: "Tasha's Otherworldly Guise", level: 11 }],
      existingById,
      12,
    );
    expect(tagged.level).toBe(11);
  });

  it("does not require an id to still tag with the fallback", () => {
    const existingById = buildAcquisitionLevelIndex([]);
    const [tagged] = tagAcquisitionLevel([{ id: undefined, name: "Unlabeled" }], existingById, 5);
    expect(tagged.level).toBe(5);
  });

  it("preserves separate acquisition levels for repeatable entries sharing an id", () => {
    const existingById = buildAcquisitionLevelIndex([{ id: "inv_repeat", level: 2 }, { id: "inv_repeat", level: 7 }]);
    expect(tagAcquisitionLevel([{ id: "inv_repeat" }, { id: "inv_repeat" }], existingById, 10).map((entry) => entry.level)).toEqual([2, 7]);
  });
});

describe("trimAcquiredIdsForLevel", () => {
  const levels = new Map([["old", 2], ["middle", 4], ["new", 7]]);
  const levelOf = (id: string) => levels.get(id) ?? null;

  it("removes above-level knowledge without applying a prepared limit to a spellbook", () => {
    expect(trimAcquiredIdsForLevel(["old", "middle", "new"], levelOf, 5, null)).toEqual(["old", "middle"]);
  });

  it("drops newest eligible selections when a known-count limit applies", () => {
    expect(trimAcquiredIdsForLevel(["old", "middle", "new"], levelOf, 7, 2)).toEqual(["old", "middle"]);
  });
});

describe("buildAcquisitionLevelIndex", () => {
  it("ignores entries with no id and handles a null/undefined list", () => {
    expect(buildAcquisitionLevelIndex(null).size).toBe(0);
    expect(buildAcquisitionLevelIndex(undefined).size).toBe(0);
    expect(buildAcquisitionLevelIndex([{ level: 3 }]).size).toBe(0);
    expect(buildAcquisitionLevelIndex([{ id: "s_hex", level: 3 }]).get("s_hex")?.level).toBe(3);
  });
});

describe("tagAcquisitionLevelMap", () => {
  it("preserves an existing tagged id's level", () => {
    const next = tagAcquisitionLevelMap(["optional:Pact Boon: Pact of the Blade"], { "optional:Pact Boon: Pact of the Blade": 3 }, 12);
    expect(next["optional:Pact Boon: Pact of the Blade"]).toBe(3);
  });

  it("leaves a known-but-untagged (legacy) id untagged rather than guessing", () => {
    const next = tagAcquisitionLevelMap(["extraFeat:feat_eldritch_adept"], { "extraFeat:feat_eldritch_adept": null }, 12);
    expect(next["extraFeat:feat_eldritch_adept"]).toBeNull();
  });

  it("stamps a genuinely new id with the fallback level", () => {
    const next = tagAcquisitionLevelMap(["optional:Fighting Style: Archery"], {}, 4);
    expect(next["optional:Fighting Style: Archery"]).toBe(4);
  });

  it("handles an undefined existing map as if nothing was known", () => {
    const next = tagAcquisitionLevelMap(["extraFeat:feat_x"], undefined, 7);
    expect(next["extraFeat:feat_x"]).toBe(7);
  });
});
