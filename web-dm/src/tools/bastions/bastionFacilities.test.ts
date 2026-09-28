/**
 * Facility sizes, the DM's upgrade pill and special facility slots. The numbers here stand in for
 * the compendium JSON; the module must only ever read them, never assume them.
 */
import { describe, expect, it } from "vitest";
import {
  allowedFacilitySizes,
  defaultFacilitySize,
  facilityHirelings,
  facilitySizePill,
  specialFacilitySlotsForLevel,
  type BastionSpaceDefinition,
  type SizedFacilityDefinition,
} from "@beholden/shared/domain/bastionFacilities";

const spaces: BastionSpaceDefinition[] = [
  { key: "cramped", name: "Cramped", sort: 0, basicUpgrade: { to: "roomy", costGp: 500 } },
  { key: "roomy", name: "Roomy", sort: 1, basicUpgrade: { to: "vast", costGp: 2000 } },
  { key: "vast", name: "Vast", sort: 2 },
];
const bedroom: SizedFacilityDefinition = { type: "basic", space: null, hirelings: 0, spaces: ["cramped", "roomy", "vast"] };
const barrack: SizedFacilityDefinition = { type: "special", space: "Roomy", hirelings: 1, upgrade: { to: "vast", costGp: 2000 } };
const workshop: SizedFacilityDefinition = { type: "special", space: "Roomy", hirelings: 3, upgrade: { to: "vast", costGp: 2000, hirelingsDelta: 2 } };
const library: SizedFacilityDefinition = { type: "special", space: "Roomy", hirelings: 1 };

describe("starting and allowed sizes", () => {
  it("starts basic facilities Cramped and special ones at their catalogue size", () => {
    expect(defaultFacilitySize(bedroom)).toBe("cramped");
    expect(defaultFacilitySize(barrack)).toBe("roomy");
  });

  it("allows a basic facility its listed sizes, and a special one its size and its upgrade", () => {
    expect(allowedFacilitySizes(bedroom)).toEqual(["cramped", "roomy", "vast"]);
    expect(allowedFacilitySizes(barrack)).toEqual(["roomy", "vast"]);
    expect(allowedFacilitySizes(library)).toEqual(["roomy"]);
  });
});

describe("facilitySizePill", () => {
  it("toggles a special facility between its size (showing the cost) and its upgrade (no cost)", () => {
    expect(facilitySizePill(barrack, "roomy", spaces)).toEqual({ active: false, resets: false, upgradeCostGp: 2000, nextSize: "vast", sizeName: "Roomy" });
    expect(facilitySizePill(barrack, "vast", spaces)).toEqual({ active: true, resets: true, upgradeCostGp: null, nextSize: "roomy", sizeName: "Vast" });
  });

  it("steps a basic facility up with each step's cost, then resets to Cramped", () => {
    expect(facilitySizePill(bedroom, "cramped", spaces)).toMatchObject({ active: false, upgradeCostGp: 500, nextSize: "roomy" });
    expect(facilitySizePill(bedroom, "roomy", spaces)).toMatchObject({ active: true, upgradeCostGp: 2000, nextSize: "vast" });
    expect(facilitySizePill(bedroom, "vast", spaces)).toMatchObject({ active: true, resets: true, upgradeCostGp: null, nextSize: "cramped" });
  });

  it("reads costs from the compendium, so a changed JSON value changes the pill", () => {
    const pricier = spaces.map((space) => (space.key === "cramped" ? { ...space, basicUpgrade: { to: "roomy", costGp: 750 } } : space));
    expect(facilitySizePill(bedroom, "cramped", pricier)?.upgradeCostGp).toBe(750);
  });

  it("offers no pill for a facility that can't change size", () => {
    expect(facilitySizePill(library, "roomy", spaces)).toBeNull();
    expect(facilitySizePill({ type: "basic", space: null, hirelings: 0 }, "cramped", spaces)).toBeNull();
  });
});

describe("hirelings and slots", () => {
  it("adds the upgrade's hirelings only once upgraded", () => {
    expect(facilityHirelings(workshop, "roomy")).toBe(3);
    expect(facilityHirelings(workshop, "vast")).toBe(5);
    expect(facilityHirelings(barrack, "vast")).toBe(1);
  });

  it("counts special slots from the progression it's given", () => {
    const progression = [{ level: 9, count: 4 }, { level: 5, count: 2 }, { level: 13, count: 5 }];
    expect(specialFacilitySlotsForLevel(4, progression)).toBe(0);
    expect(specialFacilitySlotsForLevel(5, progression)).toBe(2);
    expect(specialFacilitySlotsForLevel(12, progression)).toBe(4);
    expect(specialFacilitySlotsForLevel(20, progression)).toBe(5);
  });
});
