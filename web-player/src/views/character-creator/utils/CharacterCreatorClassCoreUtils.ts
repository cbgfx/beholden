import { wordOrNumberToInt } from "@/lib/characterRules";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { abilityMod } from "@/views/character/CharacterSheetUtils";
import type { ParsedFeatChoiceLike as CreatorParsedFeatChoiceLike } from "./FeatChoiceTypes";
import {
  ABILITY_NAME_TO_KEY,
  ABILITY_SCORE_NAMES,
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
  ARMOR_PROFICIENCY_OPTIONS,
  SAVING_THROW_OPTIONS,
  WEAPON_MASTERY_KIND_SET,
  WEAPON_MASTERY_KINDS,
  WEAPON_PROFICIENCY_OPTIONS,
} from "../constants/CharacterCreatorConstants";

export { abilityMod, wordOrNumberToInt };

export interface CreatorFeatureLike {
  id?: string;
  name: string;
  text?: string | null;
  optional?: boolean;
  subclass?: string | null;
  effects?: unknown[];
  noteTemplate?: { id: string; title: string; text: string } | null;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
  talent?: { kind: "invocation" | "maneuver" | "metamagic"; known: Record<string, number>; replace?: true; ability?: string[] } | null;
  choices?: Array<
    | { kind: "feat"; category: "F"; count?: number; replace?: true }
    | { kind: "weapon_mastery"; known: Record<string, number>; melee?: true }
    | { kind: "expertise"; known: Record<string, number>; from?: string[] }
    | { kind: "proficiency"; category: "skill" | "tool" | "language" | "saving_throw"; count: number; from?: string | string[]; ifProficient?: string }
    | { id: string; kind: "spell"; lists: string[]; count?: number; level?: number; maxLevel?: number; school?: string; mode: "known" | "prepared" | "spellbook"; replace?: true; perNewSlotLevel?: true; freeCast?: true; ifKnown?: string }
  >;
}

export interface CreatorAutolevelLike {
  level: number;
  slots: number[] | null;
  spellsPrepared?: number | null;
  features?: CreatorFeatureLike[];
  counters?: Array<{ name: string; value: number; reset: string; subclass?: string | null }>;
}

export interface CreatorClassDetailLike {
  autolevels: CreatorAutolevelLike[];
  preparedSpellChanges?: "short_rest" | "long_rest" | null;
  spellcastingList?: string | null;
  equipmentOptions?: StructuredStartingEquipmentOption[];
  subclasses?: { level: number; options: Record<string, string> } | null;
  subclassDetails?: Record<string, string | {
    name: string;
    spellcasting?: {
      ability: string;
      list: string;
      progression?: Array<{ level: number; cantrips?: number; prepared?: number; slots?: number[] }>;
    };
  }>;
  spellLists?: Record<string, string>;
  choices?: Array<{ id: string; name: string; options: Array<{ id: string; name: string; features: string[] }> }>;
}

export interface ClassExpertiseChoice {
  key: string;
  source: string;
  count: number;
  options: string[] | null;
}

export interface CreatorItemSummaryLike {
  name: string;
  type: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
}

export interface StartingEquipmentOption {
  id: string;
  entries: string[];
  text: string;
  structuredEntries?: StructuredStartingEquipmentEntry[];
}

export type StructuredStartingEquipmentEntry =
  | { kind: "item"; itemId?: string; name?: string; quantity: number; sourceLabel?: string }
  | { kind: "choiceRef"; choiceKey: "background.tools" | "class.tools"; quantity: number; sourceLabel: string }
  | { kind: "itemChoice"; choiceKey: string; itemIds: string[]; quantity: number; sourceLabel: string }
  | { kind: "currency"; denomination: "PP" | "GP" | "EP" | "SP" | "CP"; amount: number };

export interface StructuredStartingEquipmentOption {
  id: string;
  entries: StructuredStartingEquipmentEntry[];
}

export function getMergedAutolevels(cls: CreatorClassDetailLike): CreatorAutolevelLike[] {
  const byLevel = new Map<number, CreatorAutolevelLike>();
  for (const autolevel of cls.autolevels ?? []) {
    if (autolevel.level == null) continue;
    const existing = byLevel.get(autolevel.level);
    if (!existing) {
      byLevel.set(autolevel.level, {
        ...autolevel,
        features: [...(autolevel.features ?? [])],
        counters: [...(autolevel.counters ?? [])],
      });
      continue;
    }
    byLevel.set(autolevel.level, {
      level: autolevel.level,
      slots: autolevel.slots ?? existing.slots ?? null,
      features: [...(existing.features ?? []), ...(autolevel.features ?? [])],
      counters: [...(existing.counters ?? []), ...(autolevel.counters ?? [])],
    });
  }
  return Array.from(byLevel.values()).sort((a, b) => a.level - b.level);
}

export function normalizeSubclassName(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function abilityNamesToKeys(names: string[]): string[] {
  return names.map((name) => ABILITY_NAME_TO_KEY[name.toLowerCase()] ?? "").filter(Boolean);
}

export function normalizeChoiceKey(value: unknown): string {
  if (typeof value === "string") {
    return value.trim().toLowerCase().replace(/[\s'-]+/g, " ");
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().toLowerCase().replace(/[\s'-]+/g, " ");
  }
  if (value && typeof value === "object") {
    const named = (value as { name?: unknown }).name;
    if (typeof named === "string") {
      return named.trim().toLowerCase().replace(/[\s'-]+/g, " ");
    }
  }
  return "";
}

export function calcHpMax(hd: number, level: number, conMod: number): number {
  if (level <= 0) return hd + conMod;
  return hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod);
}

export function getFeatureSubclassName(feature: CreatorFeatureLike): string | null {
  const explicit = String(feature.subclass ?? "").trim();
  return explicit || null;
}

export function isSubclassChoiceFeature(_feature: CreatorFeatureLike): boolean {
  return false;
}

export function featureMatchesSubclass(feature: CreatorFeatureLike, selectedSubclass: string | null | undefined): boolean {
  const featureSubclass = getFeatureSubclassName(feature);
  if (!featureSubclass) return true;
  if (isSubclassChoiceFeature(feature)) return false;
  return normalizeSubclassName(featureSubclass) === normalizeSubclassName(selectedSubclass);
}

export function getSubclassLevel(cls: CreatorClassDetailLike | null): number | null {
  return cls?.subclasses?.level ?? null;
}

export function featuresUpToLevelForSubclass(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null) {
  return getMergedAutolevels(cls)
    .filter((al) => al.level != null && al.level <= level)
    .flatMap((al) =>
      (al.features ?? [])
        .filter((feature) => (!feature.optional || Boolean(getFeatureSubclassName(feature))) && featureMatchesSubclass(feature, selectedSubclass) && !isSubclassChoiceFeature(feature))
        .map((feature) => ({ ...feature, level: al.level }))
    );
}

export function getSubclassList(cls: CreatorClassDetailLike): string[] {
  return Object.values(cls.subclasses?.options ?? {});
}

export function getSlotsAtLevel(cls: CreatorClassDetailLike, level: number): number[] | null {
  let best: number[] | null = null;
  for (const al of getMergedAutolevels(cls)) {
    if (al.level != null && al.level <= level && al.slots != null) best = al.slots;
  }
  return best;
}

export function getClassExpertiseChoices(cls: CreatorClassDetailLike | null, level: number): ClassExpertiseChoice[] {
  if (!cls) return [];
  const choices: ClassExpertiseChoice[] = [];
  const seen = new Set<string>();
  for (const al of getMergedAutolevels(cls)) {
    if (al.level == null || al.level > level) continue;
    for (const feature of al.features ?? []) {
      if (feature.optional) continue;
      const name = String(feature.name ?? "").trim();
      if (!name) continue;

      const structured = feature.choices?.find((choice) => choice.kind === "expertise");
      if (structured?.kind === "expertise") {
        for (const [requiredLevelText, count] of Object.entries(structured.known)) {
          const requiredLevel = Number(requiredLevelText);
          if (requiredLevel > level) continue;
          const key = `classexpertise:${requiredLevel}:${name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          choices.push({ key, source: name, count, options: structured.from ?? null });
        }
      }
    }
  }
  return choices;
}

const ABILITY_KEY_SET = new Set(["str", "dex", "con", "int", "wis", "cha"]);

export function parseSkillList(proficiency: string): string[] {
  return proficiency.split(/[,;]/).map((s) => s.trim()).filter((s) => s && !ABILITY_SCORE_NAMES.has(s) && !ABILITY_KEY_SET.has(s.toLowerCase()));
}

function normalizeFeatChoiceOption(option: unknown): string | null {
  if (typeof option === "string") return option;
  if (typeof option === "number" || typeof option === "boolean") return String(option);
  if (option && typeof option === "object") {
    const record = option as { name?: unknown; abil?: unknown };
    if (typeof record.name === "string" && typeof record.abil === "string" && record.abil.trim()) {
      return `${record.name} (${record.abil})`;
    }
    if (typeof record.name === "string") return record.name;
  }
  return null;
}

export function getFeatChoiceOptions(choice: CreatorParsedFeatChoiceLike): string[] {
  const SKILL_NAMES = ALL_SKILLS.map((skill) => skill.name);
  if (choice.type === "weapon_mastery") return [...WEAPON_MASTERY_KINDS];
  if (choice.options && choice.options.length > 0) {
    return choice.options
      .map(normalizeFeatChoiceOption)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b));
  }
  const combined = new Set<string>();
  for (const kind of choice.anyOf ?? []) {
    if (kind === "skill") SKILL_NAMES.forEach((item) => combined.add(item));
    if (kind === "tool") ALL_TOOLS.forEach((item) => combined.add(item));
    if (kind === "language") ALL_LANGUAGES.forEach((item) => combined.add(item));
    if (kind === "armor") ARMOR_PROFICIENCY_OPTIONS.forEach((item) => combined.add(item));
    if (kind === "weapon") WEAPON_PROFICIENCY_OPTIONS.forEach((item) => combined.add(item));
    if (kind === "saving_throw" || kind === "save") SAVING_THROW_OPTIONS.forEach((item) => combined.add(item));
  }
  return [...combined].sort((a, b) => a.localeCompare(b));
}

export function classifyFeatSelection(
  choice: CreatorParsedFeatChoiceLike,
  value: string,
): "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw" | "weapon_mastery" | null {
  const SKILL_NAMES = ALL_SKILLS.map((skill) => skill.name);
  if (choice.type === "weapon_mastery") return "weapon_mastery";
  if (choice.anyOf?.length === 1) {
    const only = choice.anyOf[0];
    if (only === "skill" || only === "tool" || only === "language") return only;
    if (only === "armor" || only === "weapon") return only;
    if (only === "saving_throw" || only === "save") return "saving_throw";
  }
  if (SKILL_NAMES.includes(value)) return "skill";
  if (ALL_TOOLS.includes(value)) return "tool";
  if (ALL_LANGUAGES.includes(value)) return "language";
  if (ARMOR_PROFICIENCY_OPTIONS.some((item) => item.toLowerCase() === value.toLowerCase())) return "armor";
  if (WEAPON_PROFICIENCY_OPTIONS.some((item) => item.toLowerCase() === value.toLowerCase())) return "weapon";
  if (SAVING_THROW_OPTIONS.some((item) => item.toLowerCase() === value.toLowerCase())) return "saving_throw";
  if (WEAPON_MASTERY_KIND_SET.has(value)) return "weapon_mastery";
  return null;
}
