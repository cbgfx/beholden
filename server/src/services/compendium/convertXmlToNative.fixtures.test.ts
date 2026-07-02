import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert";
import { convertCompendiumXmlToNative } from "./convertXmlToNative.js";
import { assertCanonicalV2Entry } from "./nativeCompendiumV2.js";

function readFixture(filename: string): string {
  return fs.readFileSync(
    path.join(path.dirname(import.meta.url.replace("file:///", "")), "fixtures", filename),
    "utf-8"
  );
}

describe("convertCompendiumXmlToNative", () => {
  describe("monsters", () => {
    it("should convert monsters to canonical v2 format", () => {
      const xml = readFixture("monsters.xml");
      const result = convertCompendiumXmlToNative(xml);

      const monsterBatch = result.batches.find(b => b.category === 'monsters');
      assert(monsterBatch, "monster batch should be defined");

      const monsters = monsterBatch.entries as any[];
      assert(monsters.length > 0, "monsters array should not be empty");

      monsters.forEach((monster, index) => {
        assertCanonicalV2Entry("monsters", monster, index);
      });

      // More assertions will go here
      const dragon = monsters.find(m => m.name === "Ancient Test Dragon");
      assert(dragon, "Ancient Test Dragon should be in the output");

      assert.strictEqual(dragon.id, "m_ancient_test_dragon", "ID should be stable and predictable");

      assert.deepStrictEqual(dragon.armorClass, { value: 19, source: "Natural Armor" }, "AC should be parsed correctly");
      assert.deepStrictEqual(dragon.hitPoints, { average: 546, formula: "28d20 + 252" }, "HP should be parsed correctly");

      assert.deepStrictEqual(dragon.movement, {
        walk: 40,
        burrow: 30,
        climb: 40,
        fly: 80,
        swim: 40,
        hover: true,
      }, "All movement modes should be parsed");

      assert.deepStrictEqual(dragon.proficiencies.savingThrows, [
        { name: "Str", bonus: 14 },
        { name: "Dex", bonus: 7 },
        { name: "Wis", bonus: 9 },
        { name: "Cha", bonus: 13 },
      ], "Saving throw proficiencies should be parsed");

      assert.deepStrictEqual(dragon.proficiencies.skills, [
        { name: "Perception", bonus: 16 },
        { name: "Stealth", bonus: 7 },
      ], "Skill proficiencies should be parsed");

      assert.deepStrictEqual(dragon.defenses.vulnerabilities, ["cold"], "Vulnerabilities should be parsed");
      assert.deepStrictEqual(dragon.defenses.resistances, ["bludgeoning, piercing, and slashing from nonmagical attacks"], "Resistances should be parsed");
      assert.deepStrictEqual(dragon.defenses.damageImmunities, ["fire", "poison"], "Damage immunities should be parsed");
      assert.deepStrictEqual(dragon.defenses.conditionImmunities, ["charmed", "frightened", "poisoned"], "Condition immunities should be parsed");

      assert.deepStrictEqual(dragon.senses, ["blindsight 60 ft.", "darkvision 120 ft.", "passive Perception 26"], "Senses should be parsed");
      assert.deepStrictEqual(dragon.languages, ["Common", "Draconic", "Elvish"], "Languages should be parsed");

      const biteAction = dragon.actions.find((a: any) => a.name === "Bite");
      assert(biteAction, "Bite action should exist");
      assert.deepStrictEqual(biteAction.attack, {
        toHit: 14,
        reach: "15ft",
        melee: true,
        damage: "2d10+8",
        damageType: "piercing",
      }, "Bite attack should be parsed from text");
      
      const frightfulPresence = dragon.actions.find((a: any) => a.name === "Frightful Presence (Recharge 5-6)");
      assert(frightfulPresence, "Recharge ability should be an action");

      assert(dragon.legendaryActions.length > 0, "Legendary actions should be present");
      const wingAttack = dragon.legendaryActions.find((a: any) => a.name === "Wing Attack (Costs 2 Actions)");
      assert(wingAttack, "Wing Attack legendary action should exist");

      const golem = monsters.find(m => m.name === "Test Golem");
      assert(golem, "Test Golem should be in the output");

      assert.strictEqual(golem.id, "m_test_golem", "ID should be stable and predictable");
      assert.deepStrictEqual(golem.armorClass, { value: 20 }, "Numeric AC should be parsed correctly");
      assert.deepStrictEqual(golem.hitPoints, { average: 210 }, "Numeric HP should be parsed correctly");
      assert.deepStrictEqual(
        golem.spellcasting[0]?.spellSlots,
        { "1": 4, "2": 3, "3": 2 },
        "Monster spell slots should attach to the spellcasting entry",
      );

      const slamAction = golem.actions.find((a: any) => a.name === "Slam");
      assert(slamAction, "Slam action should exist");
      assert.deepStrictEqual(slamAction.attack, {
        toHit: 10,
        reach: "5ft",
        melee: true,
        damage: "3d8+6",
        damageType: "bludgeoning",
      }, "Slam attack should be parsed from text");

      const vehicle = monsters.find(m => m.name === "Test Vehicle");
      assert(vehicle, "Test Vehicle should be in the output");
      assert.deepStrictEqual(vehicle.abilities, {
        str: 18,
        dex: 8,
        con: 16,
      }, "Legacy vehicle zero ability sentinels should be omitted");
    });
  });

  describe("items", () => {
    it("should convert items to canonical v2 format", () => {
      const xml = readFixture("items.xml");
      const result = convertCompendiumXmlToNative(xml);

      const itemBatch = result.batches.find(b => b.category === 'items');
      assert(itemBatch, "item batch should be defined");

      const items = itemBatch.entries as any[];
      assert.strictEqual(items.length, 4, "Should be 4 items in the batch");

      items.forEach((item, index) => {
        assertCanonicalV2Entry("items", item, index);
      });

      const longsword = items.find(i => i.name === "Longsword");
      assert(longsword, "Longsword should be present");
      assert.strictEqual(longsword.type, "Melee Weapon", "Longsword type");
      assert.strictEqual(longsword.value, 1500, "Longsword value");
      assert.strictEqual(longsword.weapon.damage, "1d8", "Longsword dmg1");
      assert.strictEqual(longsword.weapon.twoHandedDamage, "1d10", "Longsword dmg2");

      const plateArmor = items.find(i => i.name === "Plate Armor");
      assert(plateArmor, "Plate Armor should be present");
      assert.strictEqual(plateArmor.type, "Heavy Armor", "Plate Armor type");
      assert.strictEqual(plateArmor.armor.ac, 18, "Plate Armor AC");
      assert.strictEqual(plateArmor.armor.stealthDisadvantage, true, "Plate Armor stealth disadvantage");

      const wand = items.find(i => i.name === "Wand of Magic Missiles");
      assert(wand, "Wand should be present");
      assert.strictEqual(wand.magical, true, "Wand magical status");
      assert.strictEqual(Boolean(wand.attunement), true, "Wand attunement");
      assert(Array.isArray(wand.description) && wand.description.length > 1, "Wand should have multiple description paragraphs");

      const shield = items.find(i => i.name === "+1 Shield");
      assert(shield, "Shield should be present");
      assert.deepStrictEqual(shield.modifiers, [{ category: "Bonus", value: "AC +1" }], "Shield modifiers");
    });
  });

  describe("spells", () => {
    it("should convert spells to canonical v2 format", () => {
      const xml = readFixture("spells.xml");
      const result = convertCompendiumXmlToNative(xml);

      const spellBatch = result.batches.find(b => b.category === 'spells');
      assert(spellBatch, "spell batch should be defined");

      const spells = spellBatch.entries as any[];
      assert.strictEqual(spells.length, 3, "Should be 3 spells in the batch");

      spells.forEach((spell, index) => {
        assertCanonicalV2Entry("spells", spell, index);
      });

      const fireball = spells.find(s => s.name === "Fireball");
      assert(fireball, "Fireball should be present");
      assert.strictEqual(fireball.level, 3, "Fireball level");
      assert.deepStrictEqual(fireball.casting.components, {
        verbal: true,
        somatic: true,
        material: "a tiny ball of bat guano and sulfur",
      }, "Fireball components");
      assert.strictEqual(fireball.ritual, undefined, "Fireball omits the false ritual default");
      assert.deepStrictEqual(fireball.classes, ["Sorcerer", "Wizard"], "Fireball classes");

      const detectMagic = spells.find(s => s.name === "Detect Magic");
      assert(detectMagic, "Detect Magic should be present");
      assert.strictEqual(detectMagic.ritual, true, "Detect Magic is a ritual");
      assert.strictEqual(detectMagic.casting.duration.concentration, true, "Detect Magic requires concentration");
      assert.strictEqual(detectMagic.casting.components.material, undefined, "Detect Magic omits absent material components");

      const shillelagh = spells.find(s => s.name === "Shillelagh");
      assert(shillelagh, "Shillelagh should be present");
      assert.strictEqual(shillelagh.level, 0, "Shillelagh is a cantrip");
      assert.strictEqual(shillelagh.casting.duration.concentration, undefined, "Shillelagh omits the false concentration default");
      assert.strictEqual(shillelagh.casting.components.material, "mistletoe, a shamrock leaf, and a club or quarterstaff", "Shillelagh material components");
    });
  });

  describe("classes", () => {
    it("should convert classes to canonical v2 format", () => {
      const xml = readFixture("classes.xml");
      const result = convertCompendiumXmlToNative(xml);

      const classBatch = result.batches.find(b => b.category === 'classes');
      assert(classBatch, "class batch should be defined");
      const classes = classBatch.entries as any[];
      assert.strictEqual(classes.length, 1, "Should be 1 class in the batch");

      const cleric = classes[0]!;
      assert.strictEqual(cleric.name, "Test Cleric");
      assertCanonicalV2Entry("classes", cleric, 0);
      assert.strictEqual(cleric.levels.length, 20, "Should have 20 level objects");
      
      // Test merging of duplicate autolevels at level 1
      const level1 = cleric.levels.find((l: any) => l.level === 1);
      assert(level1, "Level 1 should exist");
      assert.strictEqual(level1.features.length, 3, "Level 1 should have merged features from main and subclass autolevels");
      assert(level1.features.some((f: any) => f.name === "Spellcasting"), "Level 1 should have Spellcasting");
      assert(level1.features.some((f: any) => f.name === "Bonus Proficiency"), "Level 1 should have Bonus Proficiency from subclass");
      
      // Test spell slots
      assert.strictEqual(level1.cantripsKnown, 3, "Level 1 should know 3 cantrips");
      assert.deepStrictEqual(level1.spellSlots, { "1": 2, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 }, "Level 1 spell slots");
      const level3 = cleric.levels.find((l: any) => l.level === 3);
      assert(level3, "Level 3 should exist");
      assert.deepStrictEqual(level3.spellSlots, { "1": 4, "2": 2, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0 }, "Level 3 spell slots");
      
      // Test resources from <counter>
      const level2 = cleric.levels.find((l: any) => l.level === 2);
      assert(level2, "Level 2 should exist");
      assert.deepStrictEqual(level2.resources, [{
        name: "Channel Divinity",
        uses: 1,
        recovery: "short_rest",
      }], "Level 2 should have Channel Divinity resource");

      // Test optional feature
      const level8 = cleric.levels.find((l: any) => l.level === 8);
      assert(level8, "Level 8 should exist");
      const optionalFeature = level8.features.find((f: any) => f.name === "Optional: Blessed Strikes");
      assert(optionalFeature, "Optional feature should exist at level 8");
      assert.strictEqual(optionalFeature.optional, true, "Feature should be marked as optional");
      
      // Test prepared spell progression
      const level9 = cleric.levels.find((l: any) => l.level === 9);
      assert(level9, "Level 9 should exist");
      const spellProgressionFeature = level9.features.find((f: any) => f.name === "Circle of the Land Spells");
      assert(spellProgressionFeature, "Spell progression feature should exist at level 9");
      
      assert(spellProgressionFeature.preparedSpellProgression.length > 0, "preparedSpellProgression should be parsed");
      const arcticSpells = spellProgressionFeature.preparedSpellProgression.find((p: any) => p.label === "Arctic Spells");
      assert(arcticSpells, "Arctic Spells table should be parsed");
      assert.deepStrictEqual(arcticSpells.rows[0].spells, ["Hold Person", "Spike Growth"], "3rd level prepared spells should be correct");
    });
  });

  describe("species", () => {
    it("should convert species (races) to canonical v2 format", () => {
      const xml = readFixture("species.xml");
      const result = convertCompendiumXmlToNative(xml);

      const speciesBatch = result.batches.find(b => b.category === 'species');
      assert(speciesBatch, "species batch should be defined");
      const species = speciesBatch.entries as any[];
      assert.strictEqual(species.length, 1, "Should be 1 species in the batch");

      const dwarf = species[0]!;
      assert.strictEqual(dwarf.name, "Test Dwarf");
      assertCanonicalV2Entry("species", dwarf, 0);

      assert.deepStrictEqual(dwarf.vision, [{ type: "Darkvision", range: 60 }], "Should have darkvision");
      assert.deepStrictEqual(dwarf.resistances, ["poison"], "Should have poison resistance");

      const drowLineage = dwarf.traits.find((trait: any) => trait.name === "Drow Lineage");
      assert(drowLineage, "Should preserve the Drow Lineage trait");
      assert.deepStrictEqual(drowLineage.preparedSpellProgression, [{
        label: "Drow Lineage Spells",
        levelLabel: "Character Level",
        spellLabel: "Granted Spells",
        rows: [
          { level: 1, spells: ["Dancing Lights"] },
          { level: 3, spells: ["Faerie Fire"] },
          { level: 5, spells: ["Darkness"] },
        ],
      }], "Should structure prose-based species spell grants at conversion time");
      
      const toolChoice = dwarf.choices.toolChoice;
      assert(toolChoice, "Should have a tool proficiency choice");
      assert.strictEqual(toolChoice.count, 1, "Should choose 1 tool");
      assert.deepStrictEqual(toolChoice.from.sort(), ["Smith's Tools", "Brewer's Supplies", "Mason's Tools"].sort(), "Should have correct tool options");

      assert(dwarf.traits.some((t: any) => t.name === 'Dwarven Combat Training'), "Should have combat training trait");
    });
  });

  describe("backgrounds", () => {
    it("should convert backgrounds to canonical v2 format", () => {
      const xml = readFixture("backgrounds.xml");
      const result = convertCompendiumXmlToNative(xml);
      const backgroundBatch = result.batches.find(b => b.category === 'backgrounds');
      assert(backgroundBatch, "background batch should be defined");
      const backgrounds = backgroundBatch.entries as any[];
      assert.strictEqual(backgrounds.length, 1, "Should be 1 background in the batch");
      const artisan = backgrounds[0]!;
      assert.strictEqual(artisan.name, "Test Artisan");
      assertCanonicalV2Entry("backgrounds", artisan, 0);

      assert.deepStrictEqual(artisan.proficiencies.skills, ["Insight", "Persuasion"], "Should compact fixed skill proficiencies");
      assert.equal(artisan.schemaVersion, undefined, "Batch version makes per-entry schemaVersion redundant");
      assert.equal(artisan.source, undefined, "Null source should be omitted");
      assert.equal(artisan.proficiencies.featChoice, undefined, "Default featChoice should be omitted");
      assert.equal(artisan.proficiencies.abilityScoreChoose, undefined, "Default abilityScoreChoose should be omitted");
      assert.deepStrictEqual(
        artisan.traits,
        [{
          name: "Feature: Guild Membership",
          description: "As an established and respected member of a guild, you can rely on certain benefits that membership provides.",
        }],
        "Only non-duplicated narrative traits should remain",
      );
    });
  });

  describe("feats", () => {
    it("should convert feats to canonical v2 format", () => {
      const xml = readFixture("feats.xml");
      const result = convertCompendiumXmlToNative(xml);
      const featBatch = result.batches.find(b => b.category === 'feats');
      assert(featBatch, "feat batch should be defined");
      const feats = featBatch.entries as any[];
      assert.strictEqual(feats.length, 2, "Should be 2 feats in the batch");
      
      const gwm = feats.find(f => f.name === "Great Weapon Master");
      assert(gwm, "Great Weapon Master should be present");
      assertCanonicalV2Entry("feats", gwm, 0);
      assert.strictEqual(gwm.prerequisite, "Proficiency with a heavy weapon", "GWM prerequisite");

      const magicInitiate = feats.find(f => f.name === "Magic Initiate");
      assert(magicInitiate, "Magic Initiate should be present");
      assertCanonicalV2Entry("feats", magicInitiate, 1);

      const miChoices = (magicInitiate.mechanics as any).choices as any[];
      assert.strictEqual(miChoices.length, 3, "Magic Initiate should have 3 structured choices");

      const classChoice = miChoices.find((c: any) => c.type === "spell_list");
      assert(classChoice, "should have a spell_list choice for class selection");
      assert.deepStrictEqual(
        classChoice.options,
        ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"],
        "class choice should list all valid caster classes",
      );
      assert.strictEqual(classChoice.count, 1, "should choose exactly one class");

      const cantripChoice = miChoices.find((c: any) => c.type === "spell" && c.level === 0);
      assert(cantripChoice, "should have a cantrip choice");
      assert.strictEqual(cantripChoice.count, 2, "should choose 2 cantrips");
      assert.strictEqual(cantripChoice.dependsOnChoiceId, classChoice.id, "cantrip choice must depend on the class choice");
      assert.strictEqual(cantripChoice.dependencyKind, "spell_list");

      const spellChoice = miChoices.find((c: any) => c.type === "spell" && c.level === 1);
      assert(spellChoice, "should have a 1st-level spell choice");
      assert.strictEqual(spellChoice.count, 1, "should choose 1 spell");
      assert.strictEqual(spellChoice.dependsOnChoiceId, classChoice.id, "spell choice must depend on the class choice");
      assert.strictEqual(spellChoice.dependencyKind, "spell_list");
    });
  });

  describe("decks", () => {
    it("should convert decks to canonical v2 format", () => {
      const xml = readFixture("decks.xml");
      const result = convertCompendiumXmlToNative(xml);
      const deckBatch = result.batches.find(b => b.category === 'decks');
      assert(deckBatch, "deck batch should be defined");
      const cards = deckBatch.entries as any[];
      assert.strictEqual(cards.length, 2, "Should be 2 cards in the batch");
      assertCanonicalV2Entry("decks", cards[0], 0);
      assertCanonicalV2Entry("decks", cards[1], 1);
      assert.strictEqual(cards[0].cardName, "Sun");
      assert.strictEqual(cards[1].cardName, "Moon");
    });
  });

  describe("warn-and-continue unknown-field detection", () => {
    function assertWarns(result: { warnings: string[] }, field: string) {
      assert.ok(
        result.warnings.some((w) => w.includes(field)),
        `Expected warning about "${field}" in: ${result.warnings.join("; ")}`,
      );
    }

    it("warns on a monster with an unknown top-level field and still imports it", () => {
      const xml = `<compendium><monster><name>Test</name><cr>1</cr><unknownField>oops</unknownField></monster></compendium>`;
      const result = convertCompendiumXmlToNative(xml);
      assertWarns(result, "unknownField");
      assert.ok(result.batches.some((b) => b.category === "monsters" && b.entries.length === 1));
    });

    it("warns on a spell with an unknown top-level field", () => {
      const xml = `<compendium><spell><name>Test</name><level>1</level><school>V</school><text>A test spell.</text><newTag>oops</newTag></spell></compendium>`;
      assertWarns(convertCompendiumXmlToNative(xml), "newTag");
    });

    it("warns on an item with an unknown top-level field", () => {
      const xml = `<compendium><item><name>Sword</name><type>M</type><text>A sword.</text><enchantmentLevel>3</enchantmentLevel></item></compendium>`;
      assertWarns(convertCompendiumXmlToNative(xml), "enchantmentLevel");
    });

    it("warns on a class with an unknown top-level field", () => {
      const xml = `<compendium><class><name>Wizard</name><hd>6</hd><trait><text>Source: PHB</text></trait><subclassFlavour>oops</subclassFlavour></class></compendium>`;
      assertWarns(convertCompendiumXmlToNative(xml), "subclassFlavour");
    });

    it("warns on a class feature with an unknown sub-field", () => {
      const xml = `<compendium><class><name>Wizard</name><hd>6</hd><autolevel level="1"><feature><name>Arcane Recovery</name><text>Once per day.</text><newMechanic>oops</newMechanic></feature></autolevel></class></compendium>`;
      assertWarns(convertCompendiumXmlToNative(xml), "newMechanic");
    });

    it("warns on a species with an unknown top-level field (e.g. legacy ability tag)", () => {
      const xml = `<compendium><race><name>Dwarf</name><size>M</size><speed>25</speed><ability>Con +2</ability></race></compendium>`;
      assertWarns(convertCompendiumXmlToNative(xml), "ability");
    });

    it("warns on a background with an unknown top-level field", () => {
      const xml = `<compendium><background><name>Noble</name><proficiency>History, Persuasion</proficiency><startingGold>25</startingGold></background></compendium>`;
      assertWarns(convertCompendiumXmlToNative(xml), "startingGold");
    });

    it("warns on a feat with an unknown top-level field", () => {
      const xml = `<compendium><feat><name>Alert</name><text>+5 to initiative.</text><tier>origin</tier></feat></compendium>`;
      assertWarns(convertCompendiumXmlToNative(xml), "tier");
    });

    it("imports all entities and warns — transaction is not rolled back on unknown fields", () => {
      const xml = `<compendium>
        <monster><name>Goblin</name><cr>1/4</cr></monster>
        <monster><name>BadMonster</name><cr>1</cr><hackedField>evil</hackedField></monster>
      </compendium>`;
      const result = convertCompendiumXmlToNative(xml);
      assertWarns(result, "hackedField");
      const monsters = result.batches.find((b) => b.category === "monsters");
      assert.strictEqual(monsters?.entries.length, 2, "both monsters should be imported");
    });
  });

  describe("additional XML field coverage", () => {
    it("warns on unknown deck-card fields and root-level fields", () => {
      const deckResult = convertCompendiumXmlToNative(
        `<deck><card><name>Sun</name><text>Light.</text><rarity>rare</rarity></card></deck>`,
      );
      assert.ok(deckResult.warnings.some((w) => w.includes("rarity")), "deck-card unknown field should warn");

      const rootResult = convertCompendiumXmlToNative(
        `<compendium><monster><name>Test</name><cr>1</cr></monster></compendium><metadata>oops</metadata>`,
      );
      assert.ok(rootResult.warnings.some((w) => w.includes("metadata")), "root-level unknown field should warn");
    });

    it("preserves every top-level class description trait", () => {
      const result = convertCompendiumXmlToNative(`
        <compendium>
          <class>
            <name>Two-Lore Class</name>
            <hd>8</hd>
            <trait><name>First</name><text>First description.</text></trait>
            <trait><name>Second</name><text>Second description.</text></trait>
          </class>
        </compendium>
      `);
      const cls = result.batches.find((batch) => batch.category === "classes")?.entries[0] as any;
      assert.deepStrictEqual(cls.descriptions, ["First description.", "Second description."]);
      assert.strictEqual(cls.description, "First description.");
    });

    it("rejects unsupported class recovery values instead of treating them as long rest", () => {
      assert.throws(
        () => convertCompendiumXmlToNative(`
          <compendium>
            <class>
              <name>Unsafe Recovery</name>
              <hd>8</hd>
              <slotsReset>D</slotsReset>
            </class>
          </compendium>
        `),
        /Unsupported class recovery value "D".*expected S or L/i,
      );
    });

    it("warns on unknown bastion facility fields and continues", () => {
      const result = convertCompendiumXmlToNative(
        `<bastionCompendium><basicFacilities><facility><name>Armory</name><type>basic</type><description>A place for weapons.</description><newRule>oops</newRule></facility></basicFacilities></bastionCompendium>`,
      );
      assert.ok(result.warnings.length > 0, "should have at least one warning");
      assert.ok(
        result.warnings.some((w) => w.includes("newRule")),
        `Expected "newRule" in warnings: ${result.warnings.join(", ")}`,
      );
    });
  });

  describe("bastions", () => {
    it("should convert bastions to canonical v2 format", () => {
      const xml = readFixture("bastions.xml");
      const result = convertCompendiumXmlToNative(xml);
      const bastionBatch = result.batches.find(b => b.category === 'bastions');
      assert(bastionBatch, "bastion batch should be defined");
      const entries = bastionBatch.entries as any[];

      assert.strictEqual(entries.length, 6, "Should include spaces, orders, and facilities");

      const armory = entries.find(e => e.name === "Armory");
      assert(armory, "Armory facility should be present");
      assert.strictEqual(armory.kind, "facility");
      assert.strictEqual(armory.facilityType, "basic");
      assertCanonicalV2Entry("bastions", armory, 0);

      const wizardsTower = entries.find(e => e.name === "Wizard's Tower");
      assert(wizardsTower, "Wizard's Tower facility should be present");
      assert.strictEqual(wizardsTower.kind, "facility");
      assert.strictEqual(wizardsTower.facilityType, "special");
      assert.deepStrictEqual(wizardsTower.orders, ["Harpers"]);
      assertCanonicalV2Entry("bastions", wizardsTower, 1);
    });
  });
});
