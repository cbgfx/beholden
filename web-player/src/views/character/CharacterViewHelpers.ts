import type { AbilKey, CharacterClassEntry, CharacterData, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import {
  dedupeTaggedItems,
  isLikelyTrackedSpellName,
  normalizeArmorProficiencyName,
  normalizeLanguageName,
  normalizeSpellTrackingName,
  splitArmorProficiencyNames,
  splitWeaponProficiencyNames,
  normalizeWeaponProficiencyName,
} from "@/views/character/CharacterSheetUtils";
import { getPolymorphCondition } from "@beholden/shared/domain";
import { getEquipState, type InventoryItem } from "@/views/character/CharacterInventory";
import { resolveStoredCompendiumClassId } from "@/domain/character/classIds";
import type { ExtraFeatAbilityApplication } from "@/domain/character/extraFeatAbilityScores";
import type { PolymorphConditionData } from "./CharacterViewTypes";

export {
  XP_TO_LEVEL,
  SHEET_COLOR_PRESETS,
  type Character,
  type ClassCounterDef,
  type ClassRestDetail,
  type LoreTraitDetail,
  type RaceFeatureDetail,
  type BackgroundFeatureDetail,
  type FeatFeatureDetail,
  type LevelUpFeatDetail,
  type InvocationFeatureDetail,
  type ClassFeatFeatureDetail,
  type SheetOverrides,
  type PolymorphConditionData,
  type EditableSheetOverrideKey,
  type EditableSheetOverrideField,
  type ResourceProgressionOverride,
} from "./CharacterViewTypes";

export {
  collectClassResources,
  collectFeatureResourceFallbacks,
  mergeResourceState,
  shouldResetOnRest,
} from "./CharacterViewResourceHelpers";

// ---------------------------------------------------------------------------
// Inventory / ability score helpers
// ---------------------------------------------------------------------------

const ABILITY_SCORE_NAMES: Record<AbilKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

type ItemAbilityScoreOverride = {
  ability: AbilKey;
  value: number;
  mode: "set" | "minimum";
};

export function isInventoryItemActiveForCharacterEffects(item: InventoryItem): boolean {
  return getEquipState(item) !== "backpack" && (!item.attunement || Boolean(item.attuned));
}

function parseItemAbilityScoreOverrides(item: InventoryItem): ItemAbilityScoreOverride[] {
  const text = `${item.description ?? ""}\n${item.notes ?? ""}`;
  if (!text.trim()) return [];
  const overrides: ItemAbilityScoreOverride[] = [];
  for (const [ability, abilityName] of Object.entries(ABILITY_SCORE_NAMES) as [AbilKey, string][]) {
    const overrideMatch = text.match(new RegExp(`\\b(?:your\\s+)?${abilityName}\\s+score\\s+(?:is|becomes?|equals?|increases?\\s+to|rises?\\s+to|has\\s+a\\s+score\\s+of)\\s+(\\d+)\\b`, "i"));
    if (!overrideMatch) continue;
    const value = Number.parseInt(overrideMatch[1], 10);
    if (!Number.isFinite(value)) continue;
    const minimumMode = new RegExp(`no effect on you if your ${abilityName} is already ${value} or higher`, "i").test(text)
      || new RegExp(`if your ${abilityName} is already ${value} or higher`, "i").test(text)
      || new RegExp(`unless your ${abilityName} is already ${value} or higher`, "i").test(text);
    overrides.push({ ability, value, mode: minimumMode ? "minimum" : "set" });
  }
  return overrides;
}

export function applyItemAbilityScoreOverrides(
  baseScores: Record<AbilKey, number | null>,
  inventory: InventoryItem[],
): Record<AbilKey, number | null> {
  const activeOverrides = inventory
    .filter(isInventoryItemActiveForCharacterEffects)
    .flatMap((item) => parseItemAbilityScoreOverrides(item));
  const nextScores = { ...baseScores };
  for (const ability of Object.keys(baseScores) as AbilKey[]) {
    const base = baseScores[ability];
    const setValues = activeOverrides.filter((entry) => entry.ability === ability && entry.mode === "set").map((entry) => entry.value);
    const minimumValues = activeOverrides.filter((entry) => entry.ability === ability && entry.mode === "minimum").map((entry) => entry.value);
    let current = base;
    if (setValues.length > 0) current = Math.max(...setValues);
    if (minimumValues.length > 0) current = Math.max(current ?? Number.NEGATIVE_INFINITY, ...minimumValues);
    nextScores[ability] = Number.isFinite(current ?? NaN) ? current : base;
  }
  return nextScores;
}

export function buildAbilityScoreExplanations(
  baseScores: Record<AbilKey, number | null>,
  effectiveScores: Record<AbilKey, number | null>,
  inventory: InventoryItem[],
  extraFeatApplications: ExtraFeatAbilityApplication[] = [],
): Record<AbilKey, string> {
  const activeItems = inventory.filter(isInventoryItemActiveForCharacterEffects);
  return Object.fromEntries(
    (Object.keys(baseScores) as AbilKey[]).map((ability) => {
      const base = baseScores[ability];
      const finalScore = effectiveScores[ability];
      const parts: string[] = [];
      parts.push(`${ABILITY_SCORE_NAMES[ability]} base score: ${base ?? "not set"}.`);
      for (const application of extraFeatApplications.filter((entry) => entry.ability === ability)) {
        parts.push(`${application.featName}: +${application.amount} (maximum ${application.maximum}).`);
      }
      for (const item of activeItems) {
        for (const override of parseItemAbilityScoreOverrides(item)) {
          if (override.ability !== ability) continue;
          const verb = override.mode === "minimum" ? `sets ${ABILITY_SCORE_NAMES[ability]} to at least ${override.value}` : `sets ${ABILITY_SCORE_NAMES[ability]} to ${override.value}`;
          parts.push(`${item.name}: ${verb}.`);
        }
      }
      parts.push(`${ABILITY_SCORE_NAMES[ability]} final score: ${finalScore ?? "not set"}.`);
      return [ability, parts.join("\n")];
    })
  ) as Record<AbilKey, string>;
}

// ---------------------------------------------------------------------------
// Proficiency normalization
// ---------------------------------------------------------------------------

export function normalizeProficiencies(rawProf: CharacterData["proficiencies"] | undefined): ProficiencyMap | undefined {
  if (!rawProf) return undefined;
  const isCountWord = (value: string): boolean =>
    /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(value.trim());
  const isNoiseToken = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "this"
      || normalized === "that"
      || normalized === "these"
      || normalized === "those"
      || normalized === "extra"
      || normalized === "another"
      || normalized === "any"
      || normalized === "language"
      || normalized === "languages"
      || normalized === "tool"
      || normalized === "tools"
      || normalized === "skill"
      || normalized === "skills"
      || isCountWord(normalized)
    );
  };
  const isNamedPlaceholder = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === ""
      || normalized === "none"
      || normalized === "n/a"
      || normalized === "-"
      || normalized === "—"
      || isNoiseToken(normalized)
    );
  };
  const isExpertiseChoicePlaceholder = (value: string): boolean =>
    /\b(?:choose|choice|of your choice)\b/i.test(value)
    || /\b(?:one|two|three|four|five|six|\d+)\s+(?:more\s+)?of your skill proficiencies\b/i.test(value);
  const isToolChoicePlaceholder = (value: string): boolean =>
    /^(?:\d+|one|two|three|four|five|six)\s+musical instruments?$/i.test(value.trim())
    || /\b(?:choose|choice|of your choice|any one type)\b/i.test(value);
  const sanitizedTrackedSpells = dedupeTaggedItems(rawProf.spells, normalizeSpellTrackingName)
    .filter((entry) => isLikelyTrackedSpellName(entry.name));
  const sanitizedArmor = dedupeTaggedItems(
    (rawProf.armor ?? []).flatMap((entry) =>
      splitArmorProficiencyNames(entry?.name ?? "").map((name) => ({ ...entry, name }))
    ),
    normalizeArmorProficiencyName,
  );
  const sanitizedWeapons = dedupeTaggedItems(
    (rawProf.weapons ?? []).flatMap((entry) =>
      splitWeaponProficiencyNames(entry?.name ?? "").map((name) => ({ ...entry, name }))
    ),
    normalizeWeaponProficiencyName,
  );
  const sanitizedTools = dedupeTaggedItems(rawProf.tools)
    .filter((entry) => {
      const name = String(entry.name ?? "");
      return !isNamedPlaceholder(name) && !isToolChoicePlaceholder(name) && !/\bof your choice\b/i.test(name);
    });
  const sanitizedExpertise = dedupeTaggedItems(rawProf.expertise)
    .filter((entry) => {
      const name = String(entry.name ?? "");
      return !isExpertiseChoicePlaceholder(name) && !isNamedPlaceholder(name) && !/\bof your choice\b/i.test(name);
    });
  const sanitizedLanguages = dedupeTaggedItems(rawProf.languages, normalizeLanguageName)
    .filter((entry) => {
      const name = String(entry.name ?? "");
      return !isNamedPlaceholder(name) && !/\bof your choice\b/i.test(name);
    });
  return {
    ...rawProf,
    skills: dedupeTaggedItems(rawProf.skills)
      .filter((entry) => {
        const name = String(entry.name ?? "");
        return !isNamedPlaceholder(name) && !/\bof your choice\b/i.test(name);
      }),
    expertise: sanitizedExpertise,
    saves: dedupeTaggedItems(rawProf.saves),
    armor: sanitizedArmor,
    weapons: sanitizedWeapons,
    tools: sanitizedTools,
    languages: sanitizedLanguages,
    spells: sanitizedTrackedSpells,
    invocations: dedupeTaggedItems(rawProf.invocations),
    maneuvers: dedupeTaggedItems(rawProf.maneuvers),
    plans: dedupeTaggedItems(rawProf.plans),
  };
}

// ---------------------------------------------------------------------------
// Character class utilities
// ---------------------------------------------------------------------------

export function normalizeCharacterClasses(
  rawData: CharacterData | null | undefined,
): CharacterClassEntry[] {
  const entries = Array.isArray(rawData?.classes) ? rawData.classes : [];
  return entries
    .map((entry, index) => {
      const level = Math.max(1, Math.floor(Number(entry?.level ?? NaN) || 0));
      const classId = resolveStoredCompendiumClassId(entry) || null;
      const className = typeof entry?.className === "string" && entry.className.trim().length > 0 ? entry.className.trim() : null;
      if (!classId && !className) return null;
      return {
        id: typeof entry?.id === "string" && entry.id.trim().length > 0 ? entry.id.trim() : `class_${index}_${classId ?? className ?? "entry"}`,
        classId,
        className,
        level,
        subclass: typeof entry?.subclass === "string" && entry.subclass.trim().length > 0 ? entry.subclass.trim() : null,
      } satisfies CharacterClassEntry;
    })
    .filter(Boolean) as CharacterClassEntry[];
}

export function getPrimaryCharacterClassEntry(
  rawData: CharacterData | null | undefined,
): CharacterClassEntry | null {
  return normalizeCharacterClasses(rawData)[0] ?? null;
}

// ---------------------------------------------------------------------------
// General utilities
// ---------------------------------------------------------------------------

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function stripEditionTag(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s*\[(?:5\.5e|2024|5e|5\.0)\]\s*$/i, "")
    .trim();
}

export function parseLeadingNumberLoose(value: unknown): number {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

export function getPolymorphConditionData(conditions: unknown[] | undefined): PolymorphConditionData | null {
  return getPolymorphCondition(conditions as never) as PolymorphConditionData | null;
}
