import { describe, expect, it } from "vitest";
import {
  collectSpeciesTraitChoiceBundles,
  resolveSpeciesTraitEffects,
  speciesTraitChoiceKey,
} from "./speciesTraitChoices";

const ancestry = {
  id: "r_dragonborn",
  traits: [{
    name: "Draconic Ancestry",
    effects: [{
      type: "choice_bundle",
      options: [
        { optionId: "black", label: "Black", effects: [{ type: "defense", mode: "damage_resistance", targets: ["Acid"] }] },
        { optionId: "red", label: "Red", effects: [{ type: "defense", mode: "damage_resistance", targets: ["Fire"] }] },
      ],
    }],
  }],
};

describe("species trait choice bundles", () => {
  it("exposes a stable creator choice and only activates the selected option", () => {
    const key = speciesTraitChoiceKey("r_dragonborn", "Draconic Ancestry");
    expect(collectSpeciesTraitChoiceBundles(ancestry)).toEqual([{
      key,
      traitName: "Draconic Ancestry",
      options: [{ id: "black", label: "Black" }, { id: "red", label: "Red" }],
    }]);

    expect(resolveSpeciesTraitEffects("r_dragonborn", "Draconic Ancestry", ancestry.traits[0].effects, {})).toEqual([]);
    expect(resolveSpeciesTraitEffects(
      "r_dragonborn",
      "Draconic Ancestry",
      ancestry.traits[0].effects,
      { [key]: ["red"] },
    )).toEqual([{ type: "defense", mode: "damage_resistance", targets: ["Fire"] }]);
  });
});
