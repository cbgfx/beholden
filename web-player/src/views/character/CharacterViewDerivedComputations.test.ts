import { describe, expect, it } from "vitest";
import { buildInvocationSpellDamageBonuses } from "./CharacterViewDerivedComputations";

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
