import {
  featureMatchesSubclass,
  featuresUpToLevelForSubclass,
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

export function tableValueAtLevel(table: [number, number][], level: number): number {
  let result = 0;
  for (const [lvl, val] of table) {
    if (lvl <= level) result = val;
  }
  return result;
}

function getSubclassSpellcasting(cls: CreatorClassDetailLike, selectedSubclass?: string | null) {
  const normalized = normalizeSubclassName(selectedSubclass);
  if (!normalized) return null;
  for (const [id, detail] of Object.entries(cls.subclassDetails ?? {})) {
    const name = typeof detail === "string" ? detail : detail.name;
    if (normalizeSubclassName(id) !== normalized && normalizeSubclassName(name) !== normalized) continue;
    return typeof detail === "string" ? null : (detail.spellcasting ?? null);
  }
  return null;
}

function subclassProgressionAtLevel(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null) {
  return [...(getSubclassSpellcasting(cls, selectedSubclass)?.progression ?? [])]
    .filter((row) => row.level <= level)
    .sort((a, b) => b.level - a.level);
}

function latestProgressionValue<T>(
  rows: Array<{ level: number; cantrips?: number; prepared?: number; slots?: number[] }>,
  select: (row: { level: number; cantrips?: number; prepared?: number; slots?: number[] }) => T | undefined,
): T | undefined {
  for (const row of rows) {
    const value = select(row);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function getSpellcastingClassName(cls: CreatorClassDetailLike | null, _level: number, selectedSubclass?: string | null): string | null {
  if (!cls) return null;
  const subclassSpellcasting = getSubclassSpellcasting(cls, selectedSubclass);
  if (subclassSpellcasting) return cls.spellLists?.[subclassSpellcasting.list] ?? null;
  return cls.spellcastingList ? (cls.spellLists?.[cls.spellcastingList] ?? cls.spellcastingList) : null;
}

export function getCantripCount(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number {
  const slotCount = getSlotsAtLevel(cls, level)?.[0] ?? 0;
  if (slotCount > 0) return slotCount;
  const structured = latestProgressionValue(subclassProgressionAtLevel(cls, level, selectedSubclass), (row) => row.cantrips);
  if (structured !== undefined) return structured;
  return 0;
}

export function getSpellSlotsAtLevel(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number[] | null {
  const classSlots = getSlotsAtLevel(cls, level);
  if (classSlots) return classSlots;
  const slots = latestProgressionValue(subclassProgressionAtLevel(cls, level, selectedSubclass), (row) => row.slots);
  if (!slots) return null;
  return [getCantripCount(cls, level, selectedSubclass), ...slots];
}

export function getMaxSlotLevel(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number {
  const slots = getSpellSlotsAtLevel(cls, level, selectedSubclass);
  if (slots) {
    for (let i = slots.length - 1; i >= 1; i--) {
      if (slots[i] > 0) return i;
    }
  }
  return 0;
}

export function getPreparedSpellCount(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null, spellcastingAbilityScore?: number | null): number {
  const structured = latestProgressionValue(subclassProgressionAtLevel(cls, level, selectedSubclass), (row) => row.prepared);
  if (structured !== undefined) return structured;
  const classProgression = [...cls.autolevels]
    .filter((row) => row.level <= level && row.spellsPrepared != null)
    .sort((a, b) => b.level - a.level)[0]?.spellsPrepared;
  if (classProgression != null) return classProgression;
  if (cls.preparedSpellFormula) {
    const divisor = cls.preparedSpellFormula.classLevelDivisor ?? 1;
    const quotient = level / divisor;
    const classContribution = cls.preparedSpellFormula.rounding === "up" ? Math.ceil(quotient) : Math.floor(quotient);
    const abilityModifier = Math.floor(((spellcastingAbilityScore ?? 10) - 10) / 2);
    return Math.max(cls.preparedSpellFormula.minimum ?? 1, classContribution + abilityModifier);
  }
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
  return 0;
}

export function isSpellcaster(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): boolean {
  return getCantripCount(cls, level, selectedSubclass) > 0 || getMaxSlotLevel(cls, level, selectedSubclass) > 0 || getPreparedSpellCount(cls, level, selectedSubclass) > 0;
}

export function usesFlexiblePreparedSpells(cls: CreatorClassDetailLike | null): boolean {
  return Boolean(cls?.preparedSpellChanges);
}

export function getClassFeatureTable(cls: CreatorClassDetailLike, keyword: string, level: number, selectedSubclass?: string | null): [number, number][] {
  for (const al of getMergedAutolevels(cls)) {
    if (al.level == null || al.level > level) continue;
    for (const feature of al.features ?? []) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      if (feature.talent && new RegExp(feature.talent.kind, "i").test(keyword)) {
        return Object.entries(feature.talent.known).map(([requiredLevel, count]) => [Number(requiredLevel), Number(count)] as [number, number]).sort((a, b) => a[0] - b[0]);
      }
    }
  }
  return [];
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
  const choice = feature.choices?.find((entry) => entry.kind === "spell" && entry.perNewSlotLevel === true);
  if (!choice || choice.kind !== "spell") return null;
  const count = choice.count ?? 1;

  return {
    key: `slotgrowth:${feature.level}:${triggerLevel}:${maxSpellLevel}:${normalizeChoiceDefKey(feature.name)}`,
    title: feature.name,
    sourceLabel: feature.name,
    triggerLevel,
    count,
    level: maxSpellLevel > 0 ? maxSpellLevel : null,
    listNames: choice.lists,
    schools: choice.school ? [choice.school] : undefined,
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
