import { describe, expect, it } from "vitest";
import { buildAppliedCharacterFeatures } from "./characterFeatures";

describe("class-aware feature progression", () => {
  it("uses class level for class features while retaining total character level separately", () => {
    const features = buildAppliedCharacterFeatures({
      charData: {
        classes: [
          { id: "class_fighter", classId: "c_fighter", className: "Fighter", level: 2 },
          { id: "class_wizard", classId: "c_wizard", className: "Wizard", level: 3 },
        ],
      },
      characterLevel: 5,
      classLevel: 2,
      classDetail: {
        id: "c_fighter",
        autolevels: [
          { level: 2, features: [{ name: "Action Surge", text: "Take one additional action." }] },
          { level: 3, features: [{ name: "Subclass Feature", text: "A third-level class feature." }] },
          { level: 5, features: [{ name: "Extra Attack", text: "Attack twice." }] },
        ],
      },
      raceDetail: null,
      backgroundDetail: null,
      bgOriginFeatDetail: null,
      raceFeatDetail: null,
      levelUpFeatDetails: [],
      invocationDetails: [],
    });

    expect(features.map((feature) => feature.name)).toEqual(["Action Surge"]);
  });

  it("derives features from every class with class-scoped identities", () => {
    const features = buildAppliedCharacterFeatures({
      charData: { classes: [] },
      characterLevel: 5,
      classDetail: null,
      classSelections: [
        {
          entry: { id: "fighter-entry", level: 2, subclass: null },
          detail: { id: "c_fighter", autolevels: [{ level: 2, features: [{ name: "Shared Name", text: "Fighter version." }] }] },
        },
        {
          entry: { id: "wizard-entry", level: 3, subclass: null },
          detail: { id: "c_wizard", autolevels: [
            { level: 2, features: [{ name: "Shared Name", text: "Wizard version." }] },
            { level: 4, features: [{ name: "Too High", text: "Not yet." }] },
          ] },
        },
      ],
      raceDetail: null,
      backgroundDetail: null,
      bgOriginFeatDetail: null,
      raceFeatDetail: null,
      levelUpFeatDetails: [],
      invocationDetails: [],
    });

    expect(features.map((feature) => feature.name)).toEqual(["Shared Name", "Shared Name"]);
    expect(features.map((feature) => feature.id)).toEqual([
      "class:fighter-entry:c_fighter:Shared Name",
      "class:wizard-entry:c_wizard:Shared Name",
    ]);
  });

  it("keeps only the first Unarmored Defense acquired across classes", () => {
    const features = buildAppliedCharacterFeatures({
      charData: { classes: [] }, characterLevel: 2, classDetail: null,
      classSelections: [
        { entry: { id: "barbarian", level: 1 }, detail: { id: "c_barbarian", autolevels: [{ level: 1, features: [{ name: "Unarmored Defense", text: "Dexterity and Constitution.", effects: [{ type: "armor_class", abilities: ["dex", "con"] }] }] }] } },
        { entry: { id: "monk", level: 1 }, detail: { id: "c_monk", autolevels: [{ level: 1, features: [{ name: "Unarmored Defense", text: "Dexterity and Wisdom.", effects: [{ type: "armor_class", abilities: ["dex", "wis"] }] }] }] } },
      ],
      raceDetail: null, backgroundDetail: null, bgOriginFeatDetail: null, raceFeatDetail: null, levelUpFeatDetails: [], invocationDetails: [],
    });

    const unarmored = features.filter((feature) => feature.name === "Unarmored Defense");
    expect(unarmored).toHaveLength(1);
    expect(unarmored[0]?.id).toContain("class:barbarian:");
  });

  it("uses the strongest Extra Attack progression without stacking classes", () => {
    const features = buildAppliedCharacterFeatures({
      charData: { classes: [] }, characterLevel: 16, classDetail: null,
      classSelections: [
        { entry: { id: "paladin", level: 5 }, detail: { id: "c_paladin", autolevels: [{ level: 5, features: [{ name: "Extra Attack", text: "Attack twice." }] }] } },
        { entry: { id: "fighter", level: 11 }, detail: { id: "c_fighter", autolevels: [
          { level: 5, features: [{ name: "Extra Attack", text: "Attack twice." }] },
          { level: 11, features: [{ name: "Extra Attack (2)", text: "Attack three times." }] },
        ] } },
      ],
      raceDetail: null, backgroundDetail: null, bgOriginFeatDetail: null, raceFeatDetail: null, levelUpFeatDetails: [], invocationDetails: [],
    });

    expect(features.filter((feature) => /^Extra Attack/.test(feature.name)).map((feature) => feature.name)).toEqual(["Extra Attack (2)"]);
  });
});
