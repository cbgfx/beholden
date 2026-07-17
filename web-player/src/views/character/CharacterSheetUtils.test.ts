import { describe, expect, it } from "vitest";
import { featPrerequisitesMet, invocationPrerequisitesMet, normalizeAbilityKey } from "@/views/character/CharacterSheetUtils";

describe("invocationPrerequisitesMet canonical facts", () => {
  it("requires levels, owned talents, and the exact cantrip capability", () => {
    const prerequisite = { level: 5, talent: "ct_invocation_pact_of_blade", cantrip: "attack_damage" as const };
    expect(invocationPrerequisitesMet(prerequisite, { level: 4, hasAttackDamageCantrip: true, chosenTalentIds: ["ct_invocation_pact_of_blade"] })).toBe(false);
    expect(invocationPrerequisitesMet(prerequisite, { level: 5, hasDamageCantrip: true, chosenTalentIds: ["ct_invocation_pact_of_blade"] })).toBe(false);
    expect(invocationPrerequisitesMet(prerequisite, { level: 5, hasAttackDamageCantrip: true, chosenTalentIds: [] })).toBe(false);
    expect(invocationPrerequisitesMet(prerequisite, { level: 5, hasAttackDamageCantrip: true, chosenTalentIds: ["ct_invocation_pact_of_blade"] })).toBe(true);
  });

  it("never derives a prerequisite from display prose", () => {
    expect(invocationPrerequisitesMet(null, { level: 1 })).toBe(true);
  });
});

describe("featPrerequisitesMet ability requirements", () => {
  it("accepts either ability in a shared-threshold alternative", () => {
    const prerequisite = { ability: { any: ["str", "dex"] as const } };
    expect(featPrerequisitesMet(prerequisite, { level: 4, scores: { str: 13, dex: 8 } })).toBe(true);
    expect(featPrerequisitesMet(prerequisite, { level: 4, scores: { str: 8, dex: 13 } })).toBe(true);
    expect(featPrerequisitesMet(prerequisite, { level: 4, scores: { str: 8, dex: 8 } })).toBe(false);
  });

  it("accepts alternatives with separately written thresholds", () => {
    const prerequisite = { ability: { any: ["str", "dex"] as const } };
    expect(featPrerequisitesMet(prerequisite, { level: 4, scores: { str: 13, dex: 8 } })).toBe(true);
    expect(featPrerequisitesMet(prerequisite, { level: 4, scores: { str: 8, dex: 13 } })).toBe(true);
  });

  it("requires every ability joined by and", () => {
    const prerequisite = { ability: [{ any: ["dex"] as const }, { any: ["wis"] as const }] };
    expect(featPrerequisitesMet(prerequisite, { level: 4, scores: { dex: 13, wis: 13 } })).toBe(true);
    expect(featPrerequisitesMet(prerequisite, { level: 4, scores: { dex: 13, wis: 12 } })).toBe(false);
  });

  it("understands the or-higher wording", () => {
    const prerequisite = { ability: { any: ["str", "dex"] as const } };
    expect(featPrerequisitesMet(prerequisite, { level: 4, scores: { str: 13, dex: 8 } })).toBe(true);
  });
});

describe("normalizeAbilityKey", () => {
  it("normalizes canonical and full spellcasting ability names", () => {
    expect(normalizeAbilityKey("Charisma")).toBe("cha");
    expect(normalizeAbilityKey("WIS")).toBe("wis");
    expect(normalizeAbilityKey(" Intelligence ")).toBe("int");
  });

  it("does not guess unknown abilities", () => {
    expect(normalizeAbilityKey("highest mental ability")).toBeNull();
    expect(normalizeAbilityKey(null)).toBeNull();
  });
});
