import assert from "node:assert/strict";

export const validMonster = {
  id: "m_test_guardian",
  ruleset: "5.5e",
  name: "Test Guardian",
  classification: {
    size: "M", type: "construct", description: "Medium construct",
  },
  challenge: { rating: "2", xp: 450 },
  armorClass: { value: 15 },
  hitPoints: { average: 30, formula: "4d8 + 12" },
  movement: { walk: 30 },
  abilities: { str: 14, dex: 10, con: 16, int: 3, wis: 10, cha: 5 },
  actions: [{
    id: "strike",
    name: "Strike",
    description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage.",
    attack: { toHit: 4, reach: "5ft", melee: true },
    damage: { roll: "1d8+2", type: "slashing" },
  }],
};

export const validItem = {
  id: "i_test_blade",
  ruleset: "5.5e",
  name: "Test Blade",
  type: "Melee Weapon",
  rarity: "rare",
  magical: true,
  equippable: true,
  weight: 3,
  value: 100,
  proficiency: "Martial Weapons",
  weapon: {
    damage: "1d8", twoHandedDamage: "1d10", damageType: "S", properties: ["V"],
  },
  description: "Test rules.",
};

export const validSpell = {
  id: "s_test_spark",
  ruleset: "5.5e",
  name: "Test Spark",
  level: 1,
  school: "Evocation",
  casting: {
    time: "1 action",
    range: "60 feet",
    components: { verbal: true as const, somatic: true as const },
    duration: { description: "Instantaneous" },
  },
  access: ["sl_wizard"],
  description: ["Test spell."],
};

export const validClass = {
  id: "c_test",
  ruleset: "5.5e",
  name: "Test Class",
  descriptions: ["A test class."],
  hitDie: 8,
  primaryAbility: "int",
  proficiencies: {
    savingThrows: ["int", "wis"],
    skills: { choose: 2, from: ["Arcana", "History"] },
    armor: ["Light Armor"],
    weapons: ["Simple Weapons"],
  },
  spellcasting: { ability: "int", slotRecovery: "long_rest" },
  levels: [{
    level: 1,
    cantripsKnown: 2,
    spellSlots: { "1": 2 },
  }],
};

export const validSpecies = {
  id: "r_test",
  ruleset: "5.5e",
  name: "Test Species",
  size: "M",
  speed: 30,
  traits: [],
};

export const validBackground = {
  id: "bg_test",
  ruleset: "5.5e",
  name: "Test Background",
  description: "A compact test background.",
  proficiencies: {
    skills: ["Insight", "Religion"],
    abilityScores: ["Intelligence", "Wisdom", "Charisma"],
  },
};

export const validFeat = {
  id: "f_test",
  ruleset: "5.5e",
  name: "Test Feat",
  description: "Test feat.",
};

export const validDeck = {
  ruleset: "5.5e",
  id: "deck:test:one",
  deckName: "Test Deck",
  deckKey: "test",
  cardName: "One",
  cardKey: "one",
  text: "Test card.",
  sort: 1,
};

export const validBastionSpace = { ruleset: "5.5e", kind: "space", id: "bastion-space:test", name: "Test Space", squares: 4, sort: 1 };

export const validBastionOrder = { ruleset: "5.5e", kind: "order", id: "bastion-order:test", name: "Test Order", sort: 1 };

export const validBastionFacility = {
  ruleset: "5.5e",
  kind: "facility",
  id: "bastion-facility:test",
  name: "Test Facility",
  facilityType: "special",
  orders: ["Test Order"],
  description: "Test facility.",
};

export function fails(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown): void {
  const result = schema.safeParse(value);
  assert.equal(result.success, false, "Expected validation to fail but it passed");
}

export function passes(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown): void {
  const result = schema.safeParse(value);
  assert.equal(result.success, true, "Expected validation to pass but it failed");
}
