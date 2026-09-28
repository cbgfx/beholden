import { describe, expect, it } from "vitest";
import { buildLevelDownPreview, formatLevelDownPreview } from "./progressionLevelDown";

describe("level-down preview", () => {
  it("names only grants above the target level and preserves other subclass grants", () => {
    const preview = buildLevelDownPreview({
      fromLevel: 8,
      toLevel: 7,
      subclass: "Life",
      classDefinition: { autolevels: [{ level: 8, features: [{ name: "Divine Strike", subclass: "Life" }, { name: "Potent Spellcasting", subclass: "Light" }] }] },
      acquisitionLevels: { "optional:Blessed Strikes": 8, "extraFeat:older": 4 },
      taggedSpells: [{ id: "s", name: "Holy Aura", level: 8 }, { id: "old", name: "Bless", level: 1 }],
      levelUpChoices: [{ level: 8, type: "asi", abilityBonuses: { wis: 2 } }],
      abilityChanges: ["WIS: 18 → 16"],
      removedProficiencies: ["expertise: Religion"],
      removedGrants: ["Level 8: Metamagic: Quickened Spell", "Level 8: Choice: Blessed Strikes"],
    });
    expect(preview?.removedFeatures).toEqual(["Level 8: Divine Strike"]);
    expect(preview?.removedRecordedChoices).toEqual(["Level 8: Ability Score Improvement: WIS +2", "Level 8: Choice: Blessed Strikes", "Level 8: Metamagic: Quickened Spell", "Level 8: Spell: Holy Aura"]);
    expect(formatLevelDownPreview(preview!)).toContain("Review HP Max");
    expect(formatLevelDownPreview(preview!)).toContain("WIS: 18 → 16");
    expect(formatLevelDownPreview(preview!)).toContain("expertise: Religion");
  });

  it("returns no transition when the level did not decrease", () => {
    expect(buildLevelDownPreview({ fromLevel: 7, toLevel: 8 })).toBeNull();
  });
});
