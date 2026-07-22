import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Usage: node scripts/enrich-wotc-5e-base-classes.mjs <input.json> <output.json>");

const document = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));

const SHARED_SLOTS = [
  [], [0, 2], [0, 3], [0, 4, 2], [0, 4, 3], [0, 4, 3, 2],
  [0, 4, 3, 3], [0, 4, 3, 3, 1], [0, 4, 3, 3, 2], [0, 4, 3, 3, 3, 1],
  [0, 4, 3, 3, 3, 2], [0, 4, 3, 3, 3, 2, 1], [0, 4, 3, 3, 3, 2, 1],
  [0, 4, 3, 3, 3, 2, 1, 1], [0, 4, 3, 3, 3, 2, 1, 1],
  [0, 4, 3, 3, 3, 2, 1, 1, 1], [0, 4, 3, 3, 3, 2, 1, 1, 1],
  [0, 4, 3, 3, 3, 2, 1, 1, 1, 1], [0, 4, 3, 3, 3, 3, 1, 1, 1, 1],
  [0, 4, 3, 3, 3, 3, 2, 1, 1, 1], [0, 4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const known = {
  Bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  Ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  Sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  Warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
};

const cantrips = {
  Artificer: [2,2,2,2,2,2,2,2,2,3,3,3,3,4,4,4,4,4,4,4],
  Bard: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  Cleric: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
  Druid: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  Sorcerer: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6],
  Warlock: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  Wizard: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
};

const configs = {
  Artificer: { primaryAbility: "int", requirements: "int", armor: ["Light Armor", "Medium Armor", "Shields"], tools: { fixed: ["Thieves' Tools", "Tinker's Tools"] }, casting: ["int", "half", "up", 2] },
  Barbarian: { primaryAbility: "str", requirements: "str", armor: ["Shields"], weapons: ["Simple Weapons", "Martial Weapons"] },
  Bard: { primaryAbility: "cha", requirements: "cha", skills: { choose: 1 }, armor: ["Light Armor"], tools: { notes: ["One musical instrument of your choice"] }, casting: ["cha", "full"] },
  Cleric: { primaryAbility: "wis", requirements: "wis", armor: ["Light Armor", "Medium Armor", "Shields"], casting: ["wis", "full", null, 1] },
  Druid: { primaryAbility: "wis", requirements: "wis", armor: ["Light Armor", "Medium Armor", "Shields"], casting: ["wis", "full", null, 1] },
  Fighter: { primaryAbility: { any: ["str", "dex"] }, requirements: { any: ["str", "dex"] }, armor: ["Light Armor", "Medium Armor", "Shields"], weapons: ["Simple Weapons", "Martial Weapons"] },
  Monk: { primaryAbility: { all: ["dex", "wis"] }, requirements: { all: ["dex", "wis"] }, weapons: ["Simple Weapons", "Shortswords"] },
  Paladin: { primaryAbility: { all: ["str", "cha"] }, requirements: { all: ["str", "cha"] }, armor: ["Light Armor", "Medium Armor", "Shields"], weapons: ["Simple Weapons", "Martial Weapons"], casting: ["cha", "half", "down", 2] },
  Ranger: { primaryAbility: { all: ["dex", "wis"] }, requirements: { all: ["dex", "wis"] }, skills: { choose: 1, from: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"] }, armor: ["Light Armor", "Medium Armor", "Shields"], weapons: ["Simple Weapons", "Martial Weapons"], casting: ["wis", "half"] },
  Rogue: { primaryAbility: "dex", requirements: "dex", skills: { choose: 1, from: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"] }, armor: ["Light Armor"], tools: { fixed: ["Thieves' Tools"] } },
  Sorcerer: { primaryAbility: "cha", requirements: "cha", casting: ["cha", "full"] },
  Warlock: { primaryAbility: "cha", requirements: "cha", armor: ["Light Armor"], weapons: ["Simple Weapons"], casting: ["cha", "pact"] },
  Wizard: { primaryAbility: "int", requirements: "int", casting: ["int", "full", null, 1] },
};

function slotRecord(slots) {
  return Object.fromEntries(slots.slice(1).map((count, index) => [String(index + 1), count]).filter(([, count]) => count > 0));
}

function slotsFor(name, level, progression) {
  if (progression === "pact") {
    const count = level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4;
    const slotLevel = Math.min(5, Math.ceil(level / 2));
    return { [String(slotLevel)]: count };
  }
  const casterLevel = progression === "full" ? level : Math.ceil(level / 2);
  return slotRecord(SHARED_SLOTS[casterLevel] ?? []);
}

const fightingStyleEffects = {
  Archery: [{ type: "modifier", target: "attack_roll", mode: "bonus", amount: { kind: "fixed", value: 2 }, gate: { duration: "passive", weaponFilters: ["ranged_weapon"] } }],
  "Blind Fighting": [{ type: "senses", mode: "grant", senses: [{ kind: "blindsight", range: 10 }] }],
  Defense: [{ type: "armor_class", mode: "bonus", bonus: { kind: "fixed", value: 1 }, gate: { duration: "passive", armorState: "not_unarmored" } }],
  Dueling: [{ type: "modifier", target: "damage_roll", mode: "bonus", amount: { kind: "fixed", value: 2 }, gate: { duration: "passive", weaponFilters: ["melee_weapon", "no_offhand", "no_two_handed"] } }],
  "Thrown Weapon Fighting": [{ type: "modifier", target: "damage_roll", mode: "bonus", amount: { kind: "fixed", value: 2 }, gate: { duration: "passive", weaponFilters: ["thrown_weapon"] } }],
  "Two-Weapon Fighting": [{ type: "attack", mode: "add_ability_to_damage", gate: { duration: "passive", weaponFilters: ["light_weapon"], notes: "extra_attack_damage" } }],
  "Unarmed Fighting": [{ type: "attack", mode: "damage_die_override", amount: { kind: "fixed", dice: "1d6" }, alternateAmount: { kind: "fixed", dice: "1d8" }, alternateWhen: "no_weapon_or_shield", damageType: "bludgeoning", gate: { duration: "passive", notes: "unarmed_only" } }],
};

const fightingStylesByClass = {
  Fighter: ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting", "Blind Fighting", "Interception", "Superior Technique", "Thrown Weapon Fighting", "Unarmed Fighting"],
  Paladin: ["Defense", "Dueling", "Great Weapon Fighting", "Protection", "Blessed Warrior", "Blind Fighting", "Interception"],
  Ranger: ["Archery", "Defense", "Dueling", "Two-Weapon Fighting", "Blind Fighting", "Druidic Warrior", "Thrown Weapon Fighting"],
};

function addFightingStyleChoice(cls, levelNumber) {
  const level = cls.levels.find((entry) => entry.level === levelNumber);
  const options = fightingStylesByClass[cls.name].map((styleName) => {
    const feature = (level?.features ?? []).find((entry) => entry.name === `Fighting Style: ${styleName}` && !entry.subclass);
    if (!feature?.id) throw new Error(`${cls.name}: missing level ${levelNumber} Fighting Style option ${styleName}.`);
    const effects = fightingStyleEffects[styleName];
    if (effects) {
      feature.effects = effects;
      feature.resolution = "automatic";
      delete feature.resolutionNotes;
    }
    if (styleName === "Superior Technique") {
      feature.talent = { kind: "maneuver", known: { "1": 1 } };
      feature.resolution = "mixed";
      feature.resolutionNotes = ["The maneuver choice is structured; the superiority die and maneuver resolution follow the selected maneuver."];
    }
    if (styleName === "Blessed Warrior" || styleName === "Druidic Warrior") {
      const list = styleName === "Blessed Warrior" ? "sl_cleric" : "sl_druid";
      feature.choices = [{ id: `fc_${cls.name.toLowerCase()}_${styleName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, kind: "spell", lists: [list], count: 2, level: 0, mode: "known" }];
      feature.resolution = "automatic";
    }
    return { id: `cco_${cls.name.toLowerCase()}_fighting_style_${styleName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, name: styleName, features: [feature.id] };
  });
  cls.choices = (cls.choices ?? []).filter((choice) => choice.id !== `cc_${cls.name.toLowerCase()}_fighting_style`);
  cls.choices.push({ id: `cc_${cls.name.toLowerCase()}_fighting_style`, name: "Fighting Style", options });
}

function requireBaseFeature(cls, levelNumber, name) {
  const feature = cls.levels.find((entry) => entry.level === levelNumber)?.features?.find(
    (entry) => entry.name === name && !entry.subclass,
  );
  if (!feature?.id) throw new Error(`${cls.name}: missing level ${levelNumber} base feature ${name}.`);
  return feature.id;
}

function replaceClassChoice(cls, choice) {
  cls.choices = (cls.choices ?? []).filter((entry) => entry.id !== choice.id);
  cls.choices.push(choice);
}

function addBaseClassChoices(cls) {
  if (cls.name === "Warlock") {
    replaceClassChoice(cls, {
      id: "cc_warlock_pact_boon",
      name: "Pact Boon",
      options: ["Pact of the Chain", "Pact of the Blade", "Pact of the Tome", "Pact of the Talisman"].map((name) => ({
        id: `cco_warlock_pact_boon_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        name,
        features: [requireBaseFeature(cls, 3, `Pact Boon: ${name}`)],
      })),
    });
  }

  if (cls.name === "Ranger") {
    const replacementChoices = [
      {
        id: "cc_ranger_favored_enemy",
        name: "Favored Enemy Feature",
        options: [
          { id: "cco_ranger_favored_enemy_original", name: "Favored Enemy", features: [requireBaseFeature(cls, 1, "Favored Enemy")] },
          { id: "cco_ranger_favored_enemy_favored_foe", name: "Favored Foe", features: [requireBaseFeature(cls, 1, "Favored Foe")] },
        ],
      },
      {
        id: "cc_ranger_natural_explorer",
        name: "Natural Explorer Feature",
        options: [
          { id: "cco_ranger_natural_explorer_original", name: "Natural Explorer", features: [requireBaseFeature(cls, 1, "Natural Explorer")] },
          {
            id: "cco_ranger_natural_explorer_deft_explorer",
            name: "Deft Explorer",
            features: [requireBaseFeature(cls, 1, "Deft Explorer"), requireBaseFeature(cls, 1, "Deft Explorer: Canny")],
          },
        ],
      },
      {
        id: "cc_ranger_primeval_awareness",
        name: "Primeval Awareness Feature",
        options: [
          { id: "cco_ranger_primeval_awareness_original", name: "Primeval Awareness", features: [requireBaseFeature(cls, 3, "Primeval Awareness")] },
          { id: "cco_ranger_primeval_awareness_primal_awareness", name: "Primal Awareness", features: [requireBaseFeature(cls, 3, "Primal Awareness")] },
        ],
      },
      {
        id: "cc_ranger_hide_in_plain_sight",
        name: "Hide in Plain Sight Feature",
        options: [
          { id: "cco_ranger_hide_in_plain_sight_original", name: "Hide in Plain Sight", features: [requireBaseFeature(cls, 10, "Hide in Plain Sight")] },
          { id: "cco_ranger_hide_in_plain_sight_natures_veil", name: "Nature's Veil", features: [requireBaseFeature(cls, 10, "Nature's Veil")] },
        ],
      },
    ];
    replacementChoices.forEach((choice) => replaceClassChoice(cls, choice));
  }
}

function findBaseFeatures(cls, name) {
  return cls.levels.flatMap((level) => (level.features ?? [])
    .filter((feature) => feature.name === name && !feature.subclass)
    .map((feature) => ({ level: level.level, feature })));
}

function addRemainingBaseMechanics(cls) {
  if (cls.name === "Barbarian") {
    const barbarianSkills = ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"];
    for (const { feature } of findBaseFeatures(cls, "Primal Knowledge")) {
      feature.choices = [{ kind: "proficiency", category: "skill", count: 1, from: barbarianSkills }];
      feature.resolution = "automatic";
      delete feature.resolutionNotes;
    }
  }

  if (cls.name !== "Ranger") return;

  const canny = findBaseFeatures(cls, "Deft Explorer: Canny")[0]?.feature;
  if (canny) {
    canny.choices = [
      { kind: "expertise", known: { "1": 1 } },
      { kind: "proficiency", category: "language", count: 2 },
    ];
    canny.resolution = "automatic";
    delete canny.resolutionNotes;
  }

  for (const name of ["Favored Enemy", "Favored Enemy Improvement (1)", "Favored Enemy Improvement (2)"]) {
    const feature = findBaseFeatures(cls, name)[0]?.feature;
    if (!feature) continue;
    const suffix = name === "Favored Enemy" ? "1" : name.endsWith("(1)") ? "6" : "14";
    feature.choices = [
      {
        id: `fc_ranger_favored_enemy_${suffix}`,
        kind: "selection",
        label: "Favored Enemy",
        count: 1,
        options: [
          "Aberrations", "Beasts", "Celestials", "Constructs", "Dragons", "Elementals", "Fey",
          "Fiends", "Giants", "Monstrosities", "Oozes", "Plants", "Undead", "Two Humanoid Peoples",
        ],
      },
      { kind: "proficiency", category: "language", count: 1 },
    ];
    feature.resolution = "mixed";
    feature.resolutionNotes = ["The associated language is structured; record the favored creature type or humanoid peoples in Edit."];
  }

  const terrains = ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp", "Underdark"];
  for (const [name, suffix] of [["Natural Explorer", "1"], ["Natural Explorer Improvement (1)", "6"], ["Natural Explorer Improvement (2)", "10"]]) {
    const feature = findBaseFeatures(cls, name)[0]?.feature;
    if (!feature) continue;
    feature.choices = [{ id: `fc_ranger_favored_terrain_${suffix}`, kind: "selection", label: "Favored Terrain", count: 1, options: terrains }];
    feature.resolution = "automatic";
    delete feature.resolutionNotes;
  }

  const primalAwareness = findBaseFeatures(cls, "Primal Awareness")[0]?.feature;
  if (primalAwareness) {
    const spells = [
      [3, "Speak with Animals", "s_speak_with_animals"],
      [5, "Beast Sense", "s_beast_sense"],
      [9, "Speak with Plants", "s_speak_with_plants"],
      [13, "Locate Creature", "s_locate_creature"],
      [17, "Commune with Nature", "s_commune_with_nature"],
    ];
    primalAwareness.effects = spells.flatMap(([requiredLevel, spellName, spellId]) => {
      const resourceKey = `ranger_primal_awareness_${String(spellId).replace(/^s_/, "")}`;
      return [
        {
          type: "spell_grant",
          spellName,
          spellId,
          spellList: "sl_ranger",
          mode: "free_cast",
          requiredLevel,
          uses: { kind: "fixed", value: 1 },
          reset: "long_rest",
          castsWithoutSlot: true,
          resourceKey,
        },
        {
          type: "resource_grant",
          resourceKey,
          label: `${spellName} (Primal Awareness)`,
          max: { kind: "fixed", value: 1 },
          reset: "long_rest",
          restoreAmount: "all",
          linkedSpellName: spellName,
          requiredLevel,
        },
      ];
    });
    primalAwareness.resolution = "automatic";
    delete primalAwareness.resolutionNotes;
  }
}

for (const cls of document.classes ?? []) {
  const config = configs[cls.name];
  if (!config) throw new Error(`No canonical base-class configuration for ${cls.name}`);
  cls.primaryAbility = config.primaryAbility;
  cls.multiclass = {
    requirements: { ability: config.requirements, minimum: 13 },
    ...(config.skills ? { skills: config.skills } : {}),
    ...(config.armor ? { armor: config.armor } : {}),
    ...(config.weapons ? { weapons: config.weapons } : {}),
    ...(config.tools ? { tools: config.tools } : {}),
    ...(config.casting ? { spellcasting: { progression: config.casting[1], ...(config.casting[2] ? { rounding: config.casting[2] } : {}) } } : {}),
  };

  if (config.casting) {
    const [ability, progression, , preparedDivisor] = config.casting;
    const list = `sl_${cls.name.toLowerCase()}`;
    cls.spellLists = { ...(cls.spellLists ?? {}), [list]: cls.name };
    cls.spellcasting = {
      ability,
      list,
      ...(progression === "pact" ? { slotRecovery: "short_rest" } : {}),
      ...(preparedDivisor ? {
        preparedSpellChanges: "long_rest",
        preparedFormula: { classLevelDivisor: preparedDivisor, rounding: "down", minimum: 1 },
      } : {}),
    };
    for (const level of cls.levels) {
      const spellSlots = slotsFor(cls.name, level.level, progression);
      if (Object.keys(spellSlots).length > 0) level.spellSlots = spellSlots;
      else delete level.spellSlots;
      if (cantrips[cls.name]) level.cantripsKnown = cantrips[cls.name][level.level - 1];
      if (known[cls.name]) level.spellsPrepared = known[cls.name][level.level - 1];
    }
  } else {
    delete cls.spellcasting;
    delete cls.spellLists;
    for (const level of cls.levels) {
      delete level.spellSlots;
      delete level.cantripsKnown;
      delete level.spellsPrepared;
    }
  }

  const features = cls.levels.flatMap((level) => level.features ?? []);
  const expertise = features.find((feature) => /^Expertise$/i.test(feature.name));
  if (expertise && cls.name === "Bard") expertise.choices = [{ kind: "expertise", known: { "3": 2, "10": 4 } }];
  if (expertise && cls.name === "Rogue") expertise.choices = [{ kind: "expertise", known: { "1": 2, "6": 4 } }];
  const metamagic = features.find((feature) => /^Metamagic$/i.test(feature.name));
  if (metamagic) metamagic.talent = { kind: "metamagic", known: { "3": 2, "10": 3, "17": 4 } };
  const invocations = features.find((feature) => /^Eldritch Invocations$/i.test(feature.name));
  if (invocations) invocations.talent = { kind: "invocation", known: { "2": 2, "5": 3, "7": 4, "9": 5, "12": 6, "15": 7, "18": 8 } };

  if (fightingStylesByClass[cls.name]) addFightingStyleChoice(cls, cls.name === "Fighter" ? 1 : 2);
  addBaseClassChoices(cls);
  addRemainingBaseMechanics(cls);

  if (cls.name === "Wizard") {
    for (const level of cls.levels) {
      const count = level.level === 1 ? 6 : 2;
      const maxLevel = Math.min(9, Math.max(1, Math.ceil(level.level / 2)));
      level.features ??= [];
      level.features.push({
        id: `cf_wizard_${level.level}_spellbook_choices`,
        name: level.level === 1 ? "Starting Spellbook" : "Spellbook Spells",
        description: level.level === 1 ? "Choose the six 1st-level Wizard spells in your starting spellbook." : "Add two Wizard spells you can prepare to your spellbook.",
        choices: [{ id: `fc_wizard_spellbook_${level.level}`, kind: "spell", lists: ["sl_wizard"], count, maxLevel, mode: "spellbook" }],
        resolution: "automatic",
      });
    }
  }
}

fs.writeFileSync(path.resolve(output), `${JSON.stringify(document, null, 2)}\n`);
console.log(`Enriched ${document.classes.length} 5e base classes into ${output}.`);
