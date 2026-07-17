import { describe, expect, it } from "vitest";
import { parseFeatureEffects } from "@/domain/character/parseFeatureEffects";
import { deriveCreatorSheetFacts } from "./CharacterCreatorDerivedStats";

function classFeature(name: string, effects: unknown[]) {
  return parseFeatureEffects({
    source: { id: name.toLowerCase().replaceAll(" ", "-"), kind: "class", name, text: "Display text only." },
    text: "Display text only.",
    classEffects: effects,
  });
}

const scores = { str: 10, dex: 16, con: 14, int: 10, wis: 18, cha: 10 };

describe("deriveCreatorSheetFacts", () => {
  it("uses the Barbarian Unarmored Defense formula supplied by the compendium", () => {
    const result = deriveCreatorSheetFacts({
      baseSpeed: 30,
      level: 1,
      scores,
      classFeatureEffects: [classFeature(
        "Unarmored Defense",
        [{ type: "armor_class", mode: "base_formula", base: 10, abilities: ["dex", "con"], gate: { armorState: "no_armor", shieldAllowed: true } }],
      )],
    });
    expect(result.ac).toBe(15);
  });

  it("uses the Monk Unarmored Defense formula supplied by the compendium", () => {
    const result = deriveCreatorSheetFacts({
      baseSpeed: 30,
      level: 1,
      scores,
      classFeatureEffects: [classFeature(
        "Unarmored Defense",
        [{ type: "armor_class", mode: "base_formula", base: 10, abilities: ["dex", "wis"], gate: { armorState: "no_armor", shieldAllowed: false } }],
      )],
    });
    expect(result.ac).toBe(17);
  });

  it("uses structured feature effects for speed without inspecting a class name", () => {
    const result = deriveCreatorSheetFacts({
      baseSpeed: 30,
      level: 5,
      scores,
      classFeatureEffects: [classFeature(
        "Any Feature Name",
        [{ type: "speed", mode: "bonus", amount: { kind: "fixed", value: 10 }, gate: { armorState: "not_heavy" } }],
      )],
    });
    expect(result.speed).toBe(40);
  });

  it("includes a species trait's structured AC bonus in the live preview, matching what the saved sheet would show", () => {
    // Dex mod for dex 16 is +3, so base AC without Integrated Protection would be 13.
    const withoutTrait = deriveCreatorSheetFacts({ baseSpeed: 30, level: 1, scores, classFeatureEffects: [] });
    expect(withoutTrait.ac).toBe(13);

    const speciesTrait = parseFeatureEffects({
      source: { id: "integrated-protection", kind: "species", name: "Integrated Protection", text: "See the species entry for full details." },
      text: "See the species entry for full details.",
      traitEffects: [{ type: "armor_class", mode: "bonus", bonus: { kind: "fixed", value: 1 } }],
    });
    const withTrait = deriveCreatorSheetFacts({
      baseSpeed: 30,
      level: 1,
      scores,
      classFeatureEffects: [],
      speciesTraitEffects: [speciesTrait],
    });
    expect(withTrait.ac).toBe(14);
  });
});
