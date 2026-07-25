import { describe, expect, it } from "vitest";
import { deriveMulticlassSpellSlots, type MulticlassSpellcastingClass } from "./multiclassSpellcasting";

function caster(id: string, level: number, progression: "full" | "half" | "third" | "pact", rounding?: "down" | "up", slots: number[] | null = null): MulticlassSpellcastingClass {
  return {
    entry: { id: `${id}-entry`, level },
    detail: {
      id,
      name: id,
      autolevels: [{ level, slots }],
      multiclass: { spellcasting: { progression, ...(rounding ? { rounding } : {}) } },
    },
  };
}

describe("deriveMulticlassSpellSlots", () => {
  it("combines full, half, and third caster levels using their rules", () => {
    const result = deriveMulticlassSpellSlots([
      caster("wizard", 3, "full"),
      caster("paladin", 5, "half"),
      caster("fighter", 4, "third"),
    ]);
    expect(result.casterLevel).toBe(6);
    expect(result.sharedSlots).toEqual([0, 4, 3, 3]);
  });

  it("rounds Artificer-style half casting up", () => {
    const result = deriveMulticlassSpellSlots([
      caster("artificer", 3, "half", "up"),
      caster("wizard", 1, "full"),
    ]);
    expect(result.casterLevel).toBe(3);
  });

  it("uses a lone spellcasting class's own progression even on a multiclass character", () => {
    const result = deriveMulticlassSpellSlots([caster("paladin", 3, "half", "down", [0, 3])]);
    expect(result.sharedSlots).toEqual([0, 3]);
  });

  it("keeps Pact Magic separate from shared slots", () => {
    const result = deriveMulticlassSpellSlots([
      caster("bard", 4, "full", undefined, [0, 4, 3]),
      caster("warlock", 2, "pact", undefined, [2, 0, 2]),
    ]);
    expect(result.sharedSlots).toEqual([0, 4, 3]);
    expect(result.pactPools).toEqual([{ key: "pact:warlock-entry", classEntryId: "warlock-entry", className: "warlock", slots: [2, 0, 2] }]);
  });

  it("uses a lone third-caster subclass's own slot progression", () => {
    const result = deriveMulticlassSpellSlots([{
      entry: { id: "fighter-entry", level: 4, subclass: "sc_eldritch_knight" },
      detail: {
        id: "fighter",
        name: "Fighter",
        autolevels: [{ level: 4, slots: null }],
        subclassDetails: {
          sc_eldritch_knight: {
            name: "Eldritch Knight",
            spellcasting: { contribution: "third", progression: [{ level: 3, slots: [0, 2] }, { level: 4, slots: [0, 3] }] },
          },
        },
      },
    }]);
    expect(result.sharedSlots).toEqual([0, 3]);
  });
});
