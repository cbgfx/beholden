import { describe, expect, it } from "vitest";
import { getMysticArcanumRevisitChoices } from "./MysticArcanumRevisitUtils";

function autolevel(level: number, choiceId: string, spellLevel: number) {
  return {
    level,
    features: [{
      name: `Mystic Arcanum (${spellLevel}${["st", "nd", "rd"][spellLevel - 1] ?? "th"} level)`,
      choices: [{ id: choiceId, kind: "spell", lists: ["sl_warlock"], level: spellLevel }],
    }],
  };
}

describe("getMysticArcanumRevisitChoices", () => {
  const autolevels = [
    autolevel(11, "fc_warlock_mystic_arcanum_6", 6),
    autolevel(13, "fc_warlock_mystic_arcanum_7", 7),
    autolevel(15, "fc_warlock_mystic_arcanum_8", 8),
    autolevel(17, "fc_warlock_mystic_arcanum_9", 9),
  ];

  it("only fires for Warlock when Eldritch Versatility is among the level's new features", () => {
    expect(getMysticArcanumRevisitChoices({
      ruleset: "5e",
      className: "Wizard",
      newFeatureNames: ["Eldritch Versatility"],
      autolevels,
      nextClassLevel: 16,
    })).toEqual([]);

    expect(getMysticArcanumRevisitChoices({
      ruleset: "5e",
      className: "Warlock",
      newFeatureNames: ["Ability Score Improvement"],
      autolevels,
      nextClassLevel: 12,
    })).toEqual([]);
  });

  it("never applies the 2014 revisit rule to a 5.5e character even if names collide", () => {
    expect(getMysticArcanumRevisitChoices({
      ruleset: "5.5e",
      className: "Warlock",
      newFeatureNames: ["Eldritch Versatility"],
      autolevels,
      nextClassLevel: 16,
    })).toEqual([]);
  });

  it("surfaces every arcanum slot already unlocked below the current level, keyed to its original unlock level", () => {
    const choices = getMysticArcanumRevisitChoices({
      ruleset: "5e",
      className: "Warlock",
      newFeatureNames: ["Ability Score Improvement", "Eldritch Versatility"],
      autolevels,
      nextClassLevel: 16,
    });
    // 6th (11) and 7th (13) are unlocked below 16; 8th (15) unlocked below 16 too; 9th (17) is not.
    expect(choices.map((c) => c.key)).toEqual([
      "levelupclassfeature:11:fc_warlock_mystic_arcanum_6",
      "levelupclassfeature:13:fc_warlock_mystic_arcanum_7",
      "levelupclassfeature:15:fc_warlock_mystic_arcanum_8",
    ]);
    expect(choices.every((c) => c.count === 1)).toBe(true);
  });

  it("at level 12, only the 6th-level arcanum slot (unlocked at 11) is revisitable", () => {
    const choices = getMysticArcanumRevisitChoices({
      ruleset: "5e",
      className: "Warlock",
      newFeatureNames: ["Ability Score Improvement", "Eldritch Versatility"],
      autolevels,
      nextClassLevel: 12,
    });
    expect(choices).toHaveLength(1);
    expect(choices[0].key).toBe("levelupclassfeature:11:fc_warlock_mystic_arcanum_6");
    expect(choices[0].level).toBe(6);
    expect(choices[0].listNames).toEqual(["sl_warlock"]);
  });

  it("ignores subclass-tagged features even if named Mystic Arcanum", () => {
    const withSubclass = [{
      level: 11,
      features: [{
        name: "Mystic Arcanum (6th level)",
        subclass: "sc_warlock_the_hexblade",
        choices: [{ id: "fc_should_not_appear", kind: "spell", lists: ["sl_warlock"], level: 6 }],
      }],
    }];
    expect(getMysticArcanumRevisitChoices({
      ruleset: "5e",
      className: "Warlock",
      newFeatureNames: ["Eldritch Versatility"],
      autolevels: withSubclass,
      nextClassLevel: 12,
    })).toEqual([]);
  });
});
