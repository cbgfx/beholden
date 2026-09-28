import { readMonsterNumber, readMonsterSkillBonus, parseMonsterSpeed, proficiencyBonusFromChallengeRating } from "@beholden/shared/domain";
import { ABILITY_FULL, ALL_SKILLS } from "@/views/character/CharacterSheetConstants";
import type { AbilKey, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import {
  deriveModifierBonusFromEffects,
  deriveModifierStateFromEffects,
} from "@/domain/character/parseFeatureEffects";
import { resolveScalingValueInContext } from "@/domain/character/parseFeatureEffectsDerivedHelpers";
import { abilityMod, getPassiveScore, getSkillBonus, normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";

type ParsedFeatureEffects = ReturnType<typeof import("@/domain/character/parseFeatureEffects").parseFeatureEffects>;

export function buildInvocationSpellDamageBonuses({
  ruleset,
  invocationDetails,
  prof,
  currentCharacterData,
  scoresCha,
}: {
  ruleset: "5e" | "5.5e";
  invocationDetails: Array<{ name?: string | null; text?: string | null }>;
  prof: ProficiencyMap | undefined;
  currentCharacterData: { chosenFeatOptions?: Record<string, unknown> };
  scoresCha: number | null;
}) {
  const hasAgonizingBlast = invocationDetails.some((invocation) => {
    const name = String(invocation.name ?? "");
    const text = String(invocation.text ?? "");
    return /agonizing blast/i.test(name) || (/charisma modifier/i.test(text) && /damage rolls/i.test(text));
  }) || (prof?.invocations ?? []).some((invocation) => /agonizing blast/i.test(String(invocation.name ?? "")));
  if (!hasAgonizingBlast) return {};

  const chosenFeatOptions = currentCharacterData.chosenFeatOptions ?? {};
  const selectedInvocationSpellTokens = Object.entries(chosenFeatOptions)
    .filter(([key]) => key.startsWith("invocation:"))
    .flatMap(([, values]) => Array.isArray(values) ? values : [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  const selectedTokens = new Set(selectedInvocationSpellTokens.map((value) => value.toLowerCase()));
  const bySpellKey: Record<string, number> = {};
  const chaMod = abilityMod(scoresCha);
  if (chaMod === 0) return bySpellKey;

  const eldritchBlastEntry = (prof?.spells ?? []).find((spell) => /eldritch blast/i.test(String(spell.name ?? "")));
  // 2014 Agonizing Blast is fixed to Eldritch Blast. The 2024 invocation requires an
  // explicit eligible-cantrip selection; never let a missing 2024 choice silently fall
  // back to Eldritch Blast merely because the names happen to overlap.
  if (ruleset === "5e") {
    if (eldritchBlastEntry) bySpellKey[normalizeSpellTrackingKey(eldritchBlastEntry.name)] = chaMod;
    return bySpellKey;
  }
  if (selectedTokens.size === 0) {
    return bySpellKey;
  }
  for (const spell of prof?.spells ?? []) {
    const spellId = spell.id ? String(spell.id).trim().toLowerCase() : "";
    const spellName = String(spell.name ?? "").trim();
    const normalizedName = normalizeSpellTrackingKey(spellName);
    if (!normalizedName) continue;
    if (selectedTokens.has(spellId) || selectedTokens.has(spellName.toLowerCase()) || selectedTokens.has(normalizedName)) {
      bySpellKey[normalizedName] = chaMod;
    }
  }
  return bySpellKey;
}

export function buildClassFeatureCantripDamageBonuses({
  parsedFeatureEffects,
  classSpellcastingStates,
  prof,
  scores,
}: {
  parsedFeatureEffects: ParsedFeatureEffects[];
  classSpellcastingStates: Array<{ className: string; classEntryId?: string | null; ability: AbilKey | null }>;
  prof: ProficiencyMap | undefined;
  scores: Partial<Record<AbilKey, number | null>>;
}): Record<string, number> {
  // Cleric's "Potent Spellcasting" (Blessed Strikes, level 7) adds the caster's Wisdom modifier
  // to the damage of any Cleric cantrip -- a `modifier`/`cantrip_damage` effect on the granting
  // feature. Scoped to the granting class's own spells via the effect's ability (e.g. Wisdom ->
  // Cleric), since a multiclass caster's other class's cantrips shouldn't get the bonus.
  //
  // We deliberately don't filter to cantrips (spell level 0) here: `TaggedItem.level` on a
  // tracked spell records the character level it was *acquired* at, not its D&D spell level, so
  // it can't tell a cantrip from a leveled spell. The real spell level is only known client-side
  // once spell details are fetched, so callers (the spells panel) are responsible for only
  // applying this bonus to rows they've resolved as actual cantrips.
  //
  // A tracked spell's `source` isn't always the class name: spells granted through a class
  // feature choice (e.g. Divine Order: Thaumaturge's bonus cantrip) are tagged with that
  // feature's own name but carry a matching `classEntryId`, while spells granted through a
  // background feat (e.g. Magic Initiate (Cleric)) are tagged with the feat's name, which
  // names the class list it draws from (only as a labeling convention, not a stable id -- there's
  // no structured link back to the class here). So a spell counts as the granting class's own
  // when either signal matches; neither alone covers every grant path.
  const bonuses: Record<string, number> = {};
  for (const parsed of parsedFeatureEffects) {
    for (const effect of parsed.effects) {
      if (effect.type !== "modifier" || effect.target !== "cantrip_damage" || effect.mode !== "bonus") continue;
      const amount = resolveScalingValueInContext(effect.amount, { scores });
      if (!amount) continue;
      const grantingAbility = effect.amount?.kind === "ability_mod" ? effect.amount.ability : null;
      const grantingClass = grantingAbility
        ? classSpellcastingStates.find((state) => state.ability === grantingAbility)
        : undefined;
      const classNamePattern = grantingClass ? new RegExp(`\\b${grantingClass.className}\\b`, "i") : null;
      for (const spell of prof?.spells ?? []) {
        if (grantingClass) {
          const matchesClassEntry = grantingClass.classEntryId != null && spell.classEntryId === grantingClass.classEntryId;
          const matchesSourceName = classNamePattern?.test(String(spell.source ?? "")) ?? false;
          if (!matchesClassEntry && !matchesSourceName) continue;
        }
        const key = normalizeSpellTrackingKey(spell.name);
        if (key) bonuses[key] = (bonuses[key] ?? 0) + amount;
      }
    }
  }
  return bonuses;
}

export function buildTransformedCombatStats({
  monster,
  effectiveAc,
  effectiveSpeed,
  passiveInv,
  className,
  fallbackStrScore,
}: {
  monster: any | null;
  effectiveAc: number;
  effectiveSpeed: number;
  passiveInv: number;
  className: string;
  fallbackStrScore: number | null;
}) {
  if (!monster) return null;
  const monsterDex = readMonsterNumber(monster.dex) ?? 10;
  const monsterWis = readMonsterNumber(monster.wis) ?? 10;
  // The compendium API's monster-by-id response carries the raw `movement`
  // object (walk/climb/fly/...); `speed` is a display-formatted string
  // ("walk 40 ft., climb 40 ft.") kept as a fallback in case a caller only
  // has that -- `parseMonsterSpeed` can still pull the walk number out of it,
  // just without per-mode breakdown.
  const speedData = parseMonsterSpeed(monster.movement ?? monster.speed);
  const skillPerception = readMonsterSkillBonus(monster, "Perception");
  return {
    effectiveAc: readMonsterNumber(monster.ac?.value ?? monster.ac ?? monster.armor_class) ?? effectiveAc,
    speed: speedData.walk ?? effectiveSpeed,
    movementModes: speedData.modes,
    initiativeBonus: abilityMod(monsterDex),
    pb: proficiencyBonusFromChallengeRating(monster.cr ?? monster.challenge_rating),
    passivePerc: skillPerception != null ? 10 + skillPerception : 10 + abilityMod(monsterWis),
    passiveInv,
    dexScore: monsterDex,
    strScore: readMonsterNumber(monster.str) ?? fallbackStrScore,
    className: monster.name ?? className,
  };
}

export function buildSaveBonuses({
  parsedFeatureEffects,
  level,
  scoresByAbility,
  raging,
}: {
  parsedFeatureEffects: ParsedFeatureEffects[];
  level: number;
  scoresByAbility: Record<AbilKey, number | null>;
  raging: boolean;
}) {
  return Object.fromEntries(
    (Object.entries(ABILITY_FULL) as [AbilKey, string][]).map(([key, name]) => [
      key,
      deriveModifierBonusFromEffects(parsedFeatureEffects, "saving_throw", { appliesTo: name, level, scores: scoresByAbility, raging }),
    ])
  ) as Partial<Record<AbilKey, number>>;
}

export function buildSkillBonuses({
  parsedFeatureEffects,
  level,
  scoresByAbility,
  raging,
}: {
  parsedFeatureEffects: ParsedFeatureEffects[];
  level: number;
  scoresByAbility: Record<AbilKey, number | null>;
  raging: boolean;
}) {
  return Object.fromEntries(
    ALL_SKILLS
      .map(({ name }) => [
        name,
        deriveModifierBonusFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, level, scores: scoresByAbility, raging }),
      ] as const)
      .filter(([, bonus]) => bonus !== 0)
  ) as Record<string, number>;
}

export function buildModifierStateMaps({
  parsedFeatureEffects,
  raging,
  exhaustionAbilityCheckDisadvantage = false,
  exhaustionSaveDisadvantage = false,
}: {
  parsedFeatureEffects: ParsedFeatureEffects[];
  raging: boolean;
  /** 2014 exhaustion tier 1+: disadvantage on all ability checks (including skill checks). */
  exhaustionAbilityCheckDisadvantage?: boolean;
  /** 2014 exhaustion tier 3+: disadvantage on all saving throws. */
  exhaustionSaveDisadvantage?: boolean;
}) {
  const abilityCheckAdvantages: Partial<Record<AbilKey, boolean>> = {};
  const abilityCheckDisadvantages: Partial<Record<AbilKey, boolean>> = {};
  const saveAdvantages: Partial<Record<AbilKey, boolean>> = {};
  const saveDisadvantages: Partial<Record<AbilKey, boolean>> = {};
  (Object.keys(ABILITY_FULL) as AbilKey[]).forEach((ability) => {
    const abilityName = ABILITY_FULL[ability];
    const abilityCheckState = deriveModifierStateFromEffects(parsedFeatureEffects, "ability_check", { appliesTo: abilityName, raging });
    const saveState = deriveModifierStateFromEffects(parsedFeatureEffects, "saving_throw", { appliesTo: abilityName, raging });
    if (abilityCheckState.advantage) abilityCheckAdvantages[ability] = true;
    if (abilityCheckState.disadvantage || exhaustionAbilityCheckDisadvantage) abilityCheckDisadvantages[ability] = true;
    if (saveState.advantage) saveAdvantages[ability] = true;
    if (saveState.disadvantage || exhaustionSaveDisadvantage) saveDisadvantages[ability] = true;
  });
  const skillAdvantages = Object.fromEntries(
    ALL_SKILLS
      .filter(({ name }) => deriveModifierStateFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, raging }).advantage)
      .map(({ name }) => [name, true]),
  ) as Record<string, boolean>;
  const skillDisadvantages = Object.fromEntries(
    ALL_SKILLS
      .filter(({ name }) => exhaustionAbilityCheckDisadvantage || deriveModifierStateFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, raging }).disadvantage)
      .map(({ name }) => [name, true]),
  ) as Record<string, boolean>;
  return {
    abilityCheckAdvantages,
    abilityCheckDisadvantages,
    saveAdvantages,
    saveDisadvantages,
    skillAdvantages,
    skillDisadvantages,
  };
}

export function buildPassiveScores({
  parsedFeatureEffects,
  level,
  scoresByAbility,
  prof,
  hasJackOfAllTrades,
  raging,
}: {
  parsedFeatureEffects: ParsedFeatureEffects[];
  level: number;
  scoresByAbility: Record<AbilKey, number | null>;
  prof: ProficiencyMap | undefined;
  hasJackOfAllTrades: boolean;
  raging: boolean;
}) {
  const passiveScoreBonus = deriveModifierBonusFromEffects(parsedFeatureEffects, "passive_score", {
    level,
    scores: scoresByAbility,
    raging,
  });
  const passivePerc = getPassiveScore(getSkillBonus("Perception", "wis", scoresByAbility, level, prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades })) + passiveScoreBonus;
  const passiveInv = getPassiveScore(getSkillBonus("Investigation", "int", scoresByAbility, level, prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades })) + passiveScoreBonus;
  return {
    passiveScoreBonus,
    passivePerc,
    passiveInv,
  };
}
