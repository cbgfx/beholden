import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import type { CharacterClassEntry } from "@/views/character/CharacterSheetTypes";
import { featPrerequisitesMet, invocationPrerequisitesMet, resolvePactBoonFromChosenOptionals, spellLooksLikeDamageSpell } from "@/views/character/CharacterSheetUtils";
import type { ParsedFeatChoiceLike as LevelUpFeatChoiceLike, ParsedFeatDetailLike as SharedLevelUpFeatDetailLike } from "@/views/character-creator/utils/FeatChoiceTypes";
import type { ExclusiveGroupReplacementChoice } from "@/views/level-up/LevelUpExclusiveChoiceUtils";

type LevelUpFeatDetailLike = SharedLevelUpFeatDetailLike<LevelUpFeatChoiceLike> & { id: string };

interface LevelUpTaggedEntry {
  name: string;
  source: string;
  id?: string;
  level?: number | null;
  ability?: "str" | "dex" | "con" | "int" | "wis" | "cha" | null;
  sourceKey?: string | null;
}

interface LevelUpFeature {
  name: string;
  text?: string;
  noteTemplate?: { id: string; title: string; text: string } | null;
}

export interface BuildLevelUpPayloadArgs {
  char: {
    hpMax: number;
    hpCurrent: number;
    className: string;
    characterData?: {
      classes?: CharacterClassEntry[];
      chosenLevelUpFeats?: Array<{ level: number; featId?: string | null; type?: "asi" | "feat"; abilityBonuses?: Record<string, number> }>;
      chosenCantrips?: string[];
      chosenSpells?: string[];
      chosenInvocations?: string[];
      classSpellSelections?: Record<string, { chosenCantrips?: string[]; chosenSpells?: string[]; preparedSpells?: string[]; chosenInvocations?: string[] }>;
      chosenFeatOptions?: Record<string, string[]>;
      chosenFeatureChoices?: Record<string, string[]>;
      chosenOptionals?: string[];
      selectedFeatureNames?: string[];
      proficiencies?: {
        spells?: LevelUpTaggedEntry[];
        invocations?: LevelUpTaggedEntry[];
        expertise?: LevelUpTaggedEntry[];
        skills?: LevelUpTaggedEntry[];
        tools?: LevelUpTaggedEntry[];
        languages?: LevelUpTaggedEntry[];
        armor?: LevelUpTaggedEntry[];
        weapons?: LevelUpTaggedEntry[];
        saves?: LevelUpTaggedEntry[];
        maneuvers?: LevelUpTaggedEntry[];
        metamagic?: LevelUpTaggedEntry[];
        infusions?: LevelUpTaggedEntry[];
        plans?: LevelUpTaggedEntry[];
        [k: string]: unknown;
      };
      [k: string]: unknown;
    } | null;
  };
  nextLevel: number;
  nextClassLevel?: number;
  targetClassEntryId?: string;
  targetClassId?: string | null;
  isAddingClass?: boolean;
  multiclassProficiencies?: { skills: string[]; tools: string[]; armor: string[]; weapons: string[] };
  hpGain: number;
  featHpBonus: number;
  subclass: string;
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenInvocations: string[];
  chosenExpertise: Record<string, string[]>;
  chosenFeatOptions: Record<string, string[]>;
  invocationFeatChoices?: import("@/domain/character/invocationFeatChoices").InvocationFeatChoiceEntry[];
  allInvocationFeatChoices?: import("@/domain/character/invocationFeatChoices").InvocationFeatChoiceEntry[];
  chosenFeatureChoices: Record<string, string[]>;
  expertiseChoices: Array<{ key: string; source: string }>;
  expertiseReplacementChoices?: Array<{ key: string; source: string }>;
  fightingStyleReplacementChoice?: ExclusiveGroupReplacementChoice | null;
  pactBoonReplacementChoice?: ExclusiveGroupReplacementChoice | null;
  featChoiceEntries: LevelUpFeatChoiceLike[];
  chosenFeatDetail: LevelUpFeatDetailLike | null;
  featSourceLabel: string;
  featSpellChoiceOptions?: Record<string, LevelUpSpellLike[]>;
  newFeatures: LevelUpFeature[];
  usesFlexiblePreparedSpellsModel?: boolean;
  classDetailName?: string | null;
  selectedCantripEntries: LevelUpTaggedEntry[];
  selectedSpellEntries: LevelUpTaggedEntry[];
  selectedClassFeatureSpellEntries?: LevelUpTaggedEntry[];
  selectedFeatureProficiencyEntries?: Partial<Record<"skills" | "tools" | "languages" | "armor" | "weapons" | "saves", LevelUpTaggedEntry[]>>;
  selectedInvocationSpellEntries?: LevelUpTaggedEntry[];
  selectedInvocationEntries: LevelUpTaggedEntry[];
  selectedManeuverEntries?: LevelUpTaggedEntry[];
  selectedMetamagicEntries?: LevelUpTaggedEntry[];
  selectedInfusionEntries?: LevelUpTaggedEntry[];
  selectedPlanEntries?: LevelUpTaggedEntry[];
  baseScores: Record<string, number>;
  asiMode: "asi" | "feat" | null;
  asiStats: Record<string, number>;
  featAbilityBonuses: Record<string, number>;
}

interface LevelUpSpellLike {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
  check?: string | null;
  rolls?: Array<{ effect?: string | string[] | null }>;
  prerequisite?: import("@/views/character/CharacterSheetUtils").ClassTalentPrerequisite | null;
}

interface LevelUpFeatSummaryLike {
  id: string;
  name: string;
}

type LevelUpFeatPrereqProfLike = ProficiencyMap;

export interface DeriveAllowedInvocationIdsArgs {
  classCantrips: LevelUpSpellLike[];
  classInvocations: LevelUpSpellLike[];
  chosenCantrips: string[];
  chosenInvocations: string[];
  nextLevel: number;
  chosenOptionals?: string[];
}

export interface DeriveFeatAbilityBonusesArgs {
  chosenFeatDetail: {
    id: string;
    text?: string | null;
    parsed: {
      grants: {
        abilityIncreases: Record<string, number>;
      };
    };
  } | null;
  chosenFeatOptions: Record<string, string[]>;
  featChoiceEntries: LevelUpFeatChoiceLike[];
  nextLevel: number;
}

export interface DeriveLevelUpValidationArgs {
  ruleset: "5e" | "5.5e";
  isAsiLevel: boolean;
  asiMode: "asi" | "feat" | null;
  asiStats: Record<string, number>;
  needsSubclassChoice: boolean;
  subclass: string;
  cantripCount: number;
  chosenCantrips: string[];
  spellcaster: boolean;
  usesFlexiblePreparedSpellsModel?: boolean;
  prepCount: number;
  chosenSpells: string[];
  invocCount: number;
  chosenInvocations: string[];
  expertiseChoices: Array<{ key: string; count: number }>;
  expertiseReplacementChoices: Array<{ key: string; count: number }>;
  chosenExpertise: Record<string, string[]>;
  chosenFeatDetail: {
    id: string;
    name: string;
    text?: string | null;
    parsed?: {
      repeatable?: boolean;
      prerequisite?: import("@/views/character/CharacterSheetUtils").FeatPrerequisite | null;
    };
  } | null;
  featChoiceEntries: LevelUpFeatChoiceLike[];
  chosenFeatOptions: Record<string, string[]>;
  nextLevel: number;
  className?: string | null;
  level: number;
  scores: Record<string, number>;
  prof?: LevelUpFeatPrereqProfLike;
  featSearch: string;
  featSummaries: LevelUpFeatSummaryLike[];
  hpGain: number | null;
  existingLevelUpFeats?: Array<{ level: number; featId?: string | null; type?: "asi" | "feat"; abilityBonuses?: Record<string, number> }>;
  ownedFeatIds?: string[];
}

export function deriveAllowedInvocationIds(args: DeriveAllowedInvocationIdsArgs): Set<string> {
  const { classCantrips, classInvocations, chosenCantrips, chosenInvocations, nextLevel, chosenOptionals } = args;
  const selectedCantrips = classCantrips.filter((spell) => chosenCantrips.includes(spell.id));
  const hasDamageCantrip = selectedCantrips.some(spellLooksLikeDamageSpell);
  const hasAttackDamageCantrip = selectedCantrips.some((spell) =>
    spellLooksLikeDamageSpell(spell)
    && spell.check === "attack"
  );
  const chosenPactBoon = resolvePactBoonFromChosenOptionals(chosenOptionals);

  return new Set(
    classInvocations
      .filter((invocation) =>
        invocationPrerequisitesMet(invocation.prerequisite, {
          level: nextLevel,
          hasDamageCantrip,
          hasAttackDamageCantrip,
          chosenTalentIds: chosenInvocations,
          chosenPactBoon,
        })
      )
      .map((invocation) => invocation.id)
  );
}

export function deriveFeatAbilityBonuses(args: DeriveFeatAbilityBonusesArgs): Record<string, number> {
  const { chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel } = args;
  const bonusMap: Record<string, number> = {};
  if (!chosenFeatDetail) return bonusMap;

  const grantedAbilityKeys = new Set<string>();
  for (const [key, value] of Object.entries(chosenFeatDetail.parsed.grants.abilityIncreases ?? {})) {
    const abilityKey = key.toLowerCase().slice(0, 3);
    grantedAbilityKeys.add(abilityKey);
    bonusMap[abilityKey] = (bonusMap[abilityKey] ?? 0) + value;
  }

  for (const match of String(chosenFeatDetail.text ?? "").matchAll(
    /(?:increase\s+your|your)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score(?:\s+increases?)?\s+by\s+(\d+)/gi,
  )) {
    const abilityKey = String(match[1] ?? "").toLowerCase().slice(0, 3);
    if (grantedAbilityKeys.has(abilityKey)) continue;
    const amount = Number(match[2]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    grantedAbilityKeys.add(abilityKey);
    bonusMap[abilityKey] = (bonusMap[abilityKey] ?? 0) + amount;
  }

  for (const choice of featChoiceEntries) {
    if (choice.type !== "ability_score") continue;
    const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
    for (const selected of chosenFeatOptions[key] ?? []) {
      const abilityKey = selected.toLowerCase().slice(0, 3);
      bonusMap[abilityKey] = (bonusMap[abilityKey] ?? 0) + (choice.amount ?? 1);
    }
  }

  return bonusMap;
}

export function deriveHpGain(hpChoice: "roll" | "average" | "manual" | null, hpAverage: number, rolledHp: number | null, manualHp: string): number | null {
  if (hpChoice === "average") return hpAverage;
  if (hpChoice === "roll") return rolledHp ?? null;
  if (hpChoice === "manual") {
    const value = Number(manualHp);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  return null;
}

/** Why the level-up can't be confirmed yet. Rendered next to the confirm button. */
export type LevelUpBlockerKey =
  | "optionsLoading"
  | "hp"
  | "asi"
  | "subclass"
  | "cantrips"
  | "spells"
  | "invocations"
  | "expertise"
  | "expertiseReplacement"
  | "featMissing"
  | "featPrereq"
  | "featRepeatable"
  | "featOptions"
  | "multiclassRequirements"
  | "multiclassChoices"
  | "classChoices"
  | "extraChoices";

export function deriveLevelUpValidation(args: DeriveLevelUpValidationArgs) {
  const {
    isAsiLevel, asiMode, asiStats, needsSubclassChoice, subclass, cantripCount, chosenCantrips, spellcaster,
    prepCount, chosenSpells, invocCount, chosenInvocations, expertiseChoices, expertiseReplacementChoices, chosenExpertise, chosenFeatDetail,
    featChoiceEntries, chosenFeatOptions, nextLevel, className, level, scores, prof, featSearch, featSummaries, hpGain, existingLevelUpFeats, ownedFeatIds, ruleset,
  } = args;

  const availableFeatSummaries = featSummaries.filter(
    (feat) => ruleset !== "5.5e" || nextLevel >= 19 || !/^boon of\b/i.test(feat.name)
  );
  const needle = featSearch.trim().toLowerCase();
  const filteredFeatSummaries = !needle
    ? availableFeatSummaries
    : availableFeatSummaries.filter((feat) => feat.name.toLowerCase().includes(needle));

  const featPrereqsMet = chosenFeatDetail
    ? featPrerequisitesMet(chosenFeatDetail.parsed?.prerequisite, {
        level,
        className,
        scores,
        prof,
      spellcaster,
      featIds: [
        ...(ownedFeatIds ?? []),
        ...(existingLevelUpFeats ?? []).map((entry) => String(entry.featId ?? "")).filter(Boolean),
      ],
      })
    : false;
  const featRepeatableValid = !chosenFeatDetail
    || chosenFeatDetail.parsed?.repeatable
    || (!(existingLevelUpFeats ?? []).some((entry) => entry.featId === chosenFeatDetail.id)
      && !(ownedFeatIds ?? []).includes(chosenFeatDetail.id));

  const asiTotal = Object.values(asiStats).reduce((sum, value) => sum + value, 0);
  const asiValid =
    !isAsiLevel ||
    asiMode === "feat" ||
    (asiMode === "asi" && asiTotal === 2 && Object.entries(asiStats).every(([key, value]) =>
      ["str", "dex", "con", "int", "wis", "cha"].includes(key)
      && Number.isInteger(value) && value >= 0 && value <= 2
      && (value === 0 || (scores[key] ?? 10) + value <= 20)));
  const subclassValid = !needsSubclassChoice || Boolean(subclass.trim());
  const cantripsValid = cantripCount === 0 || chosenCantrips.length === cantripCount;
  const spellsValid = Boolean(args.usesFlexiblePreparedSpellsModel) || !spellcaster || prepCount === 0 || chosenSpells.length <= prepCount;
  const invocationsValid = invocCount === 0 || chosenInvocations.length === invocCount;
  const expertiseValid = expertiseChoices.every((choice) => (chosenExpertise[choice.key] ?? []).length === choice.count);
  const expertiseReplacementValid = expertiseReplacementChoices.every((choice) =>
    (chosenExpertise[choice.key] ?? []).length === choice.count
    && (chosenExpertise[`${choice.key}:target`] ?? []).length === choice.count
  );
  const featValid =
    asiMode !== "feat" ||
    (
      Boolean(chosenFeatDetail) &&
      featPrereqsMet &&
      featRepeatableValid &&
      featChoiceEntries
        .filter((choice) => choice.type !== "spell" && choice.type !== "spell_list")
        .every((choice) => {
        if (!chosenFeatDetail) return false;
        return (chosenFeatOptions[`levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`] ?? []).length === choice.count;
      })
    );
  const canConfirm =
    hpGain !== null && Number.isSafeInteger(hpGain) && hpGain > 0 &&
    asiValid &&
    subclassValid &&
    cantripsValid &&
    spellsValid &&
    invocationsValid &&
    expertiseValid &&
    expertiseReplacementValid &&
    featValid;

  // Every unmet requirement, so the confirm button can say why it won't submit. The feat case is
  // split apart because "pick a feat", "you don't meet its prerequisite", "you already have it" and
  // "it still needs options chosen" send you to four different places on the page.
  const blockers: LevelUpBlockerKey[] = [];
  if (hpGain === null || !Number.isSafeInteger(hpGain) || hpGain <= 0) blockers.push("hp");
  if (!asiValid) blockers.push("asi");
  if (!subclassValid) blockers.push("subclass");
  if (!cantripsValid) blockers.push("cantrips");
  if (!spellsValid) blockers.push("spells");
  if (!invocationsValid) blockers.push("invocations");
  if (!expertiseValid) blockers.push("expertise");
  if (!expertiseReplacementValid) blockers.push("expertiseReplacement");
  if (asiMode === "feat" && !featValid) {
    if (!chosenFeatDetail) blockers.push("featMissing");
    else if (!featPrereqsMet) blockers.push("featPrereq");
    else if (!featRepeatableValid) blockers.push("featRepeatable");
    else blockers.push("featOptions");
  }

  return {
    blockers,
    availableFeatSummaries,
    filteredFeatSummaries,
    featPrereqsMet,
    featRepeatableValid,
    asiTotal,
    asiValid,
    subclassValid,
    cantripsValid,
    spellsValid,
    invocationsValid,
    expertiseValid,
    expertiseReplacementValid,
    featValid,
    canConfirm,
  };
}
