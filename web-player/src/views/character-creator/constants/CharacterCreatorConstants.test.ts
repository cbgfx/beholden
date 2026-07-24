import { describe, expect, it } from "vitest";
import { WEAPON_MASTERY_KINDS, getEligibleWeaponMasteryKinds } from "./CharacterCreatorConstants";

describe("getEligibleWeaponMasteryKinds", () => {
  it("returns nothing when there's no weapon proficiency text", () => {
    expect(getEligibleWeaponMasteryKinds(undefined)).toEqual([]);
    expect(getEligibleWeaponMasteryKinds([])).toEqual([]);
  });

  it("offers every masterable weapon for unqualified Simple + Martial proficiency (Barbarian/Fighter/Paladin/Ranger)", () => {
    const eligible = getEligibleWeaponMasteryKinds(["Simple Weapons", "Martial Weapons"]);
    expect(eligible.sort()).toEqual([...WEAPON_MASTERY_KINDS].sort());
  });

  it("restricts martial weapons to Finesse-or-Light for Rogue's qualified proficiency", () => {
    const eligible = getEligibleWeaponMasteryKinds(["Simple Weapons and Martial Weapons that have the Finesse or Light property"]);
    // All simple weapons are unconditionally included.
    expect(eligible).toContain("Club");
    expect(eligible).toContain("Dagger");
    expect(eligible).toContain("Handaxe");
    // Martial weapons only if Finesse or Light.
    expect(eligible).toContain("Rapier"); // martial, finesse
    expect(eligible).toContain("Scimitar"); // martial, light + finesse
    expect(eligible).toContain("Shortsword"); // martial, light + finesse
    expect(eligible).toContain("Whip"); // martial, finesse
    expect(eligible).toContain("Hand Crossbow"); // martial, light
    // Martial weapons without Finesse or Light are excluded — this is the bug fix.
    expect(eligible).not.toContain("Greataxe");
    expect(eligible).not.toContain("Longsword");
    expect(eligible).not.toContain("Warhammer");
  });

  it("restricts martial weapons to Light-only for a Light-qualified proficiency", () => {
    const eligible = getEligibleWeaponMasteryKinds(["Simple Weapons and Martial Weapons that have the Light property"]);
    expect(eligible).toContain("Hand Crossbow"); // martial, light
    expect(eligible).not.toContain("Rapier"); // martial, finesse only — not light
    expect(eligible).not.toContain("Longsword");
  });
});
