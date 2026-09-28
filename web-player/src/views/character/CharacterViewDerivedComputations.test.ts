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

const clericSpellcastingStates = [{ className: "Cleric", classEntryId: "class_c_cleric", ability: "wis" as const }];

const noEffectsFeature = {
  source: { id: "feature:0", kind: "class" as const, name: "Level 5: Sear Undead" },
  effects: [],
};
const potentSpellcastingFeature = {
  source: { id: "feature:1", kind: "class" as const, name: "Level 7: Blessed Strikes: Potent Spellcasting" },
  effects: [{
    id: "feature:1:cantrip_damage",
    source: { id: "feature:1", kind: "class" as const, name: "Level 7: Blessed Strikes: Potent Spellcasting" },
    type: "modifier" as const,
    target: "cantrip_damage" as const,
    mode: "bonus" as const,
    amount: { kind: "ability_mod" as const, ability: "wis" as const },
  }],
};

describe("buildClassFeatureCantripDamageBonuses", () => {
  it("returns nothing when the character doesn't have Potent Spellcasting", () => {
    expect(buildClassFeatureCantripDamageBonuses({
      parsedFeatureEffects: [noEffectsFeature],
      classSpellcastingStates: clericSpellcastingStates,
      prof: { ...prof, spells: [{ name: "Sacred Flame", source: "Cleric", level: 0 }] },
      scores: { wis: 18 },
    })).toEqual({});
  });

  it("returns nothing when the Wisdom modifier is zero", () => {
    expect(buildClassFeatureCantripDamageBonuses({
      parsedFeatureEffects: [potentSpellcastingFeature],
      classSpellcastingStates: clericSpellcastingStates,
      prof: { ...prof, spells: [{ name: "Sacred Flame", source: "Cleric", level: 0 }] },
      scores: { wis: 10 },
    })).toEqual({});
  });

  it("adds the Wisdom modifier to every Cleric spell, but not another class's spells", () => {
    // `TaggedItem.level` tracks the character level a spell was *acquired* at, not its D&D
    // spell level, so this function can't itself tell cantrips apart from leveled spells (see
    // its doc comment) -- that's left to callers that have the real spell level available.
    // Guiding Bolt (a leveled Cleric spell) still gets a bonus entry here; the spells panel is
    // responsible for only applying it to rows it resolves as actual cantrips.
    expect(buildClassFeatureCantripDamageBonuses({
      parsedFeatureEffects: [potentSpellcastingFeature],
      classSpellcastingStates: clericSpellcastingStates,
      prof: {
        ...prof,
        spells: [
          { name: "Sacred Flame", source: "Cleric", level: 7 },
          { name: "Toll the Dead", source: "Cleric", level: 7 },
          { name: "Guiding Bolt", source: "Cleric", level: 1 },
          { name: "Fire Bolt", source: "Wizard", level: 0 },
        ],
      },
      scores: { wis: 18 },
    })).toEqual({
      sacredflame: 4,
      tollthedead: 4,
      guidingbolt: 4,
    });
  });

  it("also covers spells granted through a class feature or background feat choice, not just the base class list", () => {
    // A tracked spell's `source` is the granting feature/feat's own name, not always the class
    // name -- e.g. Divine Order: Thaumaturge's bonus cantrip is tagged "Level 1: Divine Order:
    // Thaumaturge" (but carries the matching classEntryId), and Magic Initiate (Cleric)'s cantrips
    // are tagged "Magic Initiate (Cleric)" (no classEntryId, but the class name is in the label).
    expect(buildClassFeatureCantripDamageBonuses({
      parsedFeatureEffects: [potentSpellcastingFeature],
      classSpellcastingStates: clericSpellcastingStates,
      prof: {
        ...prof,
        spells: [
          { name: "Sacred Flame", source: "Level 1: Divine Order: Thaumaturge", classEntryId: "class_c_cleric", level: 7 },
          { name: "Guidance", source: "Magic Initiate (Cleric)", level: 7 },
          { name: "Toll the Dead", source: "Magic Initiate (Cleric)", level: 7 },
          { name: "Burning Hands", source: "Magic Initiate (Wizard)", level: 7 },
        ],
      },
      scores: { wis: 18 },
    })).toEqual({
      sacredflame: 4,
      guidance: 4,
      tollthedead: 4,
    });
  });
});
