import {
  createFeatureEffectId,
  type ActionEffect,
  type AttackEffect,
  type FeatureEffect,
  type FeatureEffectSource,
  type ModifierEffect,
  type NarrativeEffect,
  type WeaponMasteryEffect,
} from "@/domain/character/featureEffects";
import { parseWordCount } from "@/domain/character/parseFeatureEffects.normalizers";

export function parseWeaponMasteryEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const normalizedName = source.name.trim();
  if (!/weapon mastery/i.test(normalizedName) && !/mastery properties of/i.test(text)) return;

  const countMatch =
    text.match(/mastery properties of\s+(\w+)\s+kinds? of/i)
    ?? text.match(/mastery properties of\s+(\d+)\s+kinds? of/i)
    ?? text.match(/mastery properties of\s+(\w+)\s+weapons?/i);
  const count = parseWordCount(countMatch?.[1] ?? "") ?? 0;
  const filters: WeaponMasteryEffect["choice"] extends infer T ? T extends { filters?: infer F } ? F : never : never = [];
  if (/simple/i.test(text)) filters.push("simple_weapon");
  if (/martial/i.test(text)) filters.push("martial_weapon");
  if (/melee/i.test(text)) filters.push("melee_weapon");

  if (count > 0) {
    effects.push({
      id: createFeatureEffectId(source, "weapon_mastery", effects.length),
      type: "weapon_mastery",
      source,
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory: "weapon_mastery",
        filters,
        canReplaceOnReset: /finish a long rest/i.test(text) ? "long_rest" : undefined,
      },
      summary: `Choose ${count} weapon masteries`,
    } satisfies WeaponMasteryEffect);
  }
}

export function parseAttackEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // "gain a +2 bonus to attack rolls and damage rolls with such weapons" — Bracers of Archery, etc.
  // "such weapons" is only treated as ranged when the surrounding text references bows or ranged weapons.
  const hasRangedBowContext = /\b(?:long|short)?bow\b/i.test(text) || /\branged weapons?\b/i.test(text);
  for (const match of text.matchAll(/gain a \+?(\d+)\s+bonus to attack rolls and damage rolls with (such weapons?|(?:long|short)?bows?|ranged weapons?)\b/gi)) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (/with such weapons?/i.test(match[0]) && !hasRangedBowContext) continue;
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "attack_roll",
      mode: "bonus",
      amount: { kind: "fixed", value: amount },
      gate: { duration: "passive", weaponFilters: ["ranged_weapon"] },
      summary: `+${amount} to attack rolls with ranged weapons`,
    } satisfies ModifierEffect);
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "bonus_damage",
      amount: { kind: "fixed", value: amount },
      gate: { duration: "passive", weaponFilters: ["ranged_weapon"] },
      summary: `+${amount} to damage rolls with ranged weapons`,
    } satisfies AttackEffect);
  }

  for (const match of text.matchAll(/gain a \+?(\d+)\s+bonus to damage rolls made with (such weapons?|(?:long|short)?bows?)\b/gi)) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (/with such weapons?/i.test(match[0]) && !hasRangedBowContext) continue;
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "bonus_damage",
      amount: { kind: "fixed", value: amount },
      gate: { duration: "passive", weaponFilters: ["longbow_or_shortbow"] },
      summary: `+${amount} to damage rolls with longbows and shortbows`,
    } satisfies AttackEffect);
  }

  if (/martial arts die/i.test(text) && /unarmed strike/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "damage_die_override",
      amount: { kind: "named_progression", key: "monk_martial_arts_die" },
      gate: {
        duration: "passive",
        notes: "unarmed_or_monk_weapon",
      },
      summary: "Martial Arts damage die replaces normal Unarmed Strike or Monk weapon damage.",
    } satisfies AttackEffect);
  }

  if (/bardic inspiration die plus your dexterity modifier/i.test(text) && /instead of the strike'?s normal damage/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "damage_die_override",
      amount: { kind: "named_progression", key: "bardic_inspiration_die" },
      gate: {
        duration: "passive",
        notes: "unarmed_only",
      },
      summary: "Use your Bardic Inspiration die for Unarmed Strike damage.",
    } satisfies AttackEffect);
  }

  if (/dexterity(?:\s+modifier)?\s+instead of (?:your\s+)?strength(?:\s+modifier)?/i.test(text) && /unarmed strikes?/i.test(text)) {
    const appliesToMonkWeapons = /monk weapons?/i.test(text);
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "weapon_ability_override",
      ability: "dex",
      gate: {
        duration: "passive",
        notes: appliesToMonkWeapons ? "unarmed_or_monk_weapon" : "unarmed_only",
      },
      summary: appliesToMonkWeapons
        ? "Use Dexterity for Unarmed Strikes and Monk weapons."
        : "Use Dexterity for Unarmed Strikes.",
    } satisfies AttackEffect);
  }

  if (/extra attack as a result of using a weapon that has the Light property/i.test(text) && /add your ability modifier to the damage of that attack/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "add_ability_to_damage",
      gate: {
        duration: "passive",
        weaponFilters: ["light_weapon"],
        notes: "extra_attack_damage",
      },
      summary: "Add your ability modifier to the Light-property extra attack damage.",
    } satisfies AttackEffect);
  }

  if (/add your ability modifier to the damage of the extra attack/i.test(text) && /crossbow that has the Light property/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "add_ability_to_damage",
      gate: {
        duration: "passive",
        weaponFilters: ["light_crossbow"],
        notes: "extra_attack_damage",
      },
      summary: "Add your ability modifier to the Light crossbow extra attack damage.",
    } satisfies AttackEffect);
  }

  if (/make one extra attack as a Bonus Action/i.test(text) && /different weapon, which must be a Melee weapon that lacks the Two-Handed property/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "triggered_attack",
      gate: {
        duration: "passive",
        weaponFilters: ["melee_weapon", "no_two_handed"],
        notes: "light_property_bonus_attack",
      },
      frequency: "special",
      summary: "After a Light-weapon attack, you can make a bonus-action attack with a different melee weapon that lacks Two-Handed.",
    } satisfies AttackEffect);
  }

  if (/rage damage/i.test(text) && /using strength/i.test(text) && /weapon|unarmed strike/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "bonus_damage",
      amount: { kind: "named_progression", key: "barbarian_rage_damage" },
      damageType: "same_as_attack",
      gate: {
        duration: "while_raging",
        attackAbility: "str",
        notes: "weapon_or_unarmed",
      },
      summary: "Rage Damage bonus on Strength weapon and unarmed attacks",
    } satisfies AttackEffect);
  }

  // Unarmed Fighting: unarmed strikes deal 1d6 (1d8 empty-handed) + STR Bludgeoning;
  // grappled-creature damage is a separate triggered effect described in the summary.
  if (/unarmed strike/i.test(text) && /1d[68]\b/i.test(text) && /bludgeoning/i.test(text) && /strength modifier/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "damage_die_override",
      resolution: "automatic",
      amount: { kind: "fixed", dice: "1d6" },
      alternateAmount: { kind: "fixed", dice: "1d8" },
      alternateWhen: "no_weapon_or_shield",
      damageType: "bludgeoning",
      gate: { duration: "passive", notes: "unarmed_only" },
      summary: "Unarmed Strikes deal 1d6 + STR, or 1d8 + STR while holding no weapon or Shield.",
    } satisfies AttackEffect);
    if (/start of each of your turns/i.test(text) && /\b1d4\b/i.test(text) && /\bGrappled\b/i.test(text)) {
      effects.push({
        id: createFeatureEffectId(source, "narrative", effects.length),
        type: "narrative",
        source,
        category: "manual_resolution",
        resolution: "manual",
        description: "At the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature Grappled by you.",
        summary: "Manual: optional 1d4 damage to one creature Grappled by you at the start of your turn.",
      } satisfies NarrativeEffect);
    }
  }

  // Interception: reaction to reduce damage dealt to a nearby creature.
  if (/\btake a Reaction\b/i.test(text) && /reduce the damage dealt to the target\b/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "action", effects.length),
      type: "action",
      source,
      activation: "reaction",
      resolution: "manual",
      description: "When a creature you see hits another creature within 5 feet of you, reduce the damage dealt by 1d10 + Proficiency Bonus (minimum 0). Requires holding a Shield or weapon.",
      summary: "Manual reaction: reduce damage dealt to nearby creature by 1d10 + PB.",
    } satisfies ActionEffect);
  }

  // Protection: reaction to impose Disadvantage on an attack against a nearby ally.
  if (/\btake a Reaction\b/i.test(text) && /interpose your Shield\b/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "action", effects.length),
      type: "action",
      source,
      activation: "reaction",
      resolution: "manual",
      description: "When a creature you see attacks a target within 5 feet of you, impose Disadvantage on that attack roll and all further attacks against the target until your next turn. Requires Shield.",
      summary: "Manual reaction: impose Disadvantage on attacks against a nearby ally (requires Shield).",
    } satisfies ActionEffect);
  }

  if (
    /weapon that has the Heavy property/i.test(text)
    && /extra damage/i.test(text)
    && /equals your Proficiency Bonus/i.test(text)
  ) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "bonus_damage",
      amount: { kind: "proficiency_bonus" },
      gate: {
        duration: "passive",
        weaponFilters: ["heavy_weapon"],
      },
      summary: "Heavy weapon hits deal extra damage equal to Proficiency Bonus",
    } satisfies AttackEffect);
  }
}
