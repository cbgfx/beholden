import {
  parseMonsterSpeed,
  proficiencyBonusFromChallengeRating,
  readMonsterNumber,
  readMonsterSkillBonus,
} from "@beholden/shared/domain";
import { ALL_SKILLS, ABILITY_FULL } from "@/views/character/CharacterSheetConstants";
import type { AbilKey, CharacterData, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import {
  type Character,
  type ClassRestDetail,
  type RaceFeatureDetail,
  type BackgroundFeatureDetail,
  type FeatFeatureDetail,
  type LevelUpFeatDetail,
  type InvocationFeatureDetail,
  type ClassFeatFeatureDetail,
  type SheetOverrides,
  type EditableSheetOverrideField,
  type PolymorphConditionData,
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
  deriveModifierStateFromEffects,
  deriveSpeedBonusFromEffects,
  deriveUnarmoredDefenseFromEffects,
  parseFeatureEffects,
  type ParseFeatureEffectsInput,
} from "@/domain/character/parseFeatureEffects";
import {
  abilityMod,
  getInitiativeBonus,
  getPassiveScore,
  getSkillBonus,
  normalizeSpellTrackingKey,
  proficiencyBonus,
  spellLooksLikeDamageSpell,
} from "@/views/character/CharacterSheetUtils";
import {
  type InventoryItem,
  getEquipState,
  hasArmorProficiency,
  hasStealthDisadvantage,
  isArmorItem,
  isShieldItem,
} from "@/views/character/CharacterInventory";
import { getPreparedSpellCount, usesFlexiblePreparedSpells } from "@/views/character-creator/utils/CharacterCreatorUtils";

type TransformedMonsterState = {
  monster: any | null;
  busy: boolean;
  error: string | null;
};

type CharacterViewDerivedStateArgs = {
  char: Character;
  classDetail: ClassRestDetail | null;
  raceDetail: RaceFeatureDetail | null;
  backgroundDetail: BackgroundFeatureDetail | null;
  bgOriginFeatDetail: FeatFeatureDetail | null;
  raceFeatDetail: FeatFeatureDetail | null;
  classFeatDetails: ClassFeatFeatureDetail[];
  levelUpFeatDetails: LevelUpFeatDetail[];
  invocationDetails: InvocationFeatureDetail[];
  subclass: string | null;
  polymorphCondition: PolymorphConditionData | null;
  polymorphMonsterState: TransformedMonsterState;
};

type CharacterViewDerivedState = {
  currentCharacterData: CharacterData;
  prof: ReturnType<typeof normalizeProficiencies>;
  pb: number;
  hd: number | null;
  hitDieSize: number | null;
  hitDiceMax: number;
  hitDiceCurrent: number;
  inventory: InventoryItem[];
  baseScores: Record<AbilKey, number | null>;
  scores: Record<AbilKey, number | null>;
  scoreExplanations: ReturnType<typeof buildAbilityScoreExplanations>;
  appliedFeatures: ReturnType<typeof buildAppliedCharacterFeatures>;
  classFeaturesList: ReturnType<typeof buildDisplayPlayerFeatures>;
  parsedFeatureEffects: ReturnType<typeof parseFeatureEffects>[];
  grantedSpellData: ReturnType<typeof buildGrantedSpellDataFromEffects>;
  classResourcesWithSpellCasts: ResourceCounter[];
  polymorphName: string;
  rageActive: boolean;
  parsedDefenses: {
    resistances: string[];
    damageImmunities: string[];
    conditionImmunities: string[];
    vulnerabilities: string[];
  };
  usesFlexiblePreparedList: boolean;
  preparedSpellLimit: number;
  preparedSpells: string[];
  invocationSpellDamageBonuses: Record<string, number>;
  accentColor: string;
  overrides: SheetOverrides;
  featureHpMaxBonus: number;
  effectiveHpMax: number;
  xpEarned: number;
  xpNeeded: number;
  nonProficientArmorPenalty: boolean;
  hasDisadvantage: boolean;
  stealthDisadvantage: boolean;
  dexMod: number;
  conMod: number;
  hasJackOfAllTrades: boolean;
  effectiveAc: number;
  effectiveSpeed: number;
  movementModes: ReturnType<typeof collectMovementModesFromEffects>;
  tempHp: number;
  hpPct: number;
  tempPct: number;
  passivePerc: number;
  passiveInv: number;
  initiativeBonus: number;
  transformedCombatStats: {
    effectiveAc: number;
    speed: number;
    movementModes: ReturnType<typeof parseMonsterSpeed>["modes"];
    initiativeBonus: number;
    pb: number;
    passivePerc: number;
    passiveInv: number;
    dexScore: number;
    strScore: number | null;
    className: string;
  } | null;
  saveBonuses: Partial<Record<AbilKey, number>>;
  abilityCheckAdvantages: Partial<Record<AbilKey, boolean>>;
  abilityCheckDisadvantages: Partial<Record<AbilKey, boolean>>;
  saveAdvantages: Partial<Record<AbilKey, boolean>>;
  saveDisadvantages: Partial<Record<AbilKey, boolean>>;
  skillAdvantages: Record<string, boolean>;
  skillDisadvantages: Record<string, boolean>;
  rageDamageBonus: number;
  unarmedRageDamageBonus: number;
  senses: string[];
  editableOverrideFields: EditableSheetOverrideField[];
  identityFields: [string, string][];
};

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
  const preparedSpells = (() => {
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
  })();
  const invocationSpellDamageBonuses = (() => {
    const hasAgonizingBlast = args.invocationDetails.some((invocation) => {
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
    const chaMod = abilityMod(scores.cha);
    if (chaMod === 0) return bySpellKey;

    const damageCantripEntries = (prof?.spells ?? []).filter((spell) =>
      spellLooksLikeDamageSpell({
        name: spell.name,
        text: grantedSpellData.spells.find((entry) => normalizeSpellTrackingKey(entry.spellName) === normalizeSpellTrackingKey(spell.name))?.note ?? null,
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
  })();

  const accentColor = args.char.color ?? "#38b6ff";
  const overrides: SheetOverrides = args.char.overrides ?? currentCharacterData.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
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
  const passiveScoreBonus = deriveModifierBonusFromEffects(parsedFeatureEffects, "passive_score", {
    level: args.char.level,
    scores: scoresByAbility,
    raging: rageActive,
  });
  const passivePerc = getPassiveScore(getSkillBonus("Perception", "wis", scoresByAbility, args.char.level, prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades })) + passiveScoreBonus;
  const passiveInv = getPassiveScore(getSkillBonus("Investigation", "int", scoresByAbility, args.char.level, prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades })) + passiveScoreBonus;
  const initiativeBonus = getInitiativeBonus(scores.dex, args.char.level, { jackOfAllTrades: hasJackOfAllTrades })
    + deriveModifierBonusFromEffects(parsedFeatureEffects, "initiative", { level: args.char.level, scores: scoresByAbility, raging: rageActive });
  const transformedCombatStats = args.polymorphMonsterState.monster ? (() => {
    const monsterDex = readMonsterNumber(args.polymorphMonsterState.monster.dex) ?? 10;
    const monsterWis = readMonsterNumber(args.polymorphMonsterState.monster.wis) ?? 10;
    const speedData = parseMonsterSpeed(args.polymorphMonsterState.monster.speed);
    const skillPerception = readMonsterSkillBonus(args.polymorphMonsterState.monster, "Perception");
    return {
      effectiveAc: readMonsterNumber(args.polymorphMonsterState.monster.ac?.value ?? args.polymorphMonsterState.monster.ac ?? args.polymorphMonsterState.monster.armor_class) ?? effectiveAc,
      speed: speedData.walk ?? effectiveSpeed,
      movementModes: speedData.modes,
      initiativeBonus: abilityMod(monsterDex),
      pb: proficiencyBonusFromChallengeRating(args.polymorphMonsterState.monster.cr ?? args.polymorphMonsterState.monster.challenge_rating),
      passivePerc: skillPerception != null ? 10 + skillPerception : 10 + abilityMod(monsterWis),
      passiveInv,
      dexScore: monsterDex,
      strScore: readMonsterNumber(args.polymorphMonsterState.monster.str) ?? scores.str,
      className: args.polymorphMonsterState.monster.name ?? args.char.className,
    };
  })() : null;
  const saveBonuses = Object.fromEntries(
    (Object.entries(ABILITY_FULL) as [AbilKey, string][]).map(([key, name]) => [
      key,
      deriveModifierBonusFromEffects(parsedFeatureEffects, "saving_throw", { appliesTo: name, level: args.char.level, scores: scoresByAbility, raging: rageActive }),
    ])
  ) as Partial<Record<AbilKey, number>>;
  const abilityCheckAdvantages: Partial<Record<AbilKey, boolean>> = {};
  const abilityCheckDisadvantages: Partial<Record<AbilKey, boolean>> = {};
  const saveAdvantages: Partial<Record<AbilKey, boolean>> = {};
  const saveDisadvantages: Partial<Record<AbilKey, boolean>> = {};
  (Object.keys(ABILITY_FULL) as AbilKey[]).forEach((ability) => {
    const abilityName = ABILITY_FULL[ability];
    const abilityCheckState = deriveModifierStateFromEffects(parsedFeatureEffects, "ability_check", { appliesTo: abilityName, raging: rageActive });
    const saveState = deriveModifierStateFromEffects(parsedFeatureEffects, "saving_throw", { appliesTo: abilityName, raging: rageActive });
    if (abilityCheckState.advantage) abilityCheckAdvantages[ability] = true;
    if (abilityCheckState.disadvantage) abilityCheckDisadvantages[ability] = true;
    if (saveState.advantage) saveAdvantages[ability] = true;
    if (saveState.disadvantage) saveDisadvantages[ability] = true;
  });
  const skillAdvantages = Object.fromEntries(
    ALL_SKILLS
      .filter(({ name }) => deriveModifierStateFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, raging: rageActive }).advantage)
      .map(({ name }) => [name, true]),
  ) as Record<string, boolean>;
  const skillDisadvantages = Object.fromEntries(
    ALL_SKILLS
      .filter(({ name }) => deriveModifierStateFromEffects(parsedFeatureEffects, "skill_check", { appliesTo: name, raging: rageActive }).disadvantage)
      .map(({ name }) => [name, true]),
  ) as Record<string, boolean>;
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
