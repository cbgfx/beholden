import assert from "node:assert";
import { describe, it } from "node:test";
import { parseFeat } from "./featParser.js";
import { classifyFeatResolution } from "./featResolution.js";

const MAGIC_INITIATE_TEXT =
  "Choose a class: bard, cleric, druid, sorcerer, warlock, or wizard. " +
  "You learn two cantrips of your choice from that class's spell list. " +
  "In addition, choose one 1st-level spell from that same list. " +
  "You learn that spell and can cast it at its lowest level. " +
  "Once you cast it, you must finish a long rest before you can cast it again using this feat.";

describe("parseFeat – proficiency bonus uses (generic resource pattern)", () => {
  const LUCKY_TEXT =
    "You gain the following benefits.\n\n" +
    "Luck Points. You have a number of Luck Points equal to your Proficiency Bonus and can spend the points on the benefits below. " +
    "You regain your expended Luck Points when you finish a Long Rest.\n\n" +
    "Advantage. When you roll a d20 for a D20 Test, you can spend 1 Luck Point to give yourself Advantage on the roll.\n\n" +
    "Disadvantage. When a creature rolls a d20 for an attack roll against you, you can spend 1 Luck Point to impose Disadvantage on that roll.";

  it("detects one use entry from 'a number of Luck Points equal to your Proficiency Bonus'", () => {
    const result = parseFeat({ name: "Origin: Lucky", text: LUCKY_TEXT });
    assert.strictEqual(result.uses.length, 1, "should detect exactly one use entry");
  });

  it("sets countFrom to proficiency_bonus", () => {
    const result = parseFeat({ name: "Origin: Lucky", text: LUCKY_TEXT });
    assert.strictEqual(result.uses[0]?.countFrom, "proficiency_bonus");
  });

  it("sets recharge to long_rest", () => {
    const result = parseFeat({ name: "Origin: Lucky", text: LUCKY_TEXT });
    assert.strictEqual(result.uses[0]?.recharge, "long_rest");
  });

  it("does NOT detect uses for 'Roll a number of d6s equal to your Proficiency Bonus'", () => {
    const vampireHunterText =
      "Vitality Ward. When you take Necrotic damage, you can take a Reaction to mitigate the damage. " +
      "Roll a number of d6s equal to your Proficiency Bonus, and add them together. " +
      "Reduce the Necrotic damage you take by this total. Once you use this benefit, " +
      "you can't use it again until you finish a Short or Long Rest.";
    const result = parseFeat({ name: "Origin: Vampire Hunter", text: vampireHunterText });
    assert.strictEqual(
      result.uses.length,
      0,
      "dice-roll count should not produce a use entry — it is not a tracked resource"
    );
  });
});

describe("parseFeat – class spell list pattern (Magic Initiate)", () => {
  it("produces three structured choices", () => {
    const result = parseFeat({ name: "Magic Initiate", text: MAGIC_INITIATE_TEXT });
    assert.strictEqual(result.choices.length, 3, "should have exactly 3 choices");
  });

  it("first choice is a spell_list choice with the six classes as options", () => {
    const result = parseFeat({ name: "Magic Initiate", text: MAGIC_INITIATE_TEXT });
    const classChoice = result.choices[0]!;
    assert.strictEqual(classChoice.type, "spell_list");
    assert.strictEqual(classChoice.count, 1);
    assert.deepStrictEqual(
      classChoice.options,
      ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"],
    );
    assert.strictEqual(classChoice.dependsOnChoiceId ?? null, null);
    assert.strictEqual(classChoice.dependencyKind ?? null, null);
  });

  it("second choice is a cantrip spell choice linked to the class choice", () => {
    const result = parseFeat({ name: "Magic Initiate", text: MAGIC_INITIATE_TEXT });
    const classChoice = result.choices[0]!;
    const cantripChoice = result.choices[1]!;
    assert.strictEqual(cantripChoice.type, "spell");
    assert.strictEqual(cantripChoice.count, 2);
    assert.strictEqual(cantripChoice.level, 0);
    assert.strictEqual(cantripChoice.options, null, "options null – resolved at play time from chosen list");
    assert.strictEqual(cantripChoice.dependsOnChoiceId, classChoice.id);
    assert.strictEqual(cantripChoice.dependencyKind, "spell_list");
  });

  it("third choice is a 1st-level spell choice linked to the same class choice", () => {
    const result = parseFeat({ name: "Magic Initiate", text: MAGIC_INITIATE_TEXT });
    const classChoice = result.choices[0]!;
    const spellChoice = result.choices[2]!;
    assert.strictEqual(spellChoice.type, "spell");
    assert.strictEqual(spellChoice.count, 1);
    assert.strictEqual(spellChoice.level, 1);
    assert.strictEqual(spellChoice.options, null);
    assert.strictEqual(spellChoice.dependsOnChoiceId, classChoice.id);
    assert.strictEqual(spellChoice.dependencyKind, "spell_list");
  });

  it("adds a long rest note from the recovery sentence", () => {
    const result = parseFeat({ name: "Magic Initiate", text: MAGIC_INITIATE_TEXT });
    assert(
      result.notes.some((n) => /long rest/i.test(n)),
      "should note the long-rest recovery restriction",
    );
  });

  it("generic variant: one cantrip + 2nd-level spell from a single class list", () => {
    const text =
      "Choose a class: druid or ranger. " +
      "You learn one cantrip of your choice from that class's spell list. " +
      "Also choose one 2nd-level spell from that same list.";
    const result = parseFeat({ name: "Nature Initiate", text });
    assert.strictEqual(result.choices.length, 3);
    const [classC, cantripC, spellC] = result.choices;
    assert.strictEqual(classC!.type, "spell_list");
    assert.deepStrictEqual(classC!.options, ["druid", "ranger"]);
    assert.strictEqual(cantripC!.count, 1);
    assert.strictEqual(cantripC!.level, 0);
    assert.strictEqual(spellC!.level, 2);
  });

  it("preserves a multi-spell choice count", () => {
    const text =
      "Choose a class: cleric or wizard. " +
      "You learn one cantrip of your choice from that class's spell list. " +
      "Also choose two 2nd-level spells from that same list.";
    const result = parseFeat({ name: "Advanced Initiate", text });
    const spellChoice = result.choices.find((choice) => choice.type === "spell" && choice.level === 2);
    assert(spellChoice);
    assert.strictEqual(spellChoice.count, 2);
  });
});

describe("parseFeat – Fighting Style mechanics", () => {
  it("encodes Dueling and Thrown Weapon Fighting damage bonuses", () => {
    const dueling = parseFeat({
      name: "Fighting Style: Dueling",
      text: "When you are holding a Melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
    });
    assert.deepStrictEqual(
      dueling.grants.effects,
      [{
        type: "modifier",
        target: "damage_roll",
        mode: "bonus",
        resolution: "automatic",
        amount: { kind: "fixed", value: 2 },
        gate: {
          duration: "passive",
          weaponFilters: ["melee_weapon", "no_offhand", "no_two_handed"],
        },
        summary: "+2 to damage rolls (melee, one hand, no other weapons)",
      }],
    );

    const thrown = parseFeat({
      name: "Fighting Style: Thrown Weapon Fighting",
      text: "When you hit with a ranged attack using a weapon that has the Thrown property, you gain a +2 bonus to the damage roll.",
    });
    assert.equal((thrown.grants.effects[0] as { type?: string }).type, "modifier");
    assert.deepStrictEqual(
      (thrown.grants.effects[0] as { gate?: { weaponFilters?: string[] } }).gate?.weaponFilters,
      ["thrown_weapon"],
    );
  });

  it("restricts Blessed Warrior to Cleric cantrips using Charisma", () => {
    const result = parseFeat({
      name: "Fighting Style: Blessed Warrior",
      text: "You learn two Cleric cantrips of your choice. The chosen cantrips count as Paladin spells for you, and Charisma is your spellcasting ability for them.",
      prerequisite: "Paladin Class",
    });
    assert.equal(result.choices.length, 1);
    assert.equal(result.choices[0]?.type, "spell");
    assert.equal(result.choices[0]?.level, 0);
    assert.equal(result.choices[0]?.count, 2);
    assert.deepStrictEqual(result.choices[0]?.options, ["Cleric"]);
    assert.equal(result.spellcastingAbility, "cha");
  });

  it("marks reactions and Great Weapon Fighting as intentionally manual", () => {
    const greatWeapon = parseFeat({
      name: "Fighting Style: Great Weapon Fighting",
      text: "When you roll damage for an attack with a Melee weapon held in two hands, treat any 1 or 2 on a damage die as a 3.",
    });
    const greatWeaponEffect = greatWeapon.grants.effects[0] as Record<string, unknown>;
    assert.equal(greatWeaponEffect.type, "narrative");
    assert.equal(greatWeaponEffect.category, "manual_resolution");
    assert.equal(greatWeaponEffect.resolution, "manual");
    assert.match(String(greatWeaponEffect.description), /treat any 1 or 2 .* as a 3/i);

    for (const name of ["Interception", "Protection"]) {
      const result = parseFeat({
        name: `Fighting Style: ${name}`,
        text: `${name} reaction.`,
      });
      const effect = result.grants.effects[0] as Record<string, unknown>;
      assert.equal(effect.type, "action");
      assert.equal(effect.activation, "reaction");
      assert.equal(effect.resolution, "manual");
    }
  });

  it("splits Unarmed Fighting into automatic dice display and a manual grapple rider", () => {
    const result = parseFeat({
      name: "Fighting Style: Unarmed Fighting",
      text: "Your Unarmed Strike deals 1d6 plus your Strength modifier, or 1d8 while holding no weapons or Shield. At the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature Grappled by you.",
    });
    const automatic = result.grants.effects[0] as Record<string, unknown>;
    assert.equal(automatic.type, "attack");
    assert.equal(automatic.mode, "damage_die_override");
    assert.equal(automatic.resolution, "automatic");
    assert.deepStrictEqual(automatic.amount, { kind: "fixed", dice: "1d6" });
    assert.deepStrictEqual(automatic.alternateAmount, { kind: "fixed", dice: "1d8" });
    assert.equal(automatic.alternateWhen, "no_weapon_or_shield");

    const manual = result.grants.effects[1] as Record<string, unknown>;
    assert.equal(manual.type, "narrative");
    assert.equal(manual.category, "manual_resolution");
    assert.equal(manual.resolution, "manual");
    assert.match(String(manual.description), /1d4 Bludgeoning damage/i);
  });
});

describe("feat resolution classification", () => {
  it("marks reviewed deterministic feats automatic", () => {
    const result = parseFeat({
      name: "Origin: Tough",
      text: "Your Hit Point maximum increases by an amount equal to twice your character level.",
    });
    assert.equal(result.resolution, "automatic");
    assert.deepStrictEqual(result.resolutionNotes, []);
  });

  it("marks feats with automatic and adjudicated benefits mixed", () => {
    const result = parseFeat({
      name: "Origin: Alert",
      text: "Add your Proficiency Bonus to Initiative. Immediately after rolling Initiative, you can swap your Initiative with one willing ally in the same combat.",
    });
    assert.equal(result.resolution, "mixed");
    assert.ok(result.resolutionNotes.some((note) => /swap Initiative/i.test(note)));
  });

  it("marks bespoke adjudicated feats manual", () => {
    const result = parseFeat({
      name: "Origin: Healer",
      text: "You gain the Battle Medic and Healing Rerolls benefits.",
    });
    assert.equal(result.resolution, "manual");
    assert.ok(result.resolutionNotes.length > 0);
  });

  it("keeps unreviewed structured feats mixed until deliberately promoted", () => {
    const result = classifyFeatResolution("Unreviewed Structured Feat", {
      grants: { skills: ["Arcana"], effects: [] },
      choices: [],
      uses: [],
    });
    assert.equal(result.resolution, "mixed");
    assert.match(result.resolutionNotes[0] ?? "", /until reviewed/i);
  });

  it("marks mechanics with no deterministic data manual", () => {
    const result = classifyFeatResolution("Empty Feat", {});
    assert.equal(result.resolution, "manual");
    assert.match(result.resolutionNotes[0] ?? "", /resolve this feat manually/i);
  });
});
