import { describe, expect, it } from "vitest";
import { migrateClassFeatureChoiceKeys } from "./ClassFeatureChoiceMigration";

describe("migrateClassFeatureChoiceKeys", () => {
  it("copies selections from a legacy generated key to the current semantic choice", () => {
    const legacyKey = "classfeature:class:levelup:2:0:Level 2: Deft Explorer:proficiency_grant:0";
    const currentKey = "classfeature:class:creator-class-feature:2:Level 2: Deft Explorer:proficiency_grant:0";
    expect(migrateClassFeatureChoiceKeys(
      { [legacyKey]: ["Giant", "Sign Language"] },
      [{ key: currentKey, sourceLabel: "Level 2: Deft Explorer" }],
    )).toEqual({
      [legacyKey]: ["Giant", "Sign Language"],
      [currentKey]: ["Giant", "Sign Language"],
    });
  });

  it("does not overwrite an explicit current selection", () => {
    expect(migrateClassFeatureChoiceKeys(
      { "classfeature:old:Deft Explorer": ["Giant"], "classfeature:new": ["Elvish"] },
      [{ key: "classfeature:new", sourceLabel: "Deft Explorer" }],
    )["classfeature:new"]).toEqual(["Elvish"]);
  });
});
