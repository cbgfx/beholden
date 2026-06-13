import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import type { CharacterClassEntry } from "@/views/character/CharacterSheetTypes";
import { featPrerequisitesMet, invocationPrerequisitesMet, normalizeSpellTrackingKey, spellLooksLikeDamageSpell } from "@/views/character/CharacterSheetUtils";
import type { ParsedFeatChoiceLike as LevelUpFeatChoiceLike, ParsedFeatDetailLike as SharedLevelUpFeatDetailLike } from "@/views/character-creator/utils/FeatChoiceTypes";

export { buildLevelUpPayload } from "./buildLevelUpPayload";

type LevelUpFeatDetailLike = SharedLevelUpFeatDetailLike<LevelUpFeatChoiceLike> & { id: string };

export interface LevelUpTaggedEntry {
  name: string;
  source: string;
  id?: string;
  ability?: "str" | "dex" | "con" | "int" | "wis" | "cha" | null;
  sourceKey?: string | null;
}

export interface LevelUpFeature {
  name: string;
  text?: string;
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
      chosenFeatOptions?: Record<string, string[]>;
      chosenFeatureChoices?: Record<string, string[]>;
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
        plans?: LevelUpTaggedEntry[];
        [k: string]: unknown;
      };
      [k: string]: unknown;
    } | null;
  };
  nextLevel: number;
  hpGain: number;
  featHpBonus: number;
  subclass: string;
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenInvocations: string[];
  chosenExpertise: Record<string, string[]>;
  chosenFeatOptions: Record<string, string[]>;
  chosenFeatureChoices: Record<string, string[]>;
  expertiseChoices: Array<{ key: string; source: string }>;
  featChoiceEntries: LevelUpFeatChoiceLike[];
  chosenFeatDetail: LevelUpFeatDetailLike | null;
  featSourceLabel: string;
  featSpellChoiceOptions?: Record<string, LevelUpSpellLike[]>;
  newFeatures: LevelUpFeature[];
  classDetailName?: string | null;
  selectedCantripEntries: LevelUpTaggedEntry[];
  selectedSpellEntries: LevelUpTaggedEntry[];
  selectedClassFeatureSpellEntries?: LevelUpTaggedEntry[];
  selectedFeatureProficiencyEntries?: Partial<Record<"skills" | "tools" | "languages" | "armor" | "weapons" | "saves", LevelUpTaggedEntry[]>>;
  selectedInvocationSpellEntries?: LevelUpTaggedEntry[];
  selectedInvocationEntries: LevelUpTaggedEntry[];
  selectedManeuverEntries?: LevelUpTaggedEntry[];
  selectedPlanEntries?: LevelUpTaggedEntry[];
  baseScores: Record<string, number>;
  asiMode: "asi" | "feat" | null;
  asiStats: Record<string, number>;
  featAbilityBonuses: Record<string, number>;
}

export interface LevelUpSpellLike {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
}

export interface LevelUpFeatSummaryLike {
  id: string;
  name: string;
}

export type LevelUpFeatPrereqProfLike = ProficiencyMap;

export interface DeriveAllowedInvocationIdsArgs {
  classCantrips: LevelUpSpellLike[];
  classInvocations: LevelUpSpellLike[];
  chosenCantrips: string[];
  chosenInvocations: string[];
  nextLevel: number;
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
  isAsiLevel: boolean;
  asiMode: "asi" | "feat" | null;
  asiStats: Record<string, number>;
  needsSubclassChoice: boolean;
  subclass: string;
  cantripCount: number;
  chosenCantrips: string[];
  spellcaster: boolean;
  prepCount: number;
  chosenSpells: string[];
  invocCount: number;
  chosenInvocations: string[];
  expertiseChoices: Array<{ key: string; count: number }>;
  chosenExpertise: Record<string, string[]>;
  chosenFeatDetail: {
    id: string;
    name: string;
    text?: string | null;
    parsed?: {
      repeatable?: boolean;
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
}

export function deriveAllowedInvocationIds(args: DeriveAllowedInvocationIdsArgs): Set<string> {
  const { classCantrips, classInvocations, chosenCantrips, chosenInvocations, nextLevel } = args;
  const chosenCantripNames = classCantrips
    .filter((spell) => chosenCantrips.includes(spell.id))
    .map((spell) => spell.name);
  const chosenDamageCantripNames = classCantrips
    .filter((spell) => chosenCantrips.includes(spell.id) && spellLooksLikeDamageSpell(spell))
    .map((spell) => spell.name);
  const chosenInvocationNames = classInvocations
    .filter((invocation) => chosenInvocations.includes(invocation.id))
    .map((invocation) => invocation.name);

  return new Set(
    classInvocations
      .filter((invocation) =>
        invocationPrerequisitesMet(invocation.text ?? "", {
          level: nextLevel,
          chosenCantripNames,
          chosenDamageCantripNames,
          chosenInvocationNames,
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
    const value = parseInt(manualHp, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  return null;
}

export function deriveLevelUpValidation(args: DeriveLevelUpValidationArgs) {
  const {
    isAsiLevel, asiMode, asiStats, needsSubclassChoice, subclass, cantripCount, chosenCantrips, spellcaster,
    prepCount, chosenSpells, invocCount, chosenInvocations, expertiseChoices, chosenExpertise, chosenFeatDetail,
    featChoiceEntries, chosenFeatOptions, nextLevel, className, level, scores, prof, featSearch, featSummaries, hpGain, existingLevelUpFeats,
  } = args;

  const availableFeatSummaries = featSummaries.filter(
    (feat) => nextLevel >= 19 || !/^boon of\b/i.test(feat.name)
  );
  const needle = featSearch.trim().toLowerCase();
  const filteredFeatSummaries = !needle
    ? availableFeatSummaries
    : availableFeatSummaries.filter((feat) => feat.name.toLowerCase().includes(needle));

  const featPrereqsMet = chosenFeatDetail
    ? featPrerequisitesMet(chosenFeatDetail.text, {
        level,
        className,
        scores,
        prof,
        spellcaster,
      })
    : false;
  const featRepeatableValid = !chosenFeatDetail
    || chosenFeatDetail.parsed?.repeatable
    || !(existingLevelUpFeats ?? []).some((entry) => entry.featId === chosenFeatDetail.id);

  const asiTotal = Object.values(asiStats).reduce((sum, value) => sum + value, 0);
  const asiValid =
    !isAsiLevel ||
    asiMode === "feat" ||
    (asiMode === "asi" && asiTotal === 2 && Object.values(asiStats).every((value) => value <= 2));
  const subclassValid = !needsSubclassChoice || Boolean(subclass.trim());
  const cantripsValid = cantripCount === 0 || chosenCantrips.length === cantripCount;
  const spellsValid = !spellcaster || prepCount === 0 || chosenSpells.length <= prepCount;
  const invocationsValid = invocCount === 0 || chosenInvocations.length === invocCount;
  const expertiseValid = expertiseChoices.every((choice) => (chosenExpertise[choice.key] ?? []).length === choice.count);
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
    hpGain !== null &&
    asiValid &&
    subclassValid &&
    cantripsValid &&
    spellsValid &&
    invocationsValid &&
    expertiseValid &&
    featValid;

  return {
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
    featValid,
    canConfirm,
  };
}

