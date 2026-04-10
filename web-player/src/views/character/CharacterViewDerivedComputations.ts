import { readMonsterNumber, readMonsterSkillBonus, parseMonsterSpeed, proficiencyBonusFromChallengeRating } from "@beholden/shared/domain";
import { ABILITY_FULL, ALL_SKILLS } from "@/views/character/CharacterSheetConstants";
import type { AbilKey, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import {
  deriveModifierBonusFromEffects,
  deriveModifierStateFromEffects,
} from "@/domain/character/parseFeatureEffects";
import { abilityMod, getPassiveScore, getSkillBonus, normalizeSpellTrackingKey, spellLooksLikeDamageSpell } from "@/views/character/CharacterSheetUtils";

type ParsedFeatureEffects = ReturnType<typeof import("@/domain/character/parseFeatureEffects").parseFeatureEffects>;

export function buildPreparedSpells({
  currentCharacterData,
  usesFlexiblePreparedList,
  preparedSpellLimit,
  knownSpellKeys,
  forcedPreparedSpellKeys,
}: {
  currentCharacterData: { preparedSpells?: string[]; chosenSpells?: string[] };
  usesFlexiblePreparedList: boolean;
  preparedSpellLimit: number;
  knownSpellKeys: Set<string>;
  forcedPreparedSpellKeys: Set<string>;
}) {
  const saved = Array.isArray(currentCharacterData.preparedSpells)
    ? currentCharacterData.preparedSpells
    : (!usesFlexiblePreparedList && preparedSpellLimit > 0 && Array.isArray(currentCharacterData.chosenSpells)
        ? currentCharacterData.chosenSpells
        : []);
  const allowed = new Set([...knownSpellKeys, ...forcedPreparedSpellKeys]);
  const unique = Array.from(new Set(saved.map((entry) => normalizeSpellTrackingKey(entry)).filter((entry) => allowed.has(entry))));
  const forced = unique.filter((entry) => forcedPreparedSpellKeys.has(entry));
  const userChosen = unique.filter((entry) => !forcedPreparedSpellKeys.has(entry));
  const limitedUserChosen = preparedSpellLimit > 0 ? userChosen.slice(0, preparedSpellLimit) : userChosen;
  return [...forced, ...limitedUserChosen];
}

export function buildInvocationSpellDamageBonuses({
  invocationDetails,
  prof,
  currentCharacterData,
  scoresCha,
  grantedSpellNotesByKey,
}: {
  invocationDetails: Array<{ name?: string | null; text?: string | null }>;
  prof: ProficiencyMap | undefined;
  currentCharacterData: { chosenFeatOptions?: Record<string, unknown> };
  scoresCha: number | null;
  grantedSpellNotesByKey: Map<string, string | null>;
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

  const damageCantripEntries = (prof?.spells ?? []).filter((spell) =>
    spellLooksLikeDamageSpell({
      name: spell.name,
      text: grantedSpellNotesByKey.get(normalizeSpellTrackingKey(spell.name)) ?? null,
    }) || /eldritch blast/i.test(String(spell.name ?? ""))
  );

  const eldritchBlastEntry = (prof?.spells ?? []).find((spell) => /eldritch blast/i.test(String(spell.name ?? "")));
  if (selectedTokens.size === 0 && eldritchBlastEntry) {
    bySpellKey[normalizeSpellTrackingKey(eldritchBlastEntry.name)] = chaMod;
    return bySpellKey;
  }
  if (selectedTokens.size === 0 && damageCantripEntries.length === 1) {
    bySpellKey[normalizeSpellTrackingKey(damageCantripEntries[0].name)] = chaMod;
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
  if (Object.keys(bySpellKey).length === 0 && eldritchBlastEntry) {
    bySpellKey[normalizeSpellTrackingKey(eldritchBlastEntry.name)] = chaMod;
  } else if (Object.keys(bySpellKey).length === 0 && damageCantripEntries.length === 1) {
    bySpellKey[normalizeSpellTrackingKey(damageCantripEntries[0].name)] = chaMod;
  }
  return bySpellKey;
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
  const speedData = parseMonsterSpeed(monster.speed);
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

export function buildModifierStateMaps({
  parsedFeatureEffects,
  raging,
}: {
  parsedFeatureEffects: ParsedFeatureEffects[];
  raging: boolean;
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
    if (abilityCheckState.disadvantage) abilityCheckDisadvantages[ability] = true;
    if (saveState.advantage) saveAdvantages[ability] = true;
    if (saveState.disadvantage) saveDisadvantages[ability] = true;
  });
  const skillAdvantages = Object.fromEntries(
    ALL_SKILLS
      .filter(({ name }) => deriveModifierStateFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, raging }).advantage)
      .map(({ name }) => [name, true]),
  ) as Record<string, boolean>;
  const skillDisadvantages = Object.fromEntries(
    ALL_SKILLS
      .filter(({ name }) => deriveModifierStateFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, raging }).disadvantage)
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
