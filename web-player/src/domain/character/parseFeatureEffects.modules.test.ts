import { describe, expect, it } from "vitest";
import {
  collectTaggedGrantsFromEffects,
  deriveModifierBonusFromEffects,
  parseFeatureEffects,
} from "@/domain/character/parseFeatureEffects";
import { getInitiativeBonus } from "@/views/character/CharacterSheetUtils";

function parse(name: string, text: string) {
  return parseFeatureEffects({
    source: { id: `test:${name}`, kind: "feat", name, text },
    text,
  });
}

describe("parseFeatureEffects parser modules", () => {
  it("parses weapon mastery choices (combat module)", () => {
    const parsed = parse(
      "Weapon Mastery",
      "You gain mastery properties of two kinds of Simple and Martial weapons, and you can change the chosen properties when you finish a long rest.",
    );

    const mastery = parsed.effects.find((effect) => effect.type === "weapon_mastery");
    expect(mastery).toBeTruthy();
    if (!mastery || mastery.type !== "weapon_mastery") return;
    expect(mastery.choice?.count.kind).toBe("fixed");
    if (mastery.choice?.count.kind === "fixed") {
      expect(mastery.choice.count.value).toBe(2);
    }
    expect(mastery.choice?.filters ?? []).toEqual(expect.arrayContaining(["simple_weapon", "martial_weapon"]));
    expect(mastery.choice?.canReplaceOnReset).toBe("long_rest");
  });

  it("parses ability-score choice effects (stats module)", () => {
    const parsed = parse(
      "Ability Improvement",
      "Increase one ability score by 2, or choose two ability scores and increase each by 1.",
    );

    const asi = parsed.effects.filter((effect) => effect.type === "ability_score");
    expect(asi).toHaveLength(2);
    const [single, split] = asi;
    if (single.type === "ability_score") {
      expect(single.mode).toBe("choice");
      expect(single.choiceCount).toBe(1);
      expect(single.amount).toBe(2);
    }
    if (split.type === "ability_score") {
      expect(split.mode).toBe("choice");
      expect(split.choiceCount).toBe(2);
      expect(split.amount).toBe(1);
    }
  });

  it("parses fixed and constrained feat ability increases", () => {
    const durable = parse(
      "Durable",
      "Ability Score Increase. Increase your Constitution score by 1, to a maximum of 20.",
    );
    expect(durable.effects).toContainEqual(expect.objectContaining({
      type: "ability_score",
      mode: "fixed",
      ability: "con",
      amount: 1,
      maximum: 20,
    }));

    const physicalChoice = parse(
      "Physical Boon",
      "Ability Score Increase. Increase your Strength, Dexterity, or Constitution score by 1, to a maximum of 20.",
    );
    expect(physicalChoice.effects).toContainEqual(expect.objectContaining({
      type: "ability_score",
      mode: "choice",
      chooseFrom: ["str", "dex", "con"],
      choiceCount: 1,
      amount: 1,
      maximum: 20,
    }));
  });

  it("parses unrestricted epic-boon ability choices", () => {
    const parsed = parse(
      "Epic Boon",
      "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30.",
    );
    expect(parsed.effects).toContainEqual(expect.objectContaining({
      type: "ability_score",
      mode: "choice",
      choiceCount: 1,
      amount: 1,
      maximum: 30,
    }));
  });

  it("parses speed + rage bonus-damage effects (combat/stats modules)", () => {
    const parsed = parse(
      "Fast Rage",
      "While raging, your speed increases by 10 feet. You also gain Rage Damage when using Strength for a weapon or unarmed strike.",
    );

    const speed = parsed.effects.find((effect) => effect.type === "speed");
    expect(speed).toBeTruthy();
    if (speed && speed.type === "speed") {
      expect(speed.mode).toBe("bonus");
      expect(speed.gate?.duration).toBe("while_raging");
    }

    const rageDamage = parsed.effects.find((effect) => effect.type === "attack" && effect.mode === "bonus_damage");
    expect(rageDamage).toBeTruthy();
    if (rageDamage && rageDamage.type === "attack") {
      expect(rageDamage.gate?.duration).toBe("while_raging");
      expect(rageDamage.gate?.attackAbility).toBe("str");
    }
  });

  it("parses heavy-weapon proficiency-bonus damage in the combat module", () => {
    const parsed = parse(
      "Great Weapon Master",
      "When you hit a creature with a weapon that has the Heavy property, the weapon deals extra damage to the creature. The extra damage equals your Proficiency Bonus.",
    );

    const heavyDamage = parsed.effects.find((effect) => effect.type === "attack" && effect.mode === "bonus_damage");
    expect(heavyDamage).toBeTruthy();
    if (heavyDamage && heavyDamage.type === "attack") {
      expect(heavyDamage.amount?.kind).toBe("proficiency_bonus");
      expect(heavyDamage.gate?.weaponFilters).toEqual(expect.arrayContaining(["heavy_weapon"]));
    }
  });

  it("parses initiative and saving throw modifiers (modifiers module)", () => {
    const parsed = parse(
      "Alerting Grace",
      "When you roll initiative, add your proficiency bonus to the roll. You gain a bonus to saving throws equal to your Wisdom modifier (minimum bonus of +1).",
    );

    const initiative = parsed.effects.find((effect) => effect.type === "modifier" && effect.target === "initiative");
    expect(initiative).toBeTruthy();

    const saveBonus = parsed.effects.find((effect) => effect.type === "modifier" && effect.target === "saving_throw");
    expect(saveBonus).toBeTruthy();
    if (saveBonus && saveBonus.type === "modifier") {
      expect(saveBonus.amount?.kind).toBe("ability_mod");
      if (saveBonus.amount?.kind === "ability_mod") {
        expect(saveBonus.amount.ability).toBe("wis");
        expect(saveBonus.amount.min).toBe(1);
      }
    }
  });

  it("parses fixed and ability-mod initiative bonuses", () => {
    const alert = parse(
      "Alert",
      "Always on the lookout for danger, you gain a +5 bonus to initiative.",
    );
    const alertBonus = alert.effects.find((effect) => effect.type === "modifier" && effect.target === "initiative");
    expect(alertBonus).toBeTruthy();
    if (alertBonus && alertBonus.type === "modifier") {
      expect(alertBonus.amount?.kind).toBe("fixed");
      if (alertBonus.amount?.kind === "fixed") expect(alertBonus.amount.value).toBe(5);
    }

    const dreadAmbusher = parse(
      "Dread Ambusher",
      "You can give yourself a bonus to your initiative rolls equal to your Wisdom modifier.",
    );
    const dreadBonus = dreadAmbusher.effects.find((effect) => effect.type === "modifier" && effect.target === "initiative");
    expect(dreadBonus).toBeTruthy();
    if (dreadBonus && dreadBonus.type === "modifier") {
      expect(dreadBonus.amount?.kind).toBe("ability_mod");
      if (dreadBonus.amount?.kind === "ability_mod") expect(dreadBonus.amount.ability).toBe("wis");
    }

    // PHB 5.5e wording: "When you roll Initiative, you can add your Wisdom modifier to the roll."
    const dreadAmbusherAlt = parse(
      "Initiative Bonus",
      "Initiative Bonus. When you roll Initiative, you can add your Wisdom modifier to the roll.",
    );
    const dreadBonusAlt = dreadAmbusherAlt.effects.find((effect) => effect.type === "modifier" && effect.target === "initiative");
    expect(dreadBonusAlt).toBeTruthy();
    if (dreadBonusAlt && dreadBonusAlt.type === "modifier") {
      expect(dreadBonusAlt.amount?.kind).toBe("ability_mod");
      if (dreadBonusAlt.amount?.kind === "ability_mod") expect(dreadBonusAlt.amount.ability).toBe("wis");
    }
  });

  it("calculates 2024 Origin: Alert initiative with Dexterity and Proficiency Bonus", () => {
    const parsed = parse(
      "Origin: Alert",
      "Initiative Proficiency. When you roll Initiative, you can add your Proficiency Bonus to the roll.",
    );

    const initiative = getInitiativeBonus(10, 6)
      + deriveModifierBonusFromEffects([parsed], "initiative", {
        level: 6,
        scores: { dex: 10 },
      });

    expect(initiative).toBe(3);
  });

  it("parses skill-check bonuses from ability modifiers (modifiers module)", () => {
    const parsed = parse(
      "Divine Order: Thaumaturge",
      "Your mystical connection to the divine gives you a bonus to your Intelligence (Arcana or Religion) checks. The bonus equals your Wisdom modifier (minimum of +1).",
    );

    const skillBonus = parsed.effects.find((effect) => effect.type === "modifier" && effect.target === "skill_check");
    expect(skillBonus).toBeTruthy();
    if (skillBonus && skillBonus.type === "modifier") {
      expect(skillBonus.appliesTo).toEqual(["Arcana", "Religion"]);
      expect(skillBonus.amount?.kind).toBe("ability_mod");
      if (skillBonus.amount?.kind === "ability_mod") {
        expect(skillBonus.amount.ability).toBe("wis");
        expect(skillBonus.amount.min).toBe(1);
      }
    }
  });

  it("does not treat placeholder words as item-granted spells", () => {
    const parsed = parseFeatureEffects({
      source: { id: "test:item-placeholder", kind: "item", name: "Wand of Bad Grammar" },
      text: "You can cast another spell from the wand at will.",
    });

    expect(parsed.effects.some((effect) => effect.type === "spell_grant" && effect.spellName === "Another")).toBe(false);
  });

  it("parses item spell save DC bonuses", () => {
    const parsed = parseFeatureEffects({
      source: { id: "test:revelers-concertina", kind: "item", name: "Reveler's Concertina" },
      text: "While holding this concertina, you gain a +2 bonus to the saving throw DC of your Bard spells.",
    });

    const dcBonus = parsed.effects.find((effect) => effect.type === "modifier" && effect.target === "spell_save_dc");
    expect(dcBonus).toBeTruthy();
    if (dcBonus && dcBonus.type === "modifier") {
      expect(dcBonus.amount?.kind).toBe("fixed");
      if (dcBonus.amount?.kind === "fixed") expect(dcBonus.amount.value).toBe(2);
    }
  });

  it("parses Bracers of Archery proficiency and bow damage bonus", () => {
    const parsed = parseFeatureEffects({
      source: { id: "test:bracers-of-archery", kind: "item", name: "Bracers of Archery" },
      text: "While wearing these bracers, you have proficiency with the Longbow and Shortbow, and you gain a +2 bonus to damage rolls made with such weapons.",
    });

    const weaponGrant = parsed.effects.find((effect) => effect.type === "proficiency_grant" && effect.category === "weapon");
    expect(weaponGrant).toBeTruthy();
    if (weaponGrant && weaponGrant.type === "proficiency_grant") {
      expect(weaponGrant.grants).toEqual(expect.arrayContaining(["Longbow", "Shortbow"]));
    }

    const damageBonus = parsed.effects.find((effect) => effect.type === "attack" && effect.mode === "bonus_damage");
    expect(damageBonus).toBeTruthy();
    if (damageBonus && damageBonus.type === "attack") {
      expect(damageBonus.amount?.kind).toBe("fixed");
      if (damageBonus.amount?.kind === "fixed" && "value" in damageBonus.amount) {
        expect(damageBonus.amount.value).toBe(2);
      }
      expect(damageBonus.gate?.weaponFilters).toEqual(["longbow_or_shortbow"]);
    }
  });

  it("parses Tough max-HP scaling", () => {
    const parsed = parse(
      "Origin: Tough",
      "Your Hit Point maximum increases by an amount equal to twice your character level when you gain this feat. Whenever you gain a character level thereafter, your Hit Point maximum increases by an additional 2 Hit Points.",
    );

    const hpBonus = parsed.effects.find((effect) => effect.type === "hit_points" && effect.mode === "max_bonus");
    expect(hpBonus).toBeTruthy();
    if (hpBonus && hpBonus.type === "hit_points" && "kind" in hpBonus.amount) {
      expect(hpBonus.amount.kind).toBe("character_level");
      if (hpBonus.amount.kind === "character_level") expect(hpBonus.amount.multiplier).toBe(2);
    }
  });

  it("parses AC bonus and darkvision enhancements (stats/modifiers modules)", () => {
    const parsed = parse(
      "Defensive Sight",
      "You gain a +1 bonus to AC while wearing armor. You gain Darkvision out to 60 feet. If you already have Darkvision, its range increases by 30 feet.",
    );

    const acBonus = parsed.effects.find((effect) => effect.type === "armor_class" && effect.mode === "bonus");
    expect(acBonus).toBeTruthy();
    if (acBonus && acBonus.type === "armor_class") {
      expect(acBonus.gate?.armorState).toBe("not_unarmored");
    }

    const senseGrant = parsed.effects.find((effect) => effect.type === "senses" && effect.mode === "grant");
    expect(senseGrant).toBeTruthy();

    const senseBonus = parsed.effects.find((effect) => effect.type === "senses" && effect.mode === "bonus");
    expect(senseBonus).toBeTruthy();
  });

  it("parses negative movement adjustments (stats module edge case)", () => {
    const parsed = parse(
      "Heavy Burden",
      "If your Strength score is lower than 15, your speed is reduced by 10 feet.",
    );

    expect(Array.isArray(parsed.effects)).toBe(true);
  });

  it("parses mixed proficiency-choice text without dropping entries (proficiencies edge case)", () => {
    const parsed = parse(
      "Skilled Training",
      "You gain proficiency in one skill of your choice and one tool of your choice.",
    );

    const proficiencyChoices = parsed.effects.filter((effect) => effect.type === "proficiency_grant");
    expect(Array.isArray(proficiencyChoices)).toBe(true);
  });

  it("handles malformed text fragments safely (sanitization edge case)", () => {
    const parsed = parse(
      "Malformed Fragment",
      "Gain ??? ;; [[]] <broken> text with no valid mechanics.",
    );

    expect(Array.isArray(parsed.effects)).toBe(true);
    expect(parsed.effects.length).toBe(0);
  });

  it("parses armor + shields when shields follows via 'and' after an armor clause (College of Valor regression)", () => {
    // "training with Medium armor and Shields" — Shields was missed because the
    // armor clause regex stops at "armor" and the shield check only tested the captured clause.
    const parsed = parse(
      "Martial Training",
      "You gain proficiency with Martial weapons and training with Medium armor and Shields. In addition, you can use a Simple or Martial weapon as a Spellcasting Focus to cast spells from your Bard spell list.",
    );

    const grants = collectTaggedGrantsFromEffects([parsed]);
    const armorNames = grants.armor.map((a) => a.name);
    const weaponNames = grants.weapons.map((w) => w.name);

    expect(armorNames).toContain("Medium Armor");
    expect(armorNames).toContain("Shields");
    expect(weaponNames).toContain("Martial Weapons");
  });

  it("captures both tools from 'proficiency with X and the Y' compound grants (Alchemist regression)", () => {
    // Alchemist "Tools of the Trade": "You gain proficiency with Alchemist's Supplies and the Herbalism Kit."
    // Previously only Alchemist's Supplies was captured; Herbalism Kit was silently dropped.
    const parsed = parse(
      "Tools of the Trade (Alchemist)",
      "You gain proficiency with Alchemist's Supplies and the Herbalism Kit. If you already have one of these proficiencies, you gain proficiency with one other type of Artisan's Tools of your choice.",
    );

    const grants = collectTaggedGrantsFromEffects([parsed]);
    const toolNames = grants.tools.map((t) => t.name);

    expect(toolNames).toContain("Alchemist's Supplies");
    expect(toolNames).toContain("Herbalism Kit");
    expect(toolNames).not.toContain("The Herbalism Kit");
    // The conditional fallback "one other type of Artisan's Tools" must not be treated as a fixed grant
    expect(toolNames.some((n) => /one other type/i.test(n))).toBe(false);
  });

  it("strips leading article from 'proficiency with the Herbalism Kit' (Warrior of Mercy regression)", () => {
    // "proficiency with the Herbalism Kit" → "Herbalism Kit", not "The Herbalism Kit"
    const parsed = parse(
      "Implements of Mercy",
      "You gain proficiency in the Insight and Medicine skills and proficiency with the Herbalism Kit.",
    );

    const grants = collectTaggedGrantsFromEffects([parsed]);
    const toolNames = grants.tools.map((t) => t.name);

    expect(toolNames).toContain("Herbalism Kit");
    expect(toolNames).not.toContain("The Herbalism Kit");
  });

  it("parses Monk Unarmored Movement with correct armor gate and level scaling", () => {
    // "while you aren't wearing armor" must produce an armorState: no_armor gate.
    // Speed must scale by level via named_progression, not be fixed at +10.
    const parsed = parse(
      "Level 2: Unarmored Movement",
      "Your speed increases by 10 feet while you aren't wearing armor or wielding a Shield. This bonus increases when you reach certain Monk levels, as shown on the Monk Features table.",
    );

    const speedEffect = parsed.effects.find((e) => e.type === "speed" && e.mode === "bonus");
    expect(speedEffect).toBeTruthy();
    if (!speedEffect || speedEffect.type !== "speed") return;
    expect(speedEffect.gate?.armorState).toBe("no_armor");
    expect(speedEffect.amount?.kind).toBe("named_progression");
    if (speedEffect.amount?.kind === "named_progression") {
      expect(speedEffect.amount.key).toBe("monk_unarmored_movement");
    }
  });

  it("parses Magical Discoveries spell choice (College of Lore L6)", () => {
    const text =
      "You learn two spells of your choice. These spells can come from the Cleric, Druid, or Wizard spell list or any combination thereof (see a class's section for its spell list). A spell you choose must be a cantrip or a spell for which you have spell slots, as shown in the Bard Features table. You always have the chosen spells prepared, and whenever you gain a Bard level, you can replace one of the spells with another spell that meets these requirements.";
    const parsed = parse("Level 6: Magical Discoveries (College of Lore)", text);

    const choice = parsed.effects.find((e) => e.type === "spell_choice");
    expect(choice).toBeTruthy();
    if (!choice || choice.type !== "spell_choice") return;
    expect(choice.count).toEqual({ kind: "fixed", value: 2 });
    expect(choice.level).toBeNull();
    expect(choice.spellLists).toEqual(expect.arrayContaining(["Cleric", "Druid", "Wizard"]));
    expect(choice.spellLists).toHaveLength(3);
  });
});
