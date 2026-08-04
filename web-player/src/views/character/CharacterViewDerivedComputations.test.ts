import { describe, expect, it } from "vitest";
import { buildClassFeatureCantripDamageBonuses, buildInvocationSpellDamageBonuses } from "./CharacterViewDerivedComputations";

const invocationDetails = [{ name: "Agonizing Blast", text: "Add your Charisma modifier to damage rolls." }];
const prof = {
  skills: [],
  expertise: [],
  saves: [],
  armor: [],
  weapons: [],
  weaponMasteries: [],
  tools: [],
  languages: [],
  spells: [
    { id: "spell_eldritch_blast", name: "Eldritch Blast", source: "Warlock" },
    { id: "spell_fire_bolt", name: "Fire Bolt", source: "Warlock" },
  ],
  invocations: [{ name: "Agonizing Blast", source: "Warlock" }],
  maneuvers: [],
  metamagic: [],
  infusions: [],
  plans: [],
};

describe("edition-gated invocation mechanics", () => {
  it("binds 2014 Agonizing Blast to Eldritch Blast", () => {
    expect(buildInvocationSpellDamageBonuses({
      ruleset: "5e",
      invocationDetails,
      prof,
      currentCharacterData: { chosenFeatOptions: {} },
      scoresCha: 18,
    })).toEqual({ eldritchblast: 4 });
  });

  it("requires the explicit 2024 cantrip choice and never falls back by name", () => {
    expect(buildInvocationSpellDamageBonuses({
      ruleset: "5.5e",
      invocationDetails,
      prof,
      currentCharacterData: { chosenFeatOptions: {} },
      scoresCha: 18,
    })).toEqual({});

    expect(buildInvocationSpellDamageBonuses({
      ruleset: "5.5e",
      invocationDetails,
      prof,
      currentCharacterData: { chosenFeatOptions: { "invocation:agonizing-blast": ["spell_fire_bolt"] } },
      scoresCha: 18,
    })).toEqual({ firebolt: 4 });
  });
});

const clericSpellcastingStates = [{ className: "Cleric", ability: "wis" as const }];

describe("buildClassFeatureCantripDamageBonuses", () => {
  it("returns nothing when the character doesn't have Potent Spellcasting", () => {
    expect(buildClassFeatureCantripDamageBonuses({
      appliedFeatures: [{ name: "Level 5: Sear Undead" }],
      classSpellcastingStates: clericSpellcastingStates,
      prof: { ...prof, spells: [{ name: "Sacred Flame", source: "Cleric", level: 0 }] },
      scores: { wis: 18 },
    })).toEqual({});
  });

  it("returns nothing when the Wisdom modifier is zero", () => {
    expect(buildClassFeatureCantripDamageBonuses({
      appliedFeatures: [{ name: "Level 7: Blessed Strikes: Potent Spellcasting" }],
      classSpellcastingStates: clericSpellcastingStates,
      prof: { ...prof, spells: [{ name: "Sacred Flame", source: "Cleric", level: 0 }] },
      scores: { wis: 10 },
    })).toEqual({});
  });

  it("adds the Wisdom modifier to every Cleric cantrip, but not leveled spells or another class's cantrips", () => {
    expect(buildClassFeatureCantripDamageBonuses({
      appliedFeatures: [{ name: "Level 7: Blessed Strikes: Potent Spellcasting" }],
      classSpellcastingStates: clericSpellcastingStates,
      prof: {
        ...prof,
        spells: [
          { name: "Sacred Flame", source: "Cleric", level: 0 },
          { name: "Toll the Dead", source: "Cleric", level: 0 },
          { name: "Guiding Bolt", source: "Cleric", level: 1 },
          { name: "Fire Bolt", source: "Wizard", level: 0 },
        ],
      },
      scores: { wis: 18 },
    })).toEqual({
      sacredflame: 4,
      tollthedead: 4,
    });
  });
});
