import { expect, it } from "vitest";
import { classProgressionRequirements } from "@beholden/shared/domain/classProgressionRequirements";

it("accepts a valid multiclass total and rejects an oversized sum", () => {
  expect(classProgressionRequirements([{ classId: "fighter", level: 19 }, { classId: "wizard", level: 1 }], 20)).toEqual([]);
  expect(classProgressionRequirements([{ classId: "fighter", level: 20 }, { classId: "wizard", level: 1 }])[0].id).toBe("character-level");
});

it("does not allow normalization to hide malformed records", () => {
  for (const level of [0, -1, 1.5, 21, "4", null, NaN]) {
    expect(classProgressionRequirements([{ classId: "fighter", level }]).length).toBeGreaterThan(0);
  }
  expect(classProgressionRequirements(null)[0].id).toBe("class-records");
  expect(classProgressionRequirements([{ level: 1 }]).length).toBeGreaterThan(0);
  expect(classProgressionRequirements([{ classId: "fighter", level: 1 }, { classId: "FIGHTER", level: 1 }]).length).toBeGreaterThan(0);
});

it("checks declared totals while supporting legacy classless characters", () => {
  expect(classProgressionRequirements(undefined, 8)).toEqual([]);
  expect(classProgressionRequirements([], 8)).toEqual([]);
  expect(classProgressionRequirements([{ className: "Cleric", level: 7 }], 8)[0].id).toBe("class-level-total");
  expect(classProgressionRequirements([{ className: "Cleric", level: 7 }])).toEqual([]);
});
