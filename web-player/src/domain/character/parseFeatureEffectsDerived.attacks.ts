import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import type {
  ModifierEffect,
  ParsedFeatureEffects,
  ScalingValue,
  SensesEffect,
} from "@/domain/character/featureEffects";
import {
  type ScalingDice,
  type WeaponLike,
  isEffectActive,
  resolveScalingDiceInContext,
  resolveScalingValueInContext,
  weaponMatchesFilters,
} from "./parseFeatureEffectsDerivedHelpers";

export function deriveAttackRollBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    appliesTo?: string;
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
    raging?: boolean;
    item?: WeaponLike | null;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "modifier" || effect.target !== "attack_roll" || effect.mode !== "bonus") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.appliesTo?.length && opts?.appliesTo && !effect.appliesTo.some((value) => value.toLowerCase() === opts.appliesTo?.toLowerCase())) continue;
      if (effect.appliesTo?.length && !opts?.appliesTo) continue;
      if (effect.gate?.weaponFilters?.length && !weaponMatchesFilters(opts?.item, effect.gate.weaponFilters)) continue;
      const resolved = resolveScalingValueInContext(effect.amount, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveModifierStateFromEffects(
  parsed: ParsedFeatureEffects[],
  target: ModifierEffect["target"],
  opts?: {
    appliesTo?: string;
    raging?: boolean;
  }
): { advantage: boolean; disadvantage: boolean } {
  let advantage = false;
  let disadvantage = false;

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "modifier" || effect.target !== target) continue;
      if (effect.mode !== "advantage" && effect.mode !== "disadvantage") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.appliesTo?.length && opts?.appliesTo && !effect.appliesTo.some((value) => value.toLowerCase() === opts.appliesTo?.toLowerCase())) continue;
      if (effect.appliesTo?.length && !opts?.appliesTo) continue;
      if (effect.mode === "advantage") advantage = true;
      if (effect.mode === "disadvantage") disadvantage = true;
    }
  }

  return { advantage, disadvantage };
}

export function collectSensesFromEffects(parsed: ParsedFeatureEffects[]): Array<{ kind: SensesEffect["senses"][number]["kind"]; range: number }> {
  const bestByKind = new Map<SensesEffect["senses"][number]["kind"], number>();
  const bonusByKind = new Map<SensesEffect["senses"][number]["kind"], number>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "senses") continue;
      if (effect.mode === "bonus") {
        for (const sense of effect.senses) {
          bonusByKind.set(sense.kind, (bonusByKind.get(sense.kind) ?? 0) + sense.range);
        }
        continue;
      }
      if (effect.mode !== "grant") continue;
      for (const sense of effect.senses) {
        const current = bestByKind.get(sense.kind) ?? 0;
        if (sense.range > current) bestByKind.set(sense.kind, sense.range);
      }
    }
  }

  for (const [kind, bonus] of bonusByKind.entries()) {
    const base = bestByKind.get(kind) ?? 0;
    if (base > 0) bestByKind.set(kind, base + bonus);
  }

  return Array.from(bestByKind.entries()).map(([kind, range]) => ({ kind, range }));
}

export function deriveAttackDamageBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
    raging?: boolean;
    attackAbility?: AbilKey;
    isWeapon?: boolean;
    isUnarmed?: boolean;
    item?: WeaponLike | null;
    hasOtherWeapon?: boolean;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (
        effect.type === "modifier"
        && effect.target === "damage_roll"
        && effect.mode === "bonus"
      ) {
        if (!isEffectActive(effect, { raging: opts?.raging })) continue;
        if (
          effect.gate?.weaponFilters?.length
          && !weaponMatchesFilters(opts?.item, effect.gate.weaponFilters, {
            hasOtherWeapon: opts?.hasOtherWeapon,
          })
        ) continue;
        const amount = resolveScalingValueInContext(effect.amount, {
          level: opts?.level,
          scores: opts?.scores,
        });
        if (amount != null) total += amount;
        continue;
      }
      if (effect.type !== "attack" || effect.mode !== "bonus_damage") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.gate?.attackAbility && effect.gate.attackAbility !== opts?.attackAbility) continue;
      if (effect.gate?.notes === "weapon_or_unarmed" && !opts?.isWeapon && !opts?.isUnarmed) continue;
      if (
        effect.gate?.weaponFilters?.length
        && !weaponMatchesFilters(opts?.item, effect.gate.weaponFilters, {
          hasOtherWeapon: opts?.hasOtherWeapon,
        })
      ) continue;
      const amount = "kind" in (effect.amount ?? {}) ? resolveScalingValueInContext(effect.amount as ScalingValue, {
        level: opts?.level,
        scores: opts?.scores,
      }) : null;
      if (amount != null) total += amount;
    }
  }
  return total;
}

export function deriveAttackAbilityOverrideFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    raging?: boolean;
    isWeapon?: boolean;
    isUnarmed?: boolean;
    isMonkWeapon?: boolean;
  }
): AbilKey | null {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "weapon_ability_override") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.gate?.notes === "weapon_or_unarmed" && !opts?.isWeapon && !opts?.isUnarmed) continue;
      if (effect.gate?.notes === "unarmed_only" && !opts?.isUnarmed) continue;
      if (effect.gate?.notes === "unarmed_or_monk_weapon" && !opts?.isUnarmed && !opts?.isMonkWeapon) continue;
      if (effect.ability) return effect.ability;
    }
  }
  return null;
}

export function deriveAttackDamageDiceOverrideFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
    raging?: boolean;
    isWeapon?: boolean;
    isUnarmed?: boolean;
    isMonkWeapon?: boolean;
    noWeaponOrShield?: boolean;
  }
): string | null {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "damage_die_override") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.gate?.notes === "unarmed_only" && !opts?.isUnarmed) continue;
      if (effect.gate?.notes === "unarmed_or_monk_weapon" && !opts?.isUnarmed && !opts?.isMonkWeapon) continue;
      if (effect.alternateWhen === "no_weapon_or_shield" && opts?.noWeaponOrShield) {
        const alternateDice = resolveScalingDiceInContext(effect.alternateAmount, {
          level: opts?.level,
          scores: opts?.scores,
        });
        if (alternateDice) return alternateDice;
      }
      const dice = resolveScalingDiceInContext(effect.amount as ScalingDice | undefined, {
        level: opts?.level,
        scores: opts?.scores,
      });
      if (dice) return dice;
    }
  }
  return null;
}

export function deriveUnarmoredDefenseFromEffects(
  parsed: ParsedFeatureEffects[],
  scores: Record<AbilKey, number | null>,
  opts: { armorEquipped: boolean; shieldEquipped: boolean }
): number | null {
  if (opts.armorEquipped) return null;
  let best: number | null = null;

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "armor_class" || effect.mode !== "base_formula" || effect.base == null || !effect.abilities?.length) continue;
      if (effect.gate?.duration === "while_unarmored" && opts.armorEquipped) continue;
      if (opts.shieldEquipped && effect.gate?.shieldAllowed === false) continue;
      const total = effect.base + effect.abilities.reduce((sum, ability) => {
        const score = scores[ability] ?? 10;
        return sum + Math.floor((score - 10) / 2);
      }, 0);
      best = best == null ? total : Math.max(best, total);
    }
  }

  return best;
}

export function canAddAbilityModifierToExtraAttackDamageFromEffects(
  parsed: ParsedFeatureEffects[],
  item: WeaponLike | null | undefined
): boolean {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "add_ability_to_damage") continue;
      if (weaponMatchesFilters(item, effect.gate?.weaponFilters)) return true;
    }
  }
  return false;
}

export function canUseWeaponForBonusAttackFromEffects(
  parsed: ParsedFeatureEffects[],
  item: WeaponLike | null | undefined
): boolean {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "triggered_attack") continue;
      if (weaponMatchesFilters(item, effect.gate?.weaponFilters)) return true;
    }
  }
  return false;
}
