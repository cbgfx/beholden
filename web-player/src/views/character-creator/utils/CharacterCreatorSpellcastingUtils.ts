import { wordOrNumberToInt } from "@/lib/characterRules";
import {
  featureMatchesSubclass,
  featuresUpToLevelForSubclass,
  getFeatureSubclassName,
  getMergedAutolevels,
  getSlotsAtLevel,
  isSubclassChoiceFeature,
  normalizeSubclassName,
  type CreatorClassDetailLike,
  type CreatorFeatureLike,
} from "./CharacterCreatorClassCoreUtils";

export interface SlotLevelTriggeredSpellChoiceDef {
  key: string;
  title: string;
  sourceLabel: string;
  triggerLevel: number;
  count: number;
  level: number | null;
  listNames: string[];
  schools?: string[];
  note?: string | null;
}

const SPELL_LIST_NAMES = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const SPELL_SCHOOL_NAMES = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];

function parseLevelTable(text: string): [number, number][] {
  const pairs: [number, number][] = [];
  let inTable = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!inTable) {
      if (/\blevel\b/i.test(line) && /\|/.test(line) && !/^\d/.test(line)) inTable = true;
      continue;
    }
    const match = line.match(/^(\d+)\s*\|?\s*(\d+)/);
    if (match) {
      pairs.push([parseInt(match[1]), parseInt(match[2])]);
    } else if (line.length > 0 && !/^\d/.test(line)) {
      break;
    }
  }
  return pairs.sort((a, b) => a[0] - b[0]);
}

export function tableValueAtLevel(table: [number, number][], level: number): number {
  let result = 0;
  for (const [lvl, val] of table) {
    if (lvl <= level) result = val;
  }
  return result;
}

function getRelevantClassFeatures(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): CreatorFeatureLike[] {
  return getMergedAutolevels(cls)
    .filter((al) => al.level != null && al.level <= level)
    .flatMap((al) =>
      (al.features ?? []).filter((feature) => featureMatchesSubclass(feature, selectedSubclass) && !isSubclassChoiceFeature(feature))
    );
}

function getSpellcastingFeature(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): CreatorFeatureLike | null {
  const relevant = getRelevantClassFeatures(cls, level, selectedSubclass);
  return relevant.find((feature) => /(pact magic|spellcasting)/i.test(feature.name)) ?? null;
}

export function getSpellcastingClassName(cls: CreatorClassDetailLike | null, level: number, selectedSubclass?: string | null): string | null {
  if (!cls) return null;
  const feature = getSpellcastingFeature(cls, level, selectedSubclass);
  if (!feature) return null;
  const fromList = (feature.text ?? "").match(/from the ([A-Za-z' -]+?) spell list/i);
  if (fromList?.[1]) return fromList[1].trim();
  const spellType = (feature.text ?? "").match(/for your ([A-Za-z' -]+?) spells/i);
  if (spellType?.[1]) return spellType[1].trim();
  return null;
}

export function getCantripCount(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number {
  const slotCount = getSlotsAtLevel(cls, level)?.[0] ?? 0;
  if (slotCount > 0) return slotCount;
  const spellcastingFeature = getSpellcastingFeature(cls, level, selectedSubclass);
  if (!spellcastingFeature) return 0;
  const knownMatch = (spellcastingFeature.text ?? "").match(/you know (\w+) cantrips?/i);
  let known = wordOrNumberToInt(knownMatch?.[1] ?? "") ?? 0;
  for (const match of (spellcastingFeature.text ?? "").matchAll(/when you reach [A-Za-z]+ level (\d+), you learn another [^.]*?cantrip/gi)) {
    const unlockLevel = Number(match[1]);
    if (Number.isFinite(unlockLevel) && level >= unlockLevel) known += 1;
  }
  return known;
}

export function getMaxSlotLevel(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number {
  const slots = getSlotsAtLevel(cls, level);
  if (slots) {
    for (let i = slots.length - 1; i >= 1; i--) {
      if (slots[i] > 0) return i;
    }
  }
  const spellcastingFeature = getSpellcastingFeature(cls, level, selectedSubclass);
  if (spellcastingFeature && getFeatureSubclassName(spellcastingFeature)) {
    if (level >= 19) return 4;
    if (level >= 13) return 3;
    if (level >= 7) return 2;
    if (level >= 3) return 1;
  }
  return 0;
}

export function getPreparedSpellCount(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number {
  for (const autolevel of getMergedAutolevels(cls)) {
    if (autolevel.level == null || autolevel.level > level) continue;
    for (const counter of autolevel.counters ?? []) {
      const counterSubclass = String(counter?.subclass ?? "").trim();
      if (counterSubclass && normalizeSubclassName(counterSubclass) !== normalizeSubclassName(selectedSubclass)) continue;
      if (!/^spells prepared$/i.test(String(counter?.name ?? "").trim())) continue;
      const value = Math.floor(Number(counter?.value ?? 0) || 0);
      if (value > 0) return value;
    }
  }
  const prepTable = getClassFeatureTable(cls, "Prepared Spells|Pact Magic|Spellcasting", level, selectedSubclass);
  return prepTable.length > 0 ? tableValueAtLevel(prepTable, level) : 0;
}

export function isSpellcaster(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): boolean {
  return getCantripCount(cls, level, selectedSubclass) > 0 || getMaxSlotLevel(cls, level, selectedSubclass) > 0 || getPreparedSpellCount(cls, level, selectedSubclass) > 0;
}

export function usesFlexiblePreparedSpells(cls: CreatorClassDetailLike | null): boolean {
  if (!cls) return false;
  const spellcastingFeatureText = getMergedAutolevels(cls)
    .flatMap((autolevel) => autolevel.features ?? [])
    .find((feature) => /spellcasting|pact magic/i.test(String(feature.name ?? "")))
    ?.text ?? "";
  return /changing your prepared spells\.\s*whenever you finish a (?:short|long) rest/i.test(spellcastingFeatureText);
}

export function getClassFeatureTable(cls: CreatorClassDetailLike, keyword: string, level: number, selectedSubclass?: string | null): [number, number][] {
  for (const al of getMergedAutolevels(cls)) {
    if (al.level == null || al.level > level) continue;
    for (const feature of al.features ?? []) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      if ((!feature.optional || Boolean(getFeatureSubclassName(feature))) && new RegExp(keyword, "i").test(feature.name)) {
        const table = parseLevelTable(feature.text ?? "");
        if (table.length > 0) return table;
      }
    }
  }
  return [];
}

function parseSpellListsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const name of SPELL_LIST_NAMES) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) found.add(name);
  }
  return Array.from(found);
}

function parseSpellSchoolsFromText(text: string): string[] {
  const normalizedText = text.replace(/\billus\s+ion\b/gi, "Illusion");
  const found = new Set<string>();
  for (const school of SPELL_SCHOOL_NAMES) {
    if (new RegExp(`\\b${school}\\b`, "i").test(normalizedText)) found.add(school);
  }
  return Array.from(found);
}

function normalizeChoiceDefKey(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSlotLevelTriggeredChoice(
  feature: CreatorFeatureLike & { level: number },
  maxSpellLevel: number,
  triggerLevel: number,
): SlotLevelTriggeredSpellChoiceDef | null {
  const text = String(feature.text ?? "");
  if (!/gain access to a new level of spell slots in this class/i.test(text)) return null;
  if (!/\bspellbook\b/i.test(text)) return null;

  const schoolMatch = text.match(/you can add\s+(once|twice|one|two|three|four|five|six|\d+)\s+([A-Z][A-Za-z' -]+?)\s+spell(?:s)?\s+from\s+the\s+([A-Za-z\s]+?)\s+school(?:s)?\s+to\s+your\s+spellbook\s+for\s+free/i);
  const listMatch = text.match(/you can add\s+(once|twice|one|two|three|four|five|six|\d+)\s+([A-Z][A-Za-z' -]+?)\s+spell(?:s)?\s+to\s+your\s+spellbook\s+for\s+free/i);
  const countText = schoolMatch?.[1] ?? listMatch?.[1] ?? "";
  const count = wordOrNumberToInt(countText) ?? 0;
  const explicitListName = schoolMatch?.[2]?.trim() ?? listMatch?.[2]?.trim() ?? "";
  const listNames = explicitListName ? parseSpellListsFromText(explicitListName) : [];
  const schools = schoolMatch?.[3] ? parseSpellSchoolsFromText(schoolMatch[3]) : [];
  if (count <= 0 || listNames.length === 0) return null;

  return {
    key: `slotgrowth:${feature.level}:${triggerLevel}:${maxSpellLevel}:${normalizeChoiceDefKey(feature.name)}`,
    title: feature.name,
    sourceLabel: feature.name,
    triggerLevel,
    count,
    level: maxSpellLevel > 0 ? maxSpellLevel : null,
    listNames,
    schools: schools.length > 0 ? schools : undefined,
    note: maxSpellLevel > 0
      ? `At or below level ${maxSpellLevel}. Granted when you gain access to a new spell-slot level.`
      : "Granted when you gain access to a new spell-slot level.",
  };
}

export function getSlotLevelTriggeredSpellChoices(
  cls: CreatorClassDetailLike | null,
  previousLevel: number,
  nextLevel: number,
  selectedSubclass?: string | null,
): SlotLevelTriggeredSpellChoiceDef[] {
  if (!cls || nextLevel <= previousLevel) return [];
  const previousMaxSlotLevel = getMaxSlotLevel(cls, previousLevel, selectedSubclass);
  const nextMaxSlotLevel = getMaxSlotLevel(cls, nextLevel, selectedSubclass);
  if (nextMaxSlotLevel <= previousMaxSlotLevel) return [];

  const seen = new Set<string>();
  const result: SlotLevelTriggeredSpellChoiceDef[] = [];
  for (const feature of featuresUpToLevelForSubclass(cls, nextLevel, selectedSubclass)) {
    const parsed = parseSlotLevelTriggeredChoice(feature, nextMaxSlotLevel, nextLevel);
    if (!parsed || seen.has(parsed.key)) continue;
    seen.add(parsed.key);
    result.push(parsed);
  }
  return result;
}

export function getSlotLevelTriggeredSpellChoicesUpToLevel(
  cls: CreatorClassDetailLike | null,
  level: number,
  selectedSubclass?: string | null,
): SlotLevelTriggeredSpellChoiceDef[] {
  if (!cls || level <= 0) return [];
  const seen = new Set<string>();
  const result: SlotLevelTriggeredSpellChoiceDef[] = [];
  for (let currentLevel = 1; currentLevel <= level; currentLevel += 1) {
    const choices = getSlotLevelTriggeredSpellChoices(
      cls,
      Math.max(0, currentLevel - 1),
      currentLevel,
      selectedSubclass,
    );
    for (const choice of choices) {
      if (seen.has(choice.key)) continue;
      seen.add(choice.key);
      result.push(choice);
    }
  }
  return result;
}
