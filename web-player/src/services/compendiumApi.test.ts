import { describe, expect, it } from "vitest";
import { backgroundGrandToPlayerView, classGrandToPlayerView, traitsGrandToPlayerView } from "./compendiumApi";

describe("classGrandToPlayerView", () => {
  it("expands sparse Grand tool proficiencies for character-creation consumers", () => {
    const result = classGrandToPlayerView({
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

  it("projects canonical subclass ids and class choices without parsing feature names", () => {
    const result = classGrandToPlayerView({
      id: "c_test",
      name: "Test",
      subclasses: { level: 3, options: { sc_test_alpha: "Alpha" } },
      choices: [{ id: "cc_order", name: "Order", options: [
        { id: "cco_first", name: "First", features: ["first"] },
        { id: "cco_second", name: "Second", features: ["second"] },
      ] }],
      proficiencies: {},
      levels: [{
        level: 1,
        features: [
          { id: "first", name: "First", description: "" },
          { id: "second", name: "Second", description: "" },
          { id: "alpha", name: "Feature Without Parenthetical", description: "", subclass: "sc_test_alpha" },
        ],
      }],
    });

    expect(result.autolevels[0].features).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "first", optional: true }),
      expect.objectContaining({ id: "second", optional: true }),
      expect.objectContaining({ id: "alpha", subclassId: "sc_test_alpha", subclass: "Alpha", optional: false }),
    ]));
  });

  it("carries the Grand `hidden` flag through to the player-view feature (regression: was silently dropped)", () => {
    const result = classGrandToPlayerView({
      id: "c_test",
      name: "Test",
      proficiencies: {},
      levels: [{
        level: 1,
        features: [
          { id: "visible", name: "Visible", description: "", hidden: false },
          { id: "quiet", name: "Quiet", description: "", hidden: true },
          { id: "unset", name: "Unset", description: "" },
        ],
      }],
    });

    expect(result.autolevels[0].features).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "visible", hidden: false }),
      expect.objectContaining({ id: "quiet", hidden: true }),
      expect.objectContaining({ id: "unset", hidden: false }),
    ]));
  });
});

describe("backgroundGrandToPlayerView", () => {
  it("expands compact background data for existing character-creation consumers", () => {
    const result = backgroundGrandToPlayerView<any>({
      id: "bg_acolyte",
      name: "Acolyte",
      description: "Temple service.",
      proficiencies: {
        skills: ["Insight", "Religion"],
        tools: { choose: 1, from: ["Calligrapher's Supplies", "Herbalism Kit"] },
        feat: "f_skilled",
        featChoice: { count: 1, from: ["f_alert", "f_tough"] },
        abilityScores: ["Intelligence", "Wisdom", "Charisma"],
      },
      equipment: {
        options: [{
          id: "A",
          entries: [{ kind: "currency", denomination: "GP", amount: 50 }],
        }],
      },
    }, [{
          id: "f_skilled",
          name: "Skilled",
          description: "Gain three proficiencies.",
          parsed: {
            grants: { skills: ["Arcana"] },
            resolution: "mixed",
          },
          resolution: "mixed",
        }]);

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
    expect(result.proficiencies.featChoice).toBe(1);
    expect(result.proficiencies.featChoiceFrom).toEqual(["f_alert", "f_tough"]);
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

describe("traitsGrandToPlayerView", () => {
  it("preserves hidden species traits and their structured mechanics", () => {
    const [trait] = traitsGrandToPlayerView([{
      id: "rt_human_languages",
      name: "Languages",
      description: "Common and one additional language.",
      hidden: true,
      effects: [{ type: "proficiency_grant", category: "language", grants: ["Common"] }],
    }]);

    expect(trait).toMatchObject({
      name: "Languages",
      hidden: true,
      effects: [{ type: "proficiency_grant", category: "language", grants: ["Common"] }],
    });
  });
});
