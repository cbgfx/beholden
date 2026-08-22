import { describe, expect, it } from "vitest";
import { getStoredSpellTemplate, storedSpellLevelsUsed, validStoredSlotLevels } from "./CharacterStoredSpellUtils";

describe("stored item spells", () => {
  const ring = { kind: "stored" as const, capacity: 5, minLevel: 1, maxLevel: 5 };

  it("finds a stored template among other item spell templates", () => {
    expect(getStoredSpellTemplate([{ kind: "choice", list: "wizard" }, ring])).toEqual(ring);
  });

  it("counts the slot level used by every stored spell", () => {
    expect(storedSpellLevelsUsed([
      { instanceId: "a", id: "s1", name: "Shield", level: 1, slotLevel: 1 },
      { instanceId: "b", id: "s2", name: "Fireball", level: 3, slotLevel: 4 },
    ])).toBe(5);
  });

  it("allows upcasting only within the template and remaining capacity", () => {
    expect(validStoredSlotLevels(ring, 2, 1)).toEqual([2, 3, 4]);
    expect(validStoredSlotLevels(ring, 5, 1)).toEqual([]);
  });
});
