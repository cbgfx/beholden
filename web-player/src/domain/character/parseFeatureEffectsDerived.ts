import type { AbilKey, GrantedSpellCast, ResourceCounter, TaggedItem } from "@/views/character/CharacterSheetTypes";
import { normalizeResourceKey, proficiencyBonus } from "@/views/character/CharacterSheetUtils";
import type {
  AttackEffect,
  ArmorClassEffect,
  DefenseEffect,
  FeatureEffect,
  ModifierEffect,
  ParsedFeatureEffects,
  ProficiencyGrantEffect,
  ScalingValue,
  SensesEffect,
  SpellChoiceEffect,
  SpeedEffect,
  WeaponFilter,
} from "@/domain/character/featureEffects";

interface ScalingResolutionContext {
  scores?: Partial<Record<AbilKey, number | null>>;
  level?: number | null;
}

interface EffectStateContext {
  raging?: boolean;
  armorState?: "any" | "no_armor" | "not_heavy";
}

interface WeaponLike {
  name?: string | null;
  type?: string | null;
  properties?: string[] | null;
  dmg1?: string | null;
  dmg2?: string | null;
}

type ScalingDice = Extract<AttackEffect["amount"], { kind: "fixed" | "per_scalar" | "named_progression" }>;

function isEffectActive(effect: FeatureEffect, opts?: EffectStateContext): boolean {
  const duration = effect.gate?.duration;
  if (duration === "while_raging" && !opts?.raging) return false;
  const armorState = effect.gate?.armorState ?? "any";
  if (armorState === "no_armor" && opts?.armorState !== "no_armor") return false;
  if (armorState === "not_heavy" && opts?.armorState !== "not_heavy" && opts?.armorState !== "no_armor") return false;
  return true;
}

function hasWeaponProperty(item: WeaponLike | null | undefined, code: string): boolean {
  return (item?.properties ?? []).some((property) => String(property ?? "").trim().toUpperCase() === code.toUpperCase());
}

function isWeaponLike(item: WeaponLike | null | undefined): boolean {
  return Boolean(item?.dmg1 || item?.dmg2) || /weapon/i.test(String(item?.type ?? "")) || /\bstaff\b/i.test(String(item?.type ?? ""));
}

function isMeleeWeaponLike(item: WeaponLike | null | undefined): boolean {
  if (!isWeaponLike(item)) return false;
  return !/ranged/i.test(String(item?.type ?? ""));
}

function isRangedWeaponLike(item: WeaponLike | null | undefined): boolean {
  return /ranged/i.test(String(item?.type ?? ""));
}

function isCrossbowWeaponLike(item: WeaponLike | null | undefined): boolean {
  return /crossbow/i.test(String(item?.name ?? "")) || /crossbow/i.test(String(item?.type ?? ""));
}

function weaponMatchesFilters(item: WeaponLike | null | undefined, filters: WeaponFilter[] | undefined): boolean {
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
      case "crossbow_weapon":
        return isCrossbowWeaponLike(item);
      case "light_crossbow":
        return hasWeaponProperty(item, "L") && isCrossbowWeaponLike(item);
      case "no_two_handed":
        return !hasWeaponProperty(item, "2H");
      default:
        return false;
    }
  });
}

export function buildGrantedSpellDataFromEffects(
  parsed: ParsedFeatureEffects[],
  scores: Record<AbilKey, number | null>,
  level?: number | null,
): { spells: GrantedSpellCast[]; resources: ResourceCounter[] } {
  const spells: GrantedSpellCast[] = [];
  const resources: ResourceCounter[] = [];

  const resolveScalingValue = (value: ScalingValue | undefined): number | null =>
    resolveScalingValueInContext(value, { scores, level });

  const resourceByKey = new Map<string, ResourceCounter>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "resource_grant") {
        const max = resolveScalingValue(effect.max);
        if (max == null) continue;
        const reset =
          effect.reset === "short_rest" ? "S"
          : effect.reset === "long_rest" ? "L"
          : effect.reset === "short_or_long_rest" ? "SL"
          : "L";
        resourceByKey.set(effect.resourceKey, {
          key: effect.resourceKey,
          name: effect.label,
          current: max,
          max,
          reset,
          restoreAmount:
            effect.restoreAmount === "all" || effect.restoreAmount === "one"
              ? effect.restoreAmount
              : undefined,
        });
      }
    }
  }

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "spell_grant") continue;
      if (effect.requiredLevel != null && level != null && level < effect.requiredLevel) continue;
      if (effect.mode === "free_cast" && effect.resourceKey) {
        const resource = resourceByKey.get(effect.resourceKey);
        if (!resource) continue;
        spells.push({
          key: `granted-spell:${effect.resourceKey}`,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "limited",
          note: `Free cast ${resource.max} time${resource.max === 1 ? "" : "s"} per ${resource.reset === "S" ? "Short Rest" : resource.reset === "SL" ? "Short or Long Rest" : "Long Rest"}. No spell slot required.`,
          resourceKey: effect.resourceKey,
          reset: resource.reset,
        });
        continue;
      }

      if (effect.mode === "at_will") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "at_will",
          note: effect.riderSummary ?? "",
        });
        continue;
      }

      if (effect.mode === "known") {
        const isCantrip = /\bcantrip\b/i.test(effect.summary ?? "") || effect.requiredLevel === 0;
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "known",
          note: effect.riderSummary
            ? `${isCantrip ? "Known cantrip." : "Known spell."} ${effect.riderSummary}`
            : (isCantrip ? "Known cantrip." : "Known spell."),
        });
        continue;
      }

      if (effect.mode === "always_prepared") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "always_prepared",
          note: effect.riderSummary ? `Always prepared. ${effect.riderSummary}` : "Always prepared.",
        });
        continue;
      }

      if (effect.mode === "expanded_list") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "expanded_list",
          note: "Added to your spell list.",
        });
      }
    }
  }

  return { spells, resources: Array.from(resourceByKey.values()) };
}

function clampScalingValue(value: number, scaling: Extract<ScalingValue, { min?: number; max?: number }>): number {
  const withMin = scaling.min != null ? Math.max(scaling.min, value) : value;
  return scaling.max != null ? Math.min(scaling.max, withMin) : withMin;
}

function resolveScalingValueInContext(value: ScalingValue | undefined, context: ScalingResolutionContext): number | null {
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

function resolveScalingDiceInContext(
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

export function collectTaggedGrantsFromEffects(parsed: ParsedFeatureEffects[]): {
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  skills: TaggedItem[];
  expertise: TaggedItem[];
  saves: TaggedItem[];
  languages: TaggedItem[];
} {
  const result = {
    armor: [] as TaggedItem[],
    weapons: [] as TaggedItem[],
    tools: [] as TaggedItem[],
    skills: [] as TaggedItem[],
    expertise: [] as TaggedItem[],
    saves: [] as TaggedItem[],
    languages: [] as TaggedItem[],
  };

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "proficiency_grant" && effect.grants?.length) {
        const target =
          effect.expertise ? result.expertise
          : effect.category === "armor" ? result.armor
          : effect.category === "weapon" ? result.weapons
          : effect.category === "tool" ? result.tools
          : effect.category === "skill" ? result.skills
          : effect.category === "saving_throw" ? result.saves
          : effect.category === "language" ? result.languages
          : null;
        if (!target) continue;
        for (const name of effect.grants) target.push({ name, source: effect.source.name });
      }
      if (effect.type === "weapon_mastery" && effect.grants?.length) {
        for (const name of effect.grants) result.weapons.push({ name, source: effect.source.name });
      }
    }
  }

  return result;
}

export function collectSpellChoicesFromEffects(parsed: ParsedFeatureEffects[]): SpellChoiceEffect[] {
  const result: SpellChoiceEffect[] = [];
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "spell_choice") result.push(effect);
    }
  }
  return result;
}

export function collectProficiencyChoiceEffectsFromEffects(parsed: ParsedFeatureEffects[]): ProficiencyGrantEffect[] {
  const result: ProficiencyGrantEffect[] = [];
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "proficiency_grant" || !effect.choice || effect.choice.count.kind !== "fixed") continue;
      result.push(effect);
    }
  }
  return result;
}

export function collectDefensesFromEffects(parsed: ParsedFeatureEffects[], opts?: EffectStateContext): {
  resistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
} {
  const resistances = new Set<string>();
  const damageImmunities = new Set<string>();
  const conditionImmunities = new Set<string>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "defense") continue;
      if (!isEffectActive(effect, opts)) continue;
      if (effect.mode === "damage_resistance") {
        effect.targets.forEach((target) => resistances.add(target));
      }
      if (effect.mode === "damage_immunity") {
        effect.targets.forEach((target) => damageImmunities.add(target));
      }
      if (effect.mode === "condition_immunity") {
        effect.targets.forEach((target) => conditionImmunities.add(target));
      }
    }
  }

  return {
    resistances: Array.from(resistances),
    damageImmunities: Array.from(damageImmunities),
    conditionImmunities: Array.from(conditionImmunities),
  };
}

export function deriveSpeedBonusFromEffects(parsed: ParsedFeatureEffects[], opts?: { armorState?: "any" | "no_armor" | "not_heavy"; raging?: boolean }): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "speed" || effect.mode !== "bonus") continue;
      if (!isEffectActive(effect, opts)) continue;
      if (effect.amount?.kind === "fixed") total += effect.amount.value;
    }
  }
  return total;
}

export function collectMovementModesFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: { baseWalkSpeed?: number; raging?: boolean; armorState?: "any" | "no_armor" | "not_heavy" }
): Array<{ mode: Exclude<SpeedEffect["movementMode"], "walk" | undefined>; speed: number | null }> {
  const bestByMode = new Map<Exclude<SpeedEffect["movementMode"], "walk" | undefined>, number | null>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "speed" || effect.mode !== "grant_mode" || !effect.movementMode || effect.movementMode === "walk") continue;
      if (!isEffectActive(effect, opts)) continue;
      const mode = effect.movementMode;
      const amount = effect.amount;
      const resolved =
        amount?.kind === "fixed" ? amount.value
        : amount?.kind === "named_progression" && amount.key === "equal_to_speed" ? (opts?.baseWalkSpeed ?? null)
        : null;
      const existing = bestByMode.get(mode);
      if (existing == null || (resolved != null && resolved > existing)) bestByMode.set(mode, resolved);
    }
  }

  return Array.from(bestByMode.entries()).map(([mode, speed]) => ({ mode, speed }));
}

export function deriveArmorClassBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    armorEquipped?: boolean;
    armorCategory?: "light" | "medium" | "heavy" | "shield" | "none";
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "armor_class" || effect.mode !== "bonus") continue;
      const gateArmorState = effect.gate?.armorState ?? "any";
      if (gateArmorState === "not_unarmored" && !opts?.armorEquipped) continue;
      if (gateArmorState === "no_armor" && opts?.armorEquipped) continue;
      if (effect.gate?.notes?.startsWith("medium_armor_dex_cap:")) {
        if (opts?.armorCategory !== "medium") continue;
        const minimumDex = Number(effect.gate.notes.split(":")[1] ?? 0);
        const dexScore = opts?.scores?.dex ?? 10;
        if (dexScore < minimumDex) continue;
      }
      const resolved = resolveScalingValueInContext(effect.bonus, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveHitPointMaxBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: { level?: number | null; scores?: Partial<Record<AbilKey, number | null>> }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "hit_points" || effect.mode !== "max_bonus") continue;
      if (
        !("kind" in effect.amount)
        || effect.amount.kind === "per_scalar"
        || ("dice" in effect.amount)
      ) continue;
      const resolved = resolveScalingValueInContext(effect.amount, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveModifierBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  target: ModifierEffect["target"],
  opts?: {
    appliesTo?: string;
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
    raging?: boolean;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "modifier" || effect.target !== target || effect.mode !== "bonus") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.appliesTo?.length && opts?.appliesTo && !effect.appliesTo.some((value) => value.toLowerCase() === opts.appliesTo?.toLowerCase())) continue;
      if (effect.appliesTo?.length && !opts?.appliesTo) continue;
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
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "bonus_damage") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.gate?.attackAbility && effect.gate.attackAbility !== opts?.attackAbility) continue;
      if (effect.gate?.notes === "weapon_or_unarmed" && !opts?.isWeapon && !opts?.isUnarmed) continue;
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
  }
): string | null {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "damage_die_override") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.gate?.notes === "unarmed_only" && !opts?.isUnarmed) continue;
      if (effect.gate?.notes === "unarmed_or_monk_weapon" && !opts?.isUnarmed && !opts?.isMonkWeapon) continue;
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
