/**
 * Module-level helpers, types, and constants extracted from CharacterView.tsx.
 * These are all pure functions or data â€” no React/hooks.
 */
import type { AbilKey, CharacterCampaign, CharacterClassEntry, CharacterData, ConditionInstance, ProficiencyMap, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import {
  dedupeTaggedItems,
  isLikelyTrackedSpellName,
  normalizeArmorProficiencyName,
  normalizeLanguageName,
  normalizeResourceKey,
  normalizeSpellTrackingName,
  splitArmorProficiencyNames,
  splitWeaponProficiencyNames,
  normalizeWeaponProficiencyName,
} from "@/views/character/CharacterSheetUtils";
import { getPolymorphCondition, type SharedPolymorphCondition } from "@beholden/shared/domain";
import { getEquipState, type InventoryItem } from "@/views/character/CharacterInventory";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Total XP required to reach each level (index = level). Index 0 unused. */
export const XP_TO_LEVEL = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 260000, 300000, 355000];

export const ABILITY_SCORE_NAMES: Record<AbilKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const SHEET_COLOR_PRESETS = [
  "#38bdf8",
  "#22c55e",
  "#f59e0b",
  "#ff5d5d",
  "#8b5cf6",
  "#fb7185",
  "#f97316",
  "#d946ef",
  "#14b8a6",
  "#06b6d4",
  "#84cc16",
  "#eab308",
  "#6366f1",
  "#94a3b8",
  "#ff6b3d",
  "#d08ce9",
  "#b9c4cf",
  "#8a9b32",
  "#a96c4f",
  "#5bc0eb",
  "#d4b24c",
  "#68b38c",
  "#6f6f6a",
  "#cf4444",
  "#8f46d9",
  "#0b5fff",
];

// ---------------------------------------------------------------------------
// Types: API response shapes
// ---------------------------------------------------------------------------

export interface Character {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  syncedAc?: number;
  speed: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  characterData: CharacterData | null;
  campaigns: CharacterCampaign[];
  conditions?: ConditionInstance[];
  overrides?: {
    tempHp: number;
    acBonus: number;
    hpMaxBonus: number;
    inspiration?: boolean;
    abilityScores?: Partial<Record<AbilKey, number>>;
  };
  deathSaves?: { success: number; fail: number };
  sharedNotes?: string;
  campaignSharedNotes?: string;
}

export interface ClassCounterDef {
  name: string;
  value: number;
  reset: string;
  subclass?: string | null;
}

export interface ClassRestDetail {
  id: string;
  name: string;
  hd: number | null;
  slotsReset?: string | null;
  autolevels: Array<{
    level: number;
    slots: number[] | null;
    counters: ClassCounterDef[];
    features?: Array<{
      name: string;
      text: string;
      optional?: boolean;
      preparedSpellProgression?: PreparedSpellProgressionTable[];
    }>;
  }>;
}

export interface LoreTraitDetail {
  name: string;
  text: string;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

export interface RaceFeatureDetail {
  id: string;
  name: string;
  traits: LoreTraitDetail[];
}

export interface BackgroundFeatureDetail {
  id: string;
  name: string;
  traits: LoreTraitDetail[];
}

export interface FeatFeatureDetail {
  id: string;
  name: string;
  text?: string | null;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

export interface LevelUpFeatDetail {
  level: number;
  featId: string;
  feat: FeatFeatureDetail;
}

export interface InvocationFeatureDetail {
  id: string;
  name: string;
  text: string;
}

export interface ClassFeatFeatureDetail {
  featureName: string;
  feat: FeatFeatureDetail;
}

export interface SheetOverrides {
  tempHp: number;
  acBonus: number;
  hpMaxBonus: number;
  inspiration?: boolean;
  abilityScores?: Partial<Record<AbilKey, number>>;
}

export type PolymorphConditionData = SharedPolymorphCondition & ConditionInstance;

export type EditableSheetOverrideKey = "tempHp" | "acBonus" | "hpMaxBonus";

export interface EditableSheetOverrideField {
  key: EditableSheetOverrideKey;
  label: string;
  help: string;
}

export interface ResourceProgressionOverride {
  className: string;
  featureName: string;
  values: Array<{ level: number; value: number }>;
}

export const RESOURCE_PROGRESSION_OVERRIDES: ResourceProgressionOverride[] = [
  {
    className: "Druid",
    featureName: "Wild Shape",
    values: [
      { level: 2, value: 2 },
      { level: 6, value: 3 },
      { level: 17, value: 4 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Inventory / ability score helpers
// ---------------------------------------------------------------------------

type ItemAbilityScoreOverride = {
  ability: AbilKey;
  value: number;
  mode: "set" | "minimum";
};

export function isInventoryItemActiveForCharacterEffects(item: InventoryItem): boolean {
  return getEquipState(item) !== "backpack" && (!item.attunement || Boolean(item.attuned));
}

export function parseItemAbilityScoreOverrides(item: InventoryItem): ItemAbilityScoreOverride[] {
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
): Record<AbilKey, string> {
  const activeItems = inventory.filter(isInventoryItemActiveForCharacterEffects);
  return Object.fromEntries(
    (Object.keys(baseScores) as AbilKey[]).map((ability) => {
      const base = baseScores[ability];
      const finalScore = effectiveScores[ability];
      const parts: string[] = [];
      parts.push(`${ABILITY_SCORE_NAMES[ability]} base score: ${base ?? "not set"}.`);
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
export function normalizeCharacterClasses(
  rawData: CharacterData | null | undefined,
): CharacterClassEntry[] {
  const entries = Array.isArray(rawData?.classes) ? rawData.classes : [];
  return entries
    .map((entry, index) => {
      const level = Math.max(1, Math.floor(Number(entry?.level ?? NaN) || 0));
      const classId = typeof entry?.classId === "string" && entry.classId.trim().length > 0 ? entry.classId.trim() : null;
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

export function normalizeCompendiumClassLookupName(name: string | null | undefined): string {
  return String(name ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function resolveResourceProgressionOverride(
  className: string | null | undefined,
  featureName: string | null | undefined,
  level: number,
): number | null {
  const normalizedClass = normalizeCompendiumClassLookupName(className);
  const normalizedFeature = String(featureName ?? "").trim().toLowerCase();
  const override = RESOURCE_PROGRESSION_OVERRIDES.find((entry) =>
    normalizeCompendiumClassLookupName(entry.className) === normalizedClass
    && entry.featureName.trim().toLowerCase() === normalizedFeature
  );
  if (!override) return null;
  let result: number | null = null;
  for (const row of override.values) {
    if (row.level <= level) result = row.value;
  }
  return result;
}

export function normalizeSubclassLookupName(name: string | null | undefined): string {
  return String(name ?? "").trim().toLowerCase();
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

export function shouldDisplayClassCounterResource(name: string | null | undefined): boolean {
  const normalized = String(name ?? "").trim();
  if (!normalized) return false;
  if (/^(spells prepared|plans known|known forms)$/i.test(normalized)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Resource collection / merging
// ---------------------------------------------------------------------------

export function collectClassResources(classDetail: ClassRestDetail | null, level: number, selectedSubclass?: string | null): ResourceCounter[] {
  if (!classDetail) return [];
  const latest = new Map<string, ResourceCounter>();
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level > level) continue;
    for (const counter of autolevel.counters ?? []) {
      const max = Math.max(0, Math.floor(Number(counter.value) || 0));
      const name = String(counter.name ?? "").trim();
      const counterSubclass = String(counter.subclass ?? "").trim();
      if (counterSubclass && normalizeSubclassLookupName(counterSubclass) !== normalizeSubclassLookupName(selectedSubclass)) continue;
      if (!name || max <= 0 || !shouldDisplayClassCounterResource(name)) continue;
      const key = normalizeResourceKey(name);
      latest.set(key, {
        key,
        name,
        current: max,
        max,
        reset: String(counter.reset ?? "L").trim().toUpperCase() || "L",
        restoreAmount: "all",
      });
    }
  }
  return Array.from(latest.values());
}

export function parseWordCount(value: string): number | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  const direct = Number.parseInt(normalized, 10);
  if (Number.isFinite(direct)) return direct;
  const words: Record<string, number> = {
    once: 1,
    one: 1,
    twice: 2,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  return words[normalized] ?? null;
}

export function collectFeatureResourceFallbacks(
  features: Array<{ name: string; text?: string | null }>,
  className: string | null | undefined,
  level: number,
): ResourceCounter[] {
  const fallback = new Map<string, ResourceCounter>();
  for (const feature of features) {
    const sourceLabel = String(feature.name ?? "").replace(/^Level\s+\d+\s*:\s*/i, "").trim();
    const text = String(feature.text ?? "").replace(/\s+/g, " ").trim();
    if (!sourceLabel || !text) continue;
    const escapedLabel = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fixedUseMatch = text.match(new RegExp(`you can use (?:the )?(?:${escapedLabel}|this feature)\\s+(once|twice|one|two|three|four|five|six|\\d+)`, "i"));
    const fixedUses = parseWordCount(fixedUseMatch?.[1] ?? "");
    const regainsOneOnShort = /regain one expended use when you finish a short rest/i.test(text);
    const regainsAllOnLong = /regain all expended uses when you finish a long rest/i.test(text);
    const regainsAllOnShortOrLong = /regain all expended uses when you finish a short or long rest/i.test(text);
    const regainsAllOnShort = /regain all expended uses when you finish a short rest/i.test(text);
    const reset =
      regainsOneOnShort ? "S"
      : regainsAllOnShortOrLong ? "SL"
      : regainsAllOnShort ? "S"
      : regainsAllOnLong ? "L"
      : null;
    if (!fixedUses || !reset) continue;
    const scaledMax = resolveResourceProgressionOverride(className, sourceLabel, level) ?? fixedUses;
    const key = normalizeResourceKey(sourceLabel);
    if (fallback.has(key)) continue;
    fallback.set(key, {
      key,
      name: sourceLabel,
      current: scaledMax,
      max: scaledMax,
      reset,
      restoreAmount: regainsOneOnShort ? "one" : "all",
    });
  }
  return Array.from(fallback.values());
}

export function mergeResourceState(saved: ResourceCounter[] | undefined, derived: ResourceCounter[]): ResourceCounter[] {
  const savedList = Array.isArray(saved) ? saved : [];
  const savedByKey = new Map(savedList.map((resource) => [resource.key || normalizeResourceKey(resource.name), resource]));
  const merged = derived.map((resource) => {
    const existing = savedByKey.get(resource.key);
    return {
      ...resource,
      restoreAmount: existing?.restoreAmount ?? resource.restoreAmount,
      current: Math.max(0, Math.min(resource.max, Math.floor(Number(existing?.current ?? resource.current) || 0))),
    };
  });
  const derivedKeys = new Set(merged.map((resource) => resource.key));
  const extras = savedList.filter((resource) => {
    if (derivedKeys.has(resource.key || normalizeResourceKey(resource.name))) return false;
    // Filter out stale resources from an older parser bug that embedded the feature source name
    // in the resource label (e.g. "it twice (Level 1: Favored Enemy)"). These were generated by
    // a regex that incorrectly captured pronoun + count words as a spell name. The pattern
    // `(Level \d+:` never appears in user-created resource names, so filtering it is safe.
    if (/\(Level \d+:/i.test(resource.name ?? "")) return false;
    return true;
  });
  return [...merged, ...extras];
}

export function shouldResetOnRest(resetCode: string | undefined, restType: "short" | "long"): boolean {
  const code = String(resetCode ?? "").trim().toUpperCase();
  if (restType === "short") return code === "S";
  return code === "S" || code === "L";
}

export function getPolymorphConditionData(conditions: ConditionInstance[] | undefined): PolymorphConditionData | null {
  return getPolymorphCondition(conditions) as PolymorphConditionData | null;
}


