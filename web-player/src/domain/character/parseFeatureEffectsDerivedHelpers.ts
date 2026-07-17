import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import { proficiencyBonus } from "@/views/character/CharacterSheetUtils";
import type { AttackEffect, FeatureEffect, ScalingValue, WeaponFilter } from "@/domain/character/featureEffects";

export interface ScalingResolutionContext {
  scores?: Partial<Record<AbilKey, number | null>>;
  level?: number | null;
}

export interface EffectStateContext {
  raging?: boolean;
  armorState?: "any" | "no_armor" | "not_heavy";
}

export interface WeaponLike {
  name?: string | null;
  type?: string | null;
  properties?: string[] | null;
  proficiency?: string | null;
  dmg1?: string | null;
  dmg2?: string | null;
  magic?: boolean | null;
}

export type ScalingDice = Extract<AttackEffect["amount"], { kind: "fixed" | "per_scalar" | "named_progression" }>;

export function isEffectActive(effect: FeatureEffect, opts?: EffectStateContext): boolean {
  const duration = effect.gate?.duration;
  if (duration === "while_raging" && !opts?.raging) return false;
  const armorState = effect.gate?.armorState ?? "any";
  if (armorState === "no_armor" && opts?.armorState !== "no_armor") return false;
  if (armorState === "not_heavy" && opts?.armorState !== "not_heavy" && opts?.armorState !== "no_armor") return false;
  return true;
}

export function hasWeaponProperty(item: WeaponLike | null | undefined, code: string): boolean {
  return (item?.properties ?? []).some((property) => String(property ?? "").trim().toUpperCase() === code.toUpperCase());
}

export function isWeaponLike(item: WeaponLike | null | undefined): boolean {
  return Boolean(item?.dmg1 || item?.dmg2);
}

export function isMeleeWeaponLike(item: WeaponLike | null | undefined): boolean {
  if (!isWeaponLike(item)) return false;
  return !/ranged/i.test(String(item?.type ?? ""));
}

export function isRangedWeaponLike(item: WeaponLike | null | undefined): boolean {
  return /ranged/i.test(String(item?.type ?? ""));
}

export function isCrossbowWeaponLike(item: WeaponLike | null | undefined): boolean {
  const base = String(item?.proficiency ?? "").split(",").at(-1)?.trim() ?? "";
  return /crossbow/i.test(base);
}

export function isLongbowOrShortbowLike(item: WeaponLike | null | undefined): boolean {
  const base = String(item?.proficiency ?? "").split(",").at(-1)?.trim() ?? "";
  return /^(?:longbow|shortbow)$/i.test(base);
}

export function weaponMatchesFilters(
  item: WeaponLike | null | undefined,
  filters: WeaponFilter[] | undefined,
  context?: { hasOtherWeapon?: boolean },
): boolean {
  if (!filters?.length) return false;
  return filters.every((filter) => {
    switch (filter) {
      case "simple_weapon":
        return isWeaponLike(item) && !hasWeaponProperty(item, "M");
      case "martial_weapon":
        return hasWeaponProperty(item, "M");
      case "melee_weapon":
        return isMeleeWeaponLike(item);
      case "ranged_weapon":
        return isRangedWeaponLike(item);
      case "finesse_weapon":
        return hasWeaponProperty(item, "F");
      case "light_weapon":
        return hasWeaponProperty(item, "L");
      case "heavy_weapon":
        return hasWeaponProperty(item, "H");
      case "crossbow_weapon":
        return isCrossbowWeaponLike(item);
      case "longbow_or_shortbow":
        return isLongbowOrShortbowLike(item);
      case "light_crossbow":
        return hasWeaponProperty(item, "L") && isCrossbowWeaponLike(item);
      case "no_two_handed":
        return !hasWeaponProperty(item, "2H");
      case "thrown_weapon":
        return hasWeaponProperty(item, "T");
      case "magic_weapon":
        return isWeaponLike(item) && item?.magic === true;
      case "no_offhand":
        return context?.hasOtherWeapon === false;
      default:
        return false;
    }
  });
}

export function clampScalingValue(value: number, scaling: Extract<ScalingValue, { min?: number; max?: number }>): number {
  const withMin = scaling.min != null ? Math.max(scaling.min, value) : value;
  return scaling.max != null ? Math.min(scaling.max, withMin) : withMin;
}

export function resolveScalingValueInContext(value: ScalingValue | undefined, context: ScalingResolutionContext): number | null {
  if (!value) return null;
  if (value.kind === "fixed") return value.value;
  if (value.kind === "ability_mod") {
    const score = context.scores?.[value.ability] ?? 10;
    const mod = Math.floor((score - 10) / 2);
    return clampScalingValue(mod, value);
  }
  if (value.kind === "proficiency_bonus") {
    if (context.level == null) return null;
    const total = proficiencyBonus(context.level) * (value.multiplier ?? 1);
    return clampScalingValue(total, value);
  }
  if (value.kind === "character_level") {
    if (context.level == null) return null;
    const total = context.level * (value.multiplier ?? 1);
    return clampScalingValue(total, value);
  }
  if (value.kind === "half_character_level") {
    if (context.level == null) return null;
    const raw = context.level / 2;
    const total = value.round === "up" ? Math.ceil(raw) : Math.floor(raw);
    return clampScalingValue(total, value);
  }
  if (value.kind === "named_progression") {
    if (value.key === "barbarian_rage_damage") {
      if (context.level == null) return null;
      if (context.level >= 16) return 4;
      if (context.level >= 9) return 3;
      return 2;
    }
  }
  return null;
}

export function resolveScalingDiceInContext(
  value: ScalingDice | undefined,
  context: { level?: number | null; scores?: Partial<Record<AbilKey, number | null>> }
): string | null {
  if (!value) return null;
  if (value.kind === "fixed") return "dice" in value ? value.dice : null;
  if (value.kind === "per_scalar") {
    const scalar = resolveScalingValueInContext(value.scalar, context);
    return scalar != null && scalar > 0 ? `${scalar}${value.die}` : null;
  }
  if (value.kind === "named_progression") {
    if (value.key === "monk_martial_arts_die") {
      const level = context.level ?? null;
      if (level == null) return null;
      if (level >= 17) return "1d12";
      if (level >= 11) return "1d10";
      if (level >= 5) return "1d8";
      return "1d6";
    }
    if (value.key === "bardic_inspiration_die") {
      const level = context.level ?? null;
      if (level == null) return null;
      if (level >= 15) return "1d12";
      if (level >= 10) return "1d10";
      if (level >= 5) return "1d8";
      return "1d6";
    }
  }
  return null;
}
