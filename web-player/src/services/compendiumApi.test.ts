import { describe, expect, it } from "vitest";
import { backgroundV2ToPlayer, classV2ToPlayer } from "./compendiumApi";

describe("classV2ToPlayer", () => {
  it("expands sparse V2 tool proficiencies for character-creation consumers", () => {
    const result = classV2ToPlayer({
      id: "class_bard",
      name: "Bard",
      hitDie: 8,
      proficiencies: {
        tools: {
          choices: [{ count: 3, from: ["Lute", "Flute"] }],
        },
      },
    });

    expect(result.proficiencies.tools).toEqual({
      fixed: [],
      choices: [{ count: 3, from: ["Lute", "Flute"] }],
      notes: [],
    });
  });
});

describe("backgroundV2ToPlayer", () => {
  it("expands compact background data for existing character-creation consumers", () => {
    const result = backgroundV2ToPlayer<any>({
      id: "bg_acolyte",
      name: "Acolyte",
      description: "Temple service.",
      proficiencies: {
        skills: ["Insight", "Religion"],
        tools: { choose: 1, from: ["Calligrapher's Supplies", "Herbalism Kit"] },
        feats: [{
          name: "Skilled",
          description: "Gain three proficiencies.",
          parsed: {
            grants: { skills: ["Arcana"] },
            resolution: "mixed",
          },
          resolution: "mixed",
        }],
        abilityScores: ["Intelligence", "Wisdom", "Charisma"],
      },
      equipment: {
        options: [{
          id: "A",
          entries: [{ kind: "currency", denomination: "GP", amount: 50 }],
        }],
      },
    });

    expect(result.proficiencies.skills).toEqual({
      fixed: ["Insight", "Religion"],
      choose: 0,
      from: null,
    });
    expect(result.proficiencies.tools).toEqual({
      fixed: [],
      choose: 1,
      from: ["Calligrapher's Supplies", "Herbalism Kit"],
    });
    expect(result.proficiencies.languages).toEqual({
      fixed: [],
      choose: 0,
      from: null,
    });
    expect(result.proficiencies.featChoice).toBe(0);
    expect(result.proficiencies.abilityScoreChoose).toBe(0);
    expect(result.proficiencies.feats[0].parsed.grants.skills).toEqual(["Arcana"]);
    expect(result.proficiencies.feats[0].parsed.grants.tools).toEqual([]);
    expect(result.proficiencies.feats[0].parsed.choices).toEqual([]);
    expect(result.equipment).toBe("Structured starting equipment");
    expect(result.equipmentOptions[0].id).toBe("A");
    expect(result.traits.map((trait: { name: string }) => trait.name)).toEqual([
      "Description",
      "Feat: Skilled",
    ]);
  });
});
