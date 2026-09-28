import { describe, expect, it } from "vitest";
import { collectSpellChoicesFromEffects } from "@/domain/character/parseFeatureEffects";
import { parseAppliedSpeciesTraitEffects } from "./CharacterCreatorClassFeatureUtils";

describe("parseAppliedSpeciesTraitEffects", () => {
  it("surfaces a species trait's typed spell_choice for the generic spell-choice collectors (Elf High's Cantrip)", () => {
    const raceDetail = {
      name: "Elf, High",
      traits: [{
        name: "Cantrip",
        text: "You know one cantrip of your choice from the wizard spell list.",
        modifier: [],
        effects: [{
          type: "spell_choice",
          choiceId: "fc_elf_high_cantrip",
          mode: "learn",
          count: { kind: "fixed", value: 1 },
          level: 0,
          spellLists: ["sl_wizard"],
        }],
      }],
    };

    const parsed = parseAppliedSpeciesTraitEffects(raceDetail);
    const choices = collectSpellChoicesFromEffects(parsed);

    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({
      mode: "learn",
      level: 0,
      spellLists: ["sl_wizard"],
      count: { kind: "fixed", value: 1 },
      source: { name: "Cantrip", parentName: "Elf, High" },
    });
  });

  it("surfaces a fixed spell_grant with a level gate and free-cast resource (Drow Magic's Faerie Fire)", () => {
    const raceDetail = {
      name: "Elf, Drow / Dark",
      traits: [{
        name: "Drow Magic",
        text: "You know the dancing lights cantrip...",
        modifier: [],
        effects: [{
          type: "spell_grant",
          spellName: "Faerie Fire",
          mode: "free_cast",
          requiredLevel: 3,
          uses: { kind: "fixed", value: 1 },
          reset: "long_rest",
          castsWithoutSlot: true,
        }],
      }],
    };

    const parsed = parseAppliedSpeciesTraitEffects(raceDetail);
    const spellGrant = parsed.flatMap((p) => p.effects).find((e) => e.type === "spell_grant");

    expect(spellGrant).toMatchObject({
      spellName: "Faerie Fire",
      mode: "free_cast",
      requiredLevel: 3,
      reset: "long_rest",
      castsWithoutSlot: true,
    });
  });

  it("returns nothing for a species with no traits", () => {
    expect(parseAppliedSpeciesTraitEffects(null)).toEqual([]);
  });
});
