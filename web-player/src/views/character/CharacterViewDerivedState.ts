import type { AbilKey, CharacterData, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import {
  applyItemAbilityScoreOverrides,
  buildAbilityScoreExplanations,
  collectClassResources,
  collectFeatureResourceFallbacks,
  mergeResourceState,
  normalizeProficiencies,
  stripEditionTag,
  XP_TO_LEVEL,
} from "@/views/character/CharacterViewHelpers";
import {
  buildAppliedCharacterFeatures,
  buildDisplayPlayerFeatures,
  buildPreparedSpellProgressionGrants,
} from "@/domain/character/characterFeatures";
import {
  buildGrantedSpellDataFromEffects,
  collectDefensesFromEffects,
  collectMovementModesFromEffects,
  collectSensesFromEffects,
  deriveArmorClassBonusFromEffects,
  deriveAttackDamageBonusFromEffects,
  deriveHitPointMaxBonusFromEffects,
  deriveModifierBonusFromEffects,
  deriveSpeedBonusFromEffects,
  deriveUnarmoredDefenseFromEffects,
  parseFeatureEffects,
  type ParseFeatureEffectsInput,
} from "@/domain/character/parseFeatureEffects";
import {
  abilityMod,
  getInitiativeBonus,
  normalizeSpellTrackingKey,
  proficiencyBonus,
} from "@/views/character/CharacterSheetUtils";
import {
  getEquipState,
  hasArmorProficiency,
  hasStealthDisadvantage,
  isArmorItem,
  isShieldItem,
} from "@/views/character/CharacterInventory";
import { getPreparedSpellCount, usesFlexiblePreparedSpells } from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  buildInvocationSpellDamageBonuses,
  buildModifierStateMaps,
  buildPassiveScores,
  buildPreparedSpells,
  buildSaveBonuses,
  buildTransformedCombatStats,
} from "@/views/character/CharacterViewDerivedComputations";
import type { CharacterViewDerivedState, CharacterViewDerivedStateArgs } from "@/views/character/CharacterViewDerivedTypes";

export function buildCharacterViewDerivedState(args: CharacterViewDerivedStateArgs): CharacterViewDerivedState {
  const currentCharacterData: CharacterData = args.char.characterData ?? {};
  const prof = normalizeProficiencies(currentCharacterData.proficiencies);
  const pb = proficiencyBonus(args.char.level);
  const hd = currentCharacterData.hd ?? null;
  const hitDieSize = hd ?? args.classDetail?.hd ?? null;
  const hitDiceMax = Math.max(0, args.char.level);
  const hitDiceCurrent = Math.max(0, Math.min(hitDiceMax, Math.floor(Number(currentCharacterData.hitDiceCurrent ?? hitDiceMax) || 0)));
  const inventory = currentCharacterData.inventory ?? [];
  const baseScores: Record<AbilKey, number | null> = {
    str: args.char.strScore,
    dex: args.char.dexScore,
    con: args.char.conScore,
    int: args.char.intScore,
    wis: args.char.wisScore,
    cha: args.char.chaScore,
  };
  const scores = applyItemAbilityScoreOverrides(baseScores, inventory);
  const scoreExplanations = buildAbilityScoreExplanations(baseScores, scores, inventory);
  const featureArgs = {
    charData: currentCharacterData,
    characterLevel: args.char.level,
    classDetail: args.classDetail,
    raceDetail: args.raceDetail,
    backgroundDetail: args.backgroundDetail,
    bgOriginFeatDetail: args.bgOriginFeatDetail,
    raceFeatDetail: args.raceFeatDetail,
    classFeatDetails: args.classFeatDetails.map((entry) => entry.feat),
    levelUpFeatDetails: args.levelUpFeatDetails,
    invocationDetails: args.invocationDetails,
  };
  const appliedFeatures = buildAppliedCharacterFeatures(featureArgs);
  const classFeaturesList = buildDisplayPlayerFeatures(featureArgs);
  const parsedFeatureEffects = appliedFeatures.map((feature, index) =>
    parseFeatureEffects({
      source: { id: `feature:${index}:${feature.id}`, kind: feature.kind, name: feature.name, text: feature.text },
      text: feature.text,
      suppressStructuredSpellGrants: Boolean(feature.preparedSpellProgression?.length),
    } satisfies ParseFeatureEffectsInput)
  );
  const progressionGrantedSpells = buildPreparedSpellProgressionGrants(appliedFeatures, args.char.level, currentCharacterData.chosenFeatureChoices).map((entry) => ({
    key: entry.key,
    spellName: entry.spellName,
    sourceName: entry.sourceName,
    mode: "always_prepared" as const,
    note: entry.note,
  }));
  const grantedSpellData = (() => {
    const base = buildGrantedSpellDataFromEffects(parsedFeatureEffects, scores, args.char.level);
    const seen = new Set(base.spells.map((entry) => normalizeSpellTrackingKey(entry.spellName)));
    for (const spell of progressionGrantedSpells) {
      const normalized = normalizeSpellTrackingKey(spell.spellName);
      if (!normalized || seen.has(normalized)) continue;
      base.spells.push(spell);
      seen.add(normalized);
    }
    return base;
  })();
  const derivedResources = (() => {
    const byKey = new Map<string, ResourceCounter>();
    for (const resource of [
      ...collectClassResources(args.classDetail, args.char.level, args.subclass),
      ...grantedSpellData.resources,
      ...collectFeatureResourceFallbacks(appliedFeatures, args.classDetail?.name ?? args.char.className ?? null, args.char.level),
    ]) {
      if (!byKey.has(resource.key)) byKey.set(resource.key, resource);
    }
    return Array.from(byKey.values());
  })();
  const classResourcesWithSpellCasts = mergeResourceState(currentCharacterData.resources, derivedResources);
  const polymorphName = stripEditionTag(args.polymorphCondition?.polymorphName ?? "");
  const rageActive = (args.char.conditions ?? []).some((condition) => condition.key === "rage");
  const effectDefenses = collectDefensesFromEffects(parsedFeatureEffects, { raging: rageActive });
  const effectSenses = collectSensesFromEffects(parsedFeatureEffects);
  const parsedDefenses = {
    resistances: effectDefenses.resistances,
    damageImmunities: effectDefenses.damageImmunities,
    conditionImmunities: effectDefenses.conditionImmunities,
    vulnerabilities: [] as string[],
  };
  const isPactMagic = args.classDetail?.slotsReset === "S";
  const usesFlexiblePreparedList = usesFlexiblePreparedSpells(args.classDetail);
  const preparedSpellLimit = args.classDetail && !isPactMagic
    ? getPreparedSpellCount(args.classDetail, args.char.level, args.subclass ?? "")
    : 0;
  const forcedPreparedSpellKeys = new Set(
    grantedSpellData.spells
      .filter((entry) => entry.mode === "always_prepared")
      .map((entry) => normalizeSpellTrackingKey(entry.spellName))
  );
  const knownSpellKeys = new Set((prof?.spells ?? []).map((entry) => normalizeSpellTrackingKey(entry.name)));
  const preparedSpells = buildPreparedSpells({
    currentCharacterData,
    usesFlexiblePreparedList,
    preparedSpellLimit,
    knownSpellKeys,
    forcedPreparedSpellKeys,
  });
  const grantedSpellNotesByKey = new Map(
    grantedSpellData.spells.map((entry) => [normalizeSpellTrackingKey(entry.spellName), entry.note ?? null] as const)
  );
  const invocationSpellDamageBonuses = buildInvocationSpellDamageBonuses({
    invocationDetails: args.invocationDetails,
    prof: prof ?? undefined,
    currentCharacterData,
    scoresCha: scores.cha,
    grantedSpellNotesByKey,
  });

  const accentColor = args.char.color ?? "#38b6ff";
  const overrides = args.char.overrides ?? currentCharacterData.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
  const conScoreDeltaPerLevel = abilityMod(scores.con) - abilityMod(args.char.conScore);
  const featureHpMaxBonus = deriveHitPointMaxBonusFromEffects(parsedFeatureEffects, { level: args.char.level, scores });
  const effectiveHpMax = Math.max(1, args.char.hpMax + (conScoreDeltaPerLevel * args.char.level) + featureHpMaxBonus + (overrides.hpMaxBonus ?? 0));
  const xpEarned = currentCharacterData.xp ?? 0;
  const xpNeeded = XP_TO_LEVEL[args.char.level + 1] ?? 0;
  const wornShield = inventory.find((item) => getEquipState(item) === "offhand" && isShieldItem(item));
  const shieldBonus = wornShield ? 2 : 0;
  const wornArmor = inventory.find((item) => getEquipState(item) === "worn" && isArmorItem(item) && (item.ac ?? 0) > 0);
  const speedArmorState = !wornArmor ? "no_armor" : /\bheavy armor\b/i.test(wornArmor.type ?? "") ? "any" : "not_heavy";
  const armorWithoutProficiency = Boolean(wornArmor && !hasArmorProficiency(wornArmor, prof ?? undefined));
  const shieldWithoutProficiency = Boolean(wornShield && !hasArmorProficiency(wornShield, prof ?? undefined));
  const nonProficientArmorPenalty = armorWithoutProficiency || shieldWithoutProficiency;
  const hasDisadvantage = (args.char.conditions ?? []).some((condition) => condition.key === "disadvantage");
  const stealthDisadvantage = Boolean((wornArmor && hasStealthDisadvantage(wornArmor)) || nonProficientArmorPenalty);
  const dexMod = abilityMod(scores.dex);
  const conMod = abilityMod(scores.con);
  const hasJackOfAllTrades = Boolean(
    args.classDetail?.autolevels
      ?.filter((autolevel) => autolevel.level <= args.char.level)
      .some((autolevel) => (autolevel.features ?? []).some((feature) => /jack of all trades/i.test(feature.name)))
  );
  const scoresByAbility: Record<AbilKey, number | null> = {
    str: scores.str,
    dex: scores.dex,
    con: scores.con,
    int: scores.int,
    wis: scores.wis,
    cha: scores.cha,
  };
  const wornArmorAc = (() => {
    if (!wornArmor || !wornArmor.ac) return null;
    const armorType = String(wornArmor.type ?? "").toLowerCase();
    if (armorType.includes("heavy")) return wornArmor.ac;
    if (armorType.includes("medium")) return wornArmor.ac + Math.min(2, dexMod);
    return wornArmor.ac + dexMod;
  })();
  const unarmoredDefenseAc = deriveUnarmoredDefenseFromEffects(parsedFeatureEffects, scoresByAbility, {
    armorEquipped: Boolean(wornArmor),
    shieldEquipped: Boolean(wornShield),
  });
  const featureAcBonus = deriveArmorClassBonusFromEffects(parsedFeatureEffects, {
    armorEquipped: Boolean(wornArmor),
    armorCategory:
      wornArmor && /\bheavy\b/i.test(wornArmor.type ?? "") ? "heavy"
      : wornArmor && /\bmedium\b/i.test(wornArmor.type ?? "") ? "medium"
      : wornArmor && /\blight\b/i.test(wornArmor.type ?? "") ? "light"
      : wornShield ? "shield"
      : "none",
    level: args.char.level,
    scores: scoresByAbility,
  });
  const effectiveAc = Math.max(args.char.ac, wornArmorAc ?? 0, unarmoredDefenseAc ?? 0) + featureAcBonus + (overrides.acBonus ?? 0) + shieldBonus;
  const speedBonus = deriveSpeedBonusFromEffects(parsedFeatureEffects, { armorState: speedArmorState, raging: rageActive });
  const effectiveSpeed = args.char.speed + speedBonus;
  const movementModes = collectMovementModesFromEffects(parsedFeatureEffects, {
    baseWalkSpeed: effectiveSpeed,
    armorState: speedArmorState,
    raging: rageActive,
  });
  const tempHp = overrides.tempHp ?? 0;
  const hpPct = effectiveHpMax > 0 ? Math.max(0, Math.min(1, args.char.hpCurrent / effectiveHpMax)) : 0;
  const tempPct = effectiveHpMax > 0 ? Math.min(1 - hpPct, tempHp / effectiveHpMax) : 0;
  const { passivePerc, passiveInv } = buildPassiveScores({
    parsedFeatureEffects,
    level: args.char.level,
    scoresByAbility,
    prof: prof ?? undefined,
    hasJackOfAllTrades,
    raging: rageActive,
  });
  const initiativeBonus = getInitiativeBonus(scores.dex, args.char.level, { jackOfAllTrades: hasJackOfAllTrades })
    + deriveModifierBonusFromEffects(parsedFeatureEffects, "initiative", { level: args.char.level, scores: scoresByAbility, raging: rageActive });
  const transformedCombatStats = buildTransformedCombatStats({
    monster: args.polymorphMonsterState.monster,
    effectiveAc,
    effectiveSpeed,
    passiveInv,
    className: args.char.className,
    fallbackStrScore: scores.str,
  });
  const saveBonuses = buildSaveBonuses({
    parsedFeatureEffects,
    level: args.char.level,
    scoresByAbility,
    raging: rageActive,
  });
  const {
    abilityCheckAdvantages,
    abilityCheckDisadvantages,
    saveAdvantages,
    saveDisadvantages,
    skillAdvantages,
    skillDisadvantages,
  } = buildModifierStateMaps({
    parsedFeatureEffects,
    raging: rageActive,
  });
  const rageDamageBonus = deriveAttackDamageBonusFromEffects(parsedFeatureEffects, {
    level: args.char.level,
    scores: scoresByAbility,
    raging: rageActive,
    attackAbility: "str",
    isWeapon: true,
  });
  const unarmedRageDamageBonus = deriveAttackDamageBonusFromEffects(parsedFeatureEffects, {
    level: args.char.level,
    scores: scoresByAbility,
    raging: rageActive,
    attackAbility: "str",
    isUnarmed: true,
  });
  const senses = effectSenses.map((sense) => `${sense.kind[0].toUpperCase()}${sense.kind.slice(1)} ${sense.range} ft.`);
  const editableOverrideFields = [
    { key: "tempHp", label: "Temp HP", help: "Current temporary hit points." },
    { key: "acBonus", label: "AC Bonus", help: "Bonus applied on top of normal armor class." },
    { key: "hpMaxBonus", label: "Max HP Modifier", help: "Bonus or penalty to maximum hit points." },
  ];
  const identityFields = [
    ["Alignment", currentCharacterData.alignment],
    ["Gender", currentCharacterData.gender],
    ["Age", currentCharacterData.age],
    ["Height", currentCharacterData.height],
    ["Weight", currentCharacterData.weight],
    ["Hair", currentCharacterData.hair],
    ["Skin", currentCharacterData.skin],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);

  return {
    currentCharacterData,
    prof,
    pb,
    hd,
    hitDieSize,
    hitDiceMax,
    hitDiceCurrent,
    inventory,
    baseScores,
    scores,
    scoreExplanations,
    appliedFeatures,
    classFeaturesList,
    parsedFeatureEffects,
    grantedSpellData,
    classResourcesWithSpellCasts,
    polymorphName,
    rageActive,
    parsedDefenses,
    usesFlexiblePreparedList,
    preparedSpellLimit,
    preparedSpells,
    invocationSpellDamageBonuses,
    accentColor,
    overrides,
    featureHpMaxBonus,
    effectiveHpMax,
    xpEarned,
    xpNeeded,
    nonProficientArmorPenalty,
    hasDisadvantage,
    stealthDisadvantage,
    dexMod,
    conMod,
    hasJackOfAllTrades,
    effectiveAc,
    effectiveSpeed,
    movementModes,
    tempHp,
    hpPct,
    tempPct,
    passivePerc,
    passiveInv,
    initiativeBonus,
    transformedCombatStats,
    saveBonuses,
    abilityCheckAdvantages,
    abilityCheckDisadvantages,
    saveAdvantages,
    saveDisadvantages,
    skillAdvantages,
    skillDisadvantages,
    rageDamageBonus,
    unarmedRageDamageBonus,
    senses,
    editableOverrideFields,
    identityFields,
  };
}
