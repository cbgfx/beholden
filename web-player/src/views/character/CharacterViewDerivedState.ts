import type { AbilKey, CharacterData, ProficiencyMap, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import { hasZeroSpeedCondition, itemModifierBonus, SLOW_SPEED_PENALTY } from "@beholden/shared/domain";
import {
  applyItemAbilityScoreOverrides,
  buildAbilityScoreExplanations,
  collectClassResources,
  isInventoryItemActiveForCharacterEffects,
  mergeResourceState,
  normalizeProficiencies,
  stripEditionTag,
  XP_TO_LEVEL,
  type EditableSheetOverrideField,
} from "@/views/character/CharacterViewHelpers";
import {
  buildAppliedCharacterFeatures,
  buildDisplayPlayerFeatures,
  buildPreparedSpellProgressionGrants,
} from "@/domain/character/characterFeatures";
import { applyExtraFeatAbilityScores } from "@/domain/character/extraFeatAbilityScores";
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
  buildSkillBonuses,
  buildSaveBonuses,
  buildTransformedCombatStats,
} from "@/views/character/CharacterViewDerivedComputations";
import type { CharacterViewDerivedState, CharacterViewDerivedStateArgs } from "@/views/character/CharacterViewDerivedTypes";
import type { AppliedCharacterFeatureEntry } from "@/domain/character/characterFeatures";
import type { TaggedItem } from "@/views/character/CharacterSheetTypes";
import type { ClassRestDetail } from "@/views/character/CharacterViewHelpers";

function emptyProficiencyMap(): ProficiencyMap {
  return {
    skills: [], expertise: [], saves: [], armor: [], weapons: [], tools: [], languages: [],
    spells: [], invocations: [], maneuvers: [], plans: [],
  };
}

/** Fixed class proficiencies are canonical class facts. Reconcile them at read time so
 * older or partially saved characters cannot lose armor/weapon/save proficiency. */
export function mergeFixedClassProficiencies(
  stored: ProficiencyMap | undefined,
  classDetail: ClassRestDetail | null,
): ProficiencyMap | undefined {
  if (!stored && !classDetail) return undefined;
  const merged = stored
    ? Object.fromEntries(Object.entries(stored).map(([key, values]) => [key, [...values]])) as unknown as ProficiencyMap
    : emptyProficiencyMap();
  if (!classDetail) return merged;

  const add = (target: TaggedItem[], name: string) => {
    const trimmed = name.trim();
    if (!trimmed || target.some((entry) => entry.name.trim().toLowerCase() === trimmed.toLowerCase())) return;
    target.push({ name: trimmed, source: classDetail.name });
  };
  const split = (value: string | null | undefined) => String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const armor = classDetail.proficiencies?.armor ?? split(classDetail.armor);
  const weapons = classDetail.proficiencies?.weapons ?? split(classDetail.weapons);
  for (const name of armor) add(merged.armor, name);
  for (const name of weapons) add(merged.weapons, name);
  for (const name of classDetail.proficiencies?.savingThrows ?? []) add(merged.saves, name);
  return merged;
}

export function resolveChosenFeatSpell(args: {
  feature: AppliedCharacterFeatureEntry;
  choiceId: string;
  chosenFeatOptions: Record<string, string[]>;
  knownSpells: TaggedItem[];
}): TaggedItem | null {
  const directPrefixes = [
    args.feature.id.startsWith("levelupfeat:") ? args.feature.id : null,
    args.feature.id.startsWith("race-feat:") ? `race:${args.feature.name}` : null,
    args.feature.id.startsWith("bg-feat:") ? `bg:${args.feature.name}` : null,
    args.feature.id.startsWith("class-feat:") ? `classfeat:${args.feature.name}` : null,
    args.feature.id.startsWith("extra-feat:") ? `extra-feat:${args.feature.name}` : null,
  ].filter((value): value is string => Boolean(value));
  const directKeys = directPrefixes.map((prefix) => `${prefix}:${args.choiceId}`);
  const fallbackKeys = Object.keys(args.chosenFeatOptions)
    .filter((key) => key.endsWith(`:${args.choiceId}`));
  const selected = [...directKeys, ...fallbackKeys]
    .flatMap((key) => args.chosenFeatOptions[key] ?? []);
  if (selected.length === 0) return null;

  const selectedKeys = new Set(selected.map((value) => String(value).trim().toLowerCase()));
  return args.knownSpells.find((spell) =>
    (spell.id && selectedKeys.has(String(spell.id).trim().toLowerCase()))
    || selectedKeys.has(spell.name.trim().toLowerCase())) ?? null;
}

export function buildCharacterViewDerivedState(args: CharacterViewDerivedStateArgs): CharacterViewDerivedState {
  const currentCharacterData: CharacterData = args.char.characterData ?? {};
  const prof = mergeFixedClassProficiencies(
    normalizeProficiencies(currentCharacterData.proficiencies),
    args.classDetail,
  );
  const pb = proficiencyBonus(args.char.level);
  const hd = currentCharacterData.hd ?? null;
  const hitDieSize = hd ?? args.classDetail?.hd ?? null;
  const hitDiceMax = Math.max(0, args.char.level);
  const hitDiceCurrent = Math.max(0, Math.min(hitDiceMax, Math.floor(Number(currentCharacterData.hitDiceCurrent ?? hitDiceMax) || 0)));
  const inventory = currentCharacterData.inventory ?? [];
  const overrides = args.char.overrides ?? currentCharacterData.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
  const baseScores: Record<AbilKey, number | null> = {
    str: args.char.strScore,
    dex: args.char.dexScore,
    con: args.char.conScore,
    int: args.char.intScore,
    wis: args.char.wisScore,
    cha: args.char.chaScore,
  };
  const extraFeatAbilityResult = applyExtraFeatAbilityScores(
    baseScores,
    args.extraFeatDetails,
    currentCharacterData.extraFeatAbilityChoices,
  );
  const itemAdjustedScores = applyItemAbilityScoreOverrides(extraFeatAbilityResult.scores, inventory);
  const scores = (() => {
    const next = { ...itemAdjustedScores };
    const abilityScores = overrides.abilityScores;
    if (!abilityScores || typeof abilityScores !== "object") return next;
    for (const ability of Object.keys(next) as AbilKey[]) {
      const value = Math.floor(Number(abilityScores[ability]));
      if (!Number.isFinite(value) || value < 1 || value > 30) continue;
      next[ability] = value;
    }
    return next;
  })();
  const scoreExplanations = buildAbilityScoreExplanations(
    baseScores,
    scores,
    inventory,
    extraFeatAbilityResult.applications,
  );
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
    extraFeatDetails: args.extraFeatDetails,
  };
  const appliedFeatures = buildAppliedCharacterFeatures(featureArgs);
  const classFeaturesList = buildDisplayPlayerFeatures(featureArgs);
  const spellLinkedResourceKeys = new Set<string>();
  const parsedFeatureEffects = appliedFeatures.map((feature, index) => {
    const parsed = parseFeatureEffects({
      source: { id: `feature:${index}:${feature.id}`, kind: feature.kind, name: feature.name, text: feature.text },
      text: feature.text,
      suppressStructuredSpellGrants: Boolean(feature.preparedSpellProgression?.length),
      classEffects: feature.classEffects,
      classChoices: feature.classChoices,
      traitEffects: feature.traitEffects,
      featMechanics: feature.featMechanics,
    } satisfies ParseFeatureEffectsInput);
    for (const [useIndex, use] of (feature.featMechanics?.uses ?? []).entries()) {
      if (use.grantsSpell || use.grantsChoiceId) {
        spellLinkedResourceKeys.add(`${parsed.source.id}:use:${useIndex + 1}`);
      }
      if (!use.grantsChoiceId) continue;
      const spell = resolveChosenFeatSpell({
        feature,
        choiceId: use.grantsChoiceId,
        chosenFeatOptions: currentCharacterData.chosenFeatOptions ?? {},
        knownSpells: prof?.spells ?? [],
      });
      if (!spell) continue;
      parsed.effects.push({
        id: `${parsed.source.id}:spell_grant:${parsed.effects.length + 1}`,
        source: parsed.source,
        type: "spell_grant",
        spellName: spell.name,
        spellId: spell.id,
        mode: "free_cast",
        castsWithoutSlot: true,
        resourceKey: `${parsed.source.id}:use:${useIndex + 1}`,
      });
    }
    return parsed;
  });
  const parsedItemEffects = inventory
    .filter((item) => isInventoryItemActiveForCharacterEffects(item))
    .map((item, index) => {
      if (!Array.isArray(item.effects) || item.effects.length === 0) return null;
      return parseFeatureEffects({
        source: { id: `item:${index}:${item.id}`, kind: "item", name: item.name, text: "" },
        text: "",
        traitEffects: item.effects,
      } satisfies ParseFeatureEffectsInput);
    })
    .filter((entry): entry is ReturnType<typeof parseFeatureEffects> => Boolean(entry));
  const parsedAllEffects = [...parsedFeatureEffects, ...parsedItemEffects];
  const progressionGrantedSpells = buildPreparedSpellProgressionGrants(appliedFeatures, args.char.level, currentCharacterData.chosenFeatureChoices).map((entry) => ({
    key: entry.key,
    spellName: entry.spellName,
    sourceName: entry.sourceName,
    mode: "always_prepared" as const,
    note: entry.note,
    ability: entry.ability ?? null,
  }));
  const grantedSpellData = (() => {
    const base = buildGrantedSpellDataFromEffects(parsedAllEffects, scores, args.char.level);
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
    ]) {
      if (!byKey.has(resource.key)) byKey.set(resource.key, resource);
    }
    return Array.from(byKey.values());
  })();
  const classResourcesWithSpellCasts = mergeResourceState(currentCharacterData.resources, derivedResources);
  const polymorphName = stripEditionTag(args.polymorphCondition?.polymorphName ?? "");
  const rageActive = (args.char.conditions ?? []).some((condition) => condition.key === "rage");
  const effectDefenses = collectDefensesFromEffects(parsedAllEffects, { raging: rageActive });
  const effectSenses = collectSensesFromEffects(parsedAllEffects);
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
  const conScoreDeltaPerLevel = abilityMod(scores.con) - abilityMod(args.char.conScore);
  const featureHpMaxBonus = deriveHitPointMaxBonusFromEffects(parsedAllEffects, { level: args.char.level, scores });
  const conScoreDeltaWithoutOverrides = abilityMod(itemAdjustedScores.con) - abilityMod(args.char.conScore);
  const effectiveHpMaxWithoutOverrides = Math.max(1, args.char.hpMax + (conScoreDeltaWithoutOverrides * args.char.level) + featureHpMaxBonus);
  const effectiveHpMax = Math.max(1, args.char.hpMax + (conScoreDeltaPerLevel * args.char.level) + featureHpMaxBonus + (overrides.hpMaxBonus ?? 0));
  const xpEarned = currentCharacterData.xp ?? 0;
  const xpNeeded = XP_TO_LEVEL[args.char.level + 1] ?? 0;
  const wornShield = inventory.find((item) => getEquipState(item) === "offhand" && isShieldItem(item));
  // Every shield grants a flat +2 (that's a rule keyed off the item's structured `type`, not
  // inferred from its name) plus whatever magic enchantment bonus the compendium's `modifiers`
  // carries for this specific item (e.g. a Shield +1 adds another +1) — see itemModifierBonus.
  const shieldBonus = wornShield ? 2 + itemModifierBonus(wornShield.modifiers, "ac") : 0;
  const wornArmor = inventory.find((item) => getEquipState(item) === "worn" && isArmorItem(item) && (item.ac ?? 0) > 0);
  const otherEquippedAcBonus = inventory
    .filter((item) => item !== wornArmor && item !== wornShield && isInventoryItemActiveForCharacterEffects(item))
    .reduce((total, item) => total + itemModifierBonus(item.modifiers, "ac"), 0);
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
    // Magic armor's enchantment bonus (e.g. Studded Leather Armor +1) lives in the item's
    // `modifiers`, separate from its base `ac` — add it before the Dex-cap math below, same as
    // the base AC itself.
    const armorBase = wornArmor.ac + itemModifierBonus(wornArmor.modifiers, "ac");
    const armorType = String(wornArmor.type ?? "").toLowerCase();
    if (armorType.includes("heavy")) return armorBase;
    if (armorType.includes("medium")) return armorBase + Math.min(2, dexMod);
    return armorBase + dexMod;
  })();
  // Unarmored Defense (Barbarian's Dex+Con, Monk's Dex+Wis, etc.) is derived entirely from the
  // class feature's own text via parseArmorClassEffects — no class-name check needed here.
  // Confirmed both Barbarian's and Monk's real compendium text parse correctly, including which
  // two abilities to use and whether a shield disables it.
  const unarmoredDefenseAc = deriveUnarmoredDefenseFromEffects(parsedAllEffects, scoresByAbility, {
    armorEquipped: Boolean(wornArmor),
    shieldEquipped: Boolean(wornShield),
  });
  const featureAcBonus = deriveArmorClassBonusFromEffects(parsedAllEffects, {
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
  const naturalAc = 10 + dexMod;
  const effectiveAc = Math.max(naturalAc, wornArmorAc ?? 0, unarmoredDefenseAc ?? 0)
    + featureAcBonus
    + otherEquippedAcBonus
    + (overrides.acBonus ?? 0)
    + shieldBonus;
  const speedBonus = deriveSpeedBonusFromEffects(parsedAllEffects, { armorState: speedArmorState, raging: rageActive, level: args.char.level });
  const baseWalkSpeed = args.raceDetail?.speed ?? args.char.speed;
  let effectiveSpeed = (baseWalkSpeed ?? 0) + speedBonus;
  if (hasZeroSpeedCondition(args.char.conditions)) {
    effectiveSpeed = 0;
  } else if ((args.char.conditions ?? []).some((c) => c.key === "slow")) {
    effectiveSpeed = Math.max(0, effectiveSpeed - SLOW_SPEED_PENALTY);
  }
  const movementModes = collectMovementModesFromEffects(parsedAllEffects, {
    baseWalkSpeed: effectiveSpeed,
    armorState: speedArmorState,
    raging: rageActive,
  });
  const tempHp = overrides.tempHp ?? 0;
  const { passivePerc, passiveInv } = buildPassiveScores({
    parsedFeatureEffects: parsedAllEffects,
    level: args.char.level,
    scoresByAbility,
    prof: prof ?? undefined,
    hasJackOfAllTrades,
    raging: rageActive,
  });
  const initiativeBonus = getInitiativeBonus(scores.dex, args.char.level, { jackOfAllTrades: hasJackOfAllTrades })
    + deriveModifierBonusFromEffects(parsedAllEffects, "initiative", { level: args.char.level, scores: scoresByAbility, raging: rageActive });
  const spellSaveDcBonus = deriveModifierBonusFromEffects(parsedAllEffects, "spell_save_dc", {
    level: args.char.level,
    scores: scoresByAbility,
    raging: rageActive,
  });
  const transformedCombatStats = buildTransformedCombatStats({
    monster: args.polymorphMonsterState.monster,
    effectiveAc,
    effectiveSpeed,
    passiveInv,
    className: args.char.className,
    fallbackStrScore: scores.str,
  });
  const saveBonuses = buildSaveBonuses({
    parsedFeatureEffects: parsedAllEffects,
    level: args.char.level,
    scoresByAbility,
    raging: rageActive,
  });
  const skillBonuses = buildSkillBonuses({
    parsedFeatureEffects: parsedAllEffects,
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
    parsedFeatureEffects: parsedAllEffects,
    raging: rageActive,
  });
  const rageDamageBonus = deriveAttackDamageBonusFromEffects(parsedAllEffects, {
    level: args.char.level,
    scores: scoresByAbility,
    raging: rageActive,
    attackAbility: "str",
    isWeapon: true,
  });
  const unarmedRageDamageBonus = deriveAttackDamageBonusFromEffects(parsedAllEffects, {
    level: args.char.level,
    scores: scoresByAbility,
    raging: rageActive,
    attackAbility: "str",
    isUnarmed: true,
  });
  const senses = effectSenses.map((sense) => `${sense.kind === "devils_sight" ? "Devil's Sight" : `${sense.kind[0].toUpperCase()}${sense.kind.slice(1)}`} ${sense.range} ft.`);
  const editableOverrideFields: EditableSheetOverrideField[] = [
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
    parsedFeatureEffects: parsedAllEffects,
    grantedSpellData,
    spellLinkedResourceKeys,
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
    effectiveHpMax,
    effectiveHpMaxWithoutOverrides,
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
    passivePerc,
    passiveInv,
    initiativeBonus,
    spellSaveDcBonus,
    transformedCombatStats,
    saveBonuses,
    skillBonuses,
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
