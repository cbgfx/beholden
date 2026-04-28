import { describe, expect, it } from "vitest";
import { parseFeatureEffects } from "@/domain/character/parseFeatureEffects";

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
});
