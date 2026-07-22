import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import type { SharedResolvedSpellChoiceEntry } from "@/views/character-creator/utils/SpellChoiceUtils";
import { featureMatchesSubclass, getFeatureSubclassName } from "@/views/character-creator/utils/CharacterCreatorUtils";

interface GrowthFeatureLike {
  id?: string;
  name: string;
  optional?: boolean;
  subclass?: string | null;
  talent?: { kind: "invocation" | "maneuver" | "metamagic"; known: Record<string, number>; replace?: true; ability?: string[] } | null;
}
interface GrowthClassDetailLike { autolevels: Array<{ level: number | null; features?: GrowthFeatureLike[] }> }

interface GrowthChoiceAbilityDefinition { key: string; title: string; options: AbilKey[] }
export interface GrowthChoiceDefinition {
  key: string;
  sourceKey: string;
  category: "maneuver" | "plan";
  title: string;
  sourceLabel: string;
  totalCount: number;
  gainedAtLevel: number;
  replacementSupported: boolean;
  spellChoice?: SharedResolvedSpellChoiceEntry | null;
  itemOptions?: Array<{ name: string; minLevel: number; category?: string | null; repeatableGroup?: string | null; rarity?: string | null }> | null;
  itemCategory?: string | null;
  abilityChoice?: GrowthChoiceAbilityDefinition | null;
  note?: string | null;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Class growth choices are projected from typed feature.talent facts only. */
export function getGrowthChoiceDefinitions(args: {
  classId: string;
  className?: string | null;
  classDetail: GrowthClassDetailLike | null;
  level: number;
  selectedSubclass?: string | null;
}): GrowthChoiceDefinition[] {
  const { classId, classDetail, level, selectedSubclass } = args;
  if (!classDetail || !classId) return [];
  const definitions: GrowthChoiceDefinition[] = [];
  for (const row of classDetail.autolevels) {
    if (row.level == null || row.level > level) continue;
    for (const feature of row.features ?? []) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || feature.optional) continue;
      const talent = feature.talent;
      if (talent?.kind !== "maneuver") continue;
      const progression = Object.entries(talent.known)
        .map(([requiredLevel, count]) => [Number(requiredLevel), Number(count)] as const)
        .filter(([requiredLevel, count]) => Number.isInteger(requiredLevel) && Number.isInteger(count))
        .sort((a, b) => a[0] - b[0]);
      const totalCount = progression.filter(([requiredLevel]) => requiredLevel <= level).at(-1)?.[1] ?? 0;
      if (totalCount <= 0) continue;
      const previousCount = progression.filter(([requiredLevel]) => requiredLevel < level).at(-1)?.[1] ?? 0;
      const subclassKey = slugify(getFeatureSubclassName(feature) ?? selectedSubclass ?? args.className ?? "class");
      const sourceKey = `class:${slugify(classId)}:subclass:${subclassKey || "class"}:feature:${slugify(feature.name)}:maneuvers`;
      definitions.push({
        key: sourceKey,
        sourceKey,
        category: "maneuver",
        title: "Maneuvers",
        sourceLabel: feature.name,
        totalCount,
        gainedAtLevel: Math.max(0, totalCount - previousCount),
        replacementSupported: talent.replace === true,
        spellChoice: {
          key: sourceKey,
          title: "Maneuvers",
          sourceLabel: feature.name,
          count: totalCount,
          level: 0,
          note: "Choose maneuvers you know from this feature.",
          linkedTo: null,
          listNames: [],
          talentKind: "maneuver",
        },
        abilityChoice: talent.ability?.length
          ? { key: `${sourceKey}:ability`, title: "Maneuver Save Ability", options: talent.ability as AbilKey[] }
          : null,
      });
    }
  }
  return definitions;
}

export function getGrowthChoiceSelectedIds(selections: Record<string, string[]> | null | undefined, definition: GrowthChoiceDefinition): string[] {
  return Array.isArray(selections?.[definition.key]) ? selections?.[definition.key] ?? [] : [];
}

export function getGrowthChoiceSelectedAbility(selections: Record<string, string[]> | null | undefined, definition: GrowthChoiceDefinition): AbilKey | null {
  if (!definition.abilityChoice) return null;
  return (selections?.[definition.abilityChoice.key]?.[0] as AbilKey | undefined) ?? null;
}

export function sanitizeGrowthChoiceSelections(args: {
  definitions: GrowthChoiceDefinition[];
  currentSelections: Record<string, string[]>;
  optionEntriesByKey: Record<string, Array<{ id: string; name: string }>>;
}): Record<string, string[]> {
  const next = { ...args.currentSelections };
  const validKeys = new Set<string>();
  for (const definition of args.definitions) {
    validKeys.add(definition.key);
    const options = args.optionEntriesByKey[definition.key] ?? [];
    const validIds = new Set(options.map((entry) => String(entry.id)));
    const selected = (next[definition.key] ?? []).filter((value) => validIds.has(String(value))).slice(0, definition.totalCount);
    if (selected.length) next[definition.key] = selected; else delete next[definition.key];
    if (definition.abilityChoice) {
      validKeys.add(definition.abilityChoice.key);
      const ability = (next[definition.abilityChoice.key] ?? []).filter((value) => definition.abilityChoice?.options.includes(value as AbilKey)).slice(0, 1);
      if (ability.length) next[definition.abilityChoice.key] = ability; else delete next[definition.abilityChoice.key];
    }
  }
  for (const key of Object.keys(next)) if (!validKeys.has(key) && (key.includes(":maneuvers") || key.includes(":plans"))) delete next[key];
  return next;
}

export type { GrowthChoiceItemSummaryLike } from "./GrowthChoiceItemUtils";
export { buildGrowthChoiceItemOptions } from "./GrowthChoiceItemUtils";
