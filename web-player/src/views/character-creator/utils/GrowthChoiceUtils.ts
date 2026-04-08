import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import type { SharedResolvedSpellChoiceEntry } from "@/views/character-creator/utils/SpellChoiceUtils";
import {
  featureMatchesSubclass,
  getFeatureSubclassName,
  isSubclassChoiceFeature,
  normalizeChoiceKey,
  wordOrNumberToInt,
} from "@/views/character-creator/utils/CharacterCreatorUtils";

interface GrowthFeatureLike {
  name: string;
  text: string;
  optional?: boolean;
  subclass?: string | null;
}

interface GrowthAutolevelLike {
  level: number | null;
  features?: GrowthFeatureLike[];
}

interface GrowthClassDetailLike {
  autolevels: GrowthAutolevelLike[];
}

export interface GrowthChoiceAbilityDefinition {
  key: string;
  title: string;
  options: AbilKey[];
}

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

function slugify(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/u, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseOrdinalLevels(raw: string): number[] {
  return Array.from(raw.matchAll(/(\d+)(?:st|nd|rd|th)?/gi))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
}

function parseAbilityChoice(rawText: string, sourceKey: string, title: string): GrowthChoiceAbilityDefinition | null {
  const match = rawText.match(
    /\b(?:dc equals 8 plus|reduce the damage by [^.]+ plus)\s+your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+or\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+modifier\s*\(your choice\)/i
  );
  if (!match) return null;

  const toKey = (value: string): AbilKey => value.trim().toLowerCase().slice(0, 3) as AbilKey;
  const options = [toKey(match[1]), toKey(match[2])].filter((value, index, arr) => arr.indexOf(value) === index);
  return options.length > 1
    ? {
        key: `${sourceKey}:ability`,
        title,
        options,
      }
    : null;
}

function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseMagicItemPlanOptionsFromText(text: string): Array<{ name: string; minLevel: number; category?: string | null; repeatableGroup?: string | null; rarity?: string | null }> {
  const options: Array<{ name: string; minLevel: number; category?: string | null; repeatableGroup?: string | null; rarity?: string | null }> = [];
  const lines = String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let currentMinLevel: number | null = null;
  let inPlanTable = false;

  for (const line of lines) {
    const tableHeaderMatch = line.match(/^Magic Item Plans(?:\s*\(Artificer Level\s*(\d+)\+\))?:?\s*$/i);
    if (tableHeaderMatch) {
      currentMinLevel = Number(tableHeaderMatch[1] ?? 2) || 2;
      inPlanTable = false;
      continue;
    }
    if (currentMinLevel == null) continue;
    if (/^(Attunement|Magic Item Plan)\s*\|\s*(Magic Item Plan|Attunement)$/i.test(line)) {
      inPlanTable = true;
      continue;
    }
    if (!inPlanTable) continue;
    if (!line.includes("|")) {
      currentMinLevel = null;
      inPlanTable = false;
      continue;
    }

    const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      currentMinLevel = null;
      inPlanTable = false;
      continue;
    }
    const rawName = parts[0].toLowerCase() === "yes" || parts[0].toLowerCase() === "no" || parts[0].toLowerCase() === "varies"
      ? parts[1]
      : parts[0];
    const repeatableMatch = /\*|\byou can learn this option multiple times\b|\bmust select a different item each time\b/i.test(rawName);
    const cleanedName = rawName
      .replace(/\s*\([^)]*new Artificer item[^)]*\)\s*/gi, "")
      .replace(/\s*\(you can learn this option multiple times[^)]*\)\s*/gi, "")
      .replace(/\*+\s*$/g, "")
      .trim();
    if (!cleanedName) continue;
    const wondrousMatch = cleanedName.match(/^(Common|Uncommon|Rare)\s+Wondrous Item\b/i);
    options.push({
      name: cleanedName,
      minLevel: currentMinLevel,
      category: /\bArmor\b/i.test(cleanedName) ? "armor" : null,
      repeatableGroup: repeatableMatch ? (wondrousMatch ? "wondrous-item" : "common-magic-item") : null,
      rarity: wondrousMatch ? wondrousMatch[1].trim().toLowerCase() : null,
    });
  }

  return uniqueByName(options);
}

function parseArmorReplicationChoiceDefinition(args: {
  classId: string;
  className: string | null | undefined;
  feature: GrowthFeatureLike;
  selectedSubclass?: string | null;
  featureLevel: number;
  currentLevel: number;
}): GrowthChoiceDefinition | null {
  const { classId, className, feature, selectedSubclass, featureLevel, currentLevel } = args;
  const text = String(feature.text ?? "");
  const sourceLabel = String(feature.name ?? "").trim();
  if (!/\blearn an additional plan\b/i.test(text) || !/\bmust be in the Armor category\b/i.test(text)) return null;

  const subclassKey = slugify(getFeatureSubclassName(feature) ?? selectedSubclass ?? className ?? "class");
  const sourceKey = [
    "class",
    slugify(classId),
    "subclass",
    subclassKey || "class",
    "feature",
    slugify(sourceLabel),
    "plans",
  ].join(":");

  return {
    key: sourceKey,
    sourceKey,
    category: "plan",
    title: "Armor Replication Plan",
    sourceLabel,
    totalCount: currentLevel >= featureLevel ? 1 : 0,
    gainedAtLevel: currentLevel === featureLevel ? 1 : 0,
    replacementSupported: /\breplace that plan\b/i.test(text),
    spellChoice: null,
    itemOptions: [],
    itemCategory: "armor",
    note: /\breplace that plan\b/i.test(text)
      ? "This extra plan must stay in the Armor category if you replace it later."
      : "This extra plan must be in the Armor category.",
  };
}

function parseManeuverChoiceDefinition(args: {
  classId: string;
  className: string | null | undefined;
  feature: GrowthFeatureLike;
  selectedSubclass?: string | null;
  featureLevel: number;
  currentLevel: number;
}): GrowthChoiceDefinition | null {
  const { classId, className, feature, selectedSubclass, featureLevel, currentLevel } = args;
  const text = String(feature.text ?? "");
  const sourceLabel = String(feature.name ?? "").trim();
  if (!/\bManeuvers?\b/i.test(text) || !/\bManeuver Options\b/i.test(text)) return null;

  const initialMatch = text.match(/you learn\s+([A-Za-z0-9-]+)\s+maneuvers?\s+of your choice/i);
  const initialCount = wordOrNumberToInt(initialMatch?.[1] ?? "") ?? 0;
  if (initialCount <= 0) return null;

  const listMatch =
    text.match(/"([^"]+)"\s+section[^.]*?\bspell list\b/i)
    ?? text.match(/\b(?:added as spells in|from)\s+the\s+([A-Za-z' ()+-]+?)\s+spell list\b/i);
  const listName = String(listMatch?.[1] ?? "Maneuver Options").trim();

  const additionalMatch = text.match(
    /you learn\s+([A-Za-z0-9-]+)\s+additional maneuvers?\s+of your choice when you reach [A-Za-z]+\s+levels?\s+([^.]+)/i
  );
  const additionalCount = wordOrNumberToInt(additionalMatch?.[1] ?? "") ?? 0;
  const additionalLevels = additionalMatch ? parseOrdinalLevels(additionalMatch[2] ?? "") : [];

  const totalCount = initialCount + additionalLevels.filter((level) => level <= currentLevel).length * additionalCount;
  const gainedAtLevel =
    (featureLevel <= currentLevel ? initialCount : 0)
    + additionalLevels.filter((level) => level === currentLevel).length * additionalCount;

  const subclassKey = slugify(getFeatureSubclassName(feature) ?? selectedSubclass ?? className ?? "class");
  const sourceKey = [
    "class",
    slugify(classId),
    "subclass",
    subclassKey || "class",
    "feature",
    slugify(sourceLabel),
    "maneuvers",
  ].join(":");

  return {
    key: sourceKey,
    sourceKey,
    category: "maneuver",
    title: "Maneuvers",
    sourceLabel,
    totalCount,
    gainedAtLevel,
    replacementSupported: /\breplace one maneuver you know\b/i.test(text),
    spellChoice: {
      key: sourceKey,
      title: "Maneuvers",
      sourceLabel,
      count: totalCount,
      level: 0,
      note: "Choose maneuvers you know from this feature.",
      linkedTo: null,
      listNames: [listName],
    },
    abilityChoice: parseAbilityChoice(text, sourceKey, "Maneuver Save Ability"),
    note: /\breplace one maneuver you know\b/i.test(text)
      ? "Replacement wording exists here, but this flow currently tracks only newly learned maneuvers."
      : null,
  };
}

function parsePlanChoiceDefinition(args: {
  classId: string;
  className: string | null | undefined;
  feature: GrowthFeatureLike;
  selectedSubclass?: string | null;
  featureLevel: number;
  currentLevel: number;
}): GrowthChoiceDefinition | null {
  const { classId, className, feature, selectedSubclass, featureLevel, currentLevel } = args;
  const text = String(feature.text ?? "");
  const sourceLabel = String(feature.name ?? "").trim();
  if (!/\bPlans Known\.\s*When you gain this feature, choose\b/i.test(text) || !/\bMagic Item Plans\b/i.test(text)) return null;

  const initialMatch = text.match(/Plans Known\.\s*When you gain this feature, choose\s+([A-Za-z0-9-]+)\s+plans?\s+to learn/i);
  const initialCount = wordOrNumberToInt(initialMatch?.[1] ?? "") ?? 0;
  if (initialCount <= 0) return null;

  const additionalMatch = text.match(/You learn another plan of your choice when you reach certain [A-Za-z]+\s+levels?\s*\(([^)]+)\)/i);
  const additionalLevels = additionalMatch ? parseOrdinalLevels(additionalMatch[1] ?? "") : [];
  const totalCount = initialCount + additionalLevels.filter((level) => level <= currentLevel).length;
  const gainedAtLevel =
    (featureLevel <= currentLevel ? initialCount : 0)
    + additionalLevels.filter((level) => level === currentLevel).length;

  const subclassKey = slugify(getFeatureSubclassName(feature) ?? selectedSubclass ?? className ?? "class");
  const sourceKey = [
    "class",
    slugify(classId),
    "subclass",
    subclassKey || "class",
    "feature",
    slugify(sourceLabel),
    "plans",
  ].join(":");

  return {
    key: sourceKey,
    sourceKey,
    category: "plan",
    title: "Magic Item Plans",
    sourceLabel,
    totalCount,
    gainedAtLevel,
    replacementSupported: /\breplace one of the plans you know\b/i.test(text),
    spellChoice: null,
    itemOptions: parseMagicItemPlanOptionsFromText(text),
    note: /\breplace one of the plans you know\b/i.test(text)
      ? "Replacement wording exists here, but this flow currently tracks known plans rather than swap history."
      : null,
  };
}

export function getGrowthChoiceDefinitions(args: {
  classId: string;
  className?: string | null;
  classDetail: GrowthClassDetailLike | null;
  level: number;
  selectedSubclass?: string | null;
}): GrowthChoiceDefinition[] {
  const { classId, className, classDetail, level, selectedSubclass } = args;
  if (!classDetail || !classId) return [];

  const definitions: GrowthChoiceDefinition[] = [];
  const allPlanOptions: Array<{ name: string; minLevel: number; category?: string | null; repeatableGroup?: string | null; rarity?: string | null }> = [];
  for (const autolevel of classDetail.autolevels ?? []) {
    if (autolevel.level == null || autolevel.level > level) continue;
    for (const feature of autolevel.features ?? []) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      const isSubclassFeature = Boolean(getFeatureSubclassName(feature));
      if (feature.optional && !isSubclassFeature) continue;
      if (/\bMagic Item Plans\b/i.test(String(feature.text ?? ""))) {
        allPlanOptions.push(...parseMagicItemPlanOptionsFromText(String(feature.text ?? "")));
      }
      const maneuverDefinition = parseManeuverChoiceDefinition({
        classId,
        className,
        feature,
        selectedSubclass,
        featureLevel: autolevel.level,
        currentLevel: level,
      });
      if (maneuverDefinition) definitions.push(maneuverDefinition);
      const planDefinition = parsePlanChoiceDefinition({
        classId,
        className,
        feature,
        selectedSubclass,
        featureLevel: autolevel.level,
        currentLevel: level,
      });
      if (planDefinition) definitions.push(planDefinition);
      const armorReplicationDefinition = parseArmorReplicationChoiceDefinition({
        classId,
        className,
        feature,
        selectedSubclass,
        featureLevel: autolevel.level,
        currentLevel: level,
      });
      if (armorReplicationDefinition) definitions.push(armorReplicationDefinition);
    }
  }

  if (allPlanOptions.length > 0) {
    definitions.forEach((definition) => {
      if (definition.category !== "plan") return;
      definition.itemOptions = uniqueByName([...(definition.itemOptions ?? []), ...allPlanOptions]);
    });
  }

  return definitions;
}

export function getGrowthChoiceSelectedIds(
  selections: Record<string, string[]> | null | undefined,
  definition: GrowthChoiceDefinition,
): string[] {
  return Array.isArray(selections?.[definition.key]) ? selections?.[definition.key] ?? [] : [];
}

export function getGrowthChoiceSelectedAbility(
  selections: Record<string, string[]> | null | undefined,
  definition: GrowthChoiceDefinition,
): AbilKey | null {
  if (!definition.abilityChoice) return null;
  const selected = selections?.[definition.abilityChoice.key] ?? [];
  return selected.length > 0 ? selected[0] as AbilKey : null;
}

export function sanitizeGrowthChoiceSelections(args: {
  definitions: GrowthChoiceDefinition[];
  currentSelections: Record<string, string[]>;
  optionEntriesByKey: Record<string, Array<{ id: string; name: string }>>;
}): Record<string, string[]> {
  const { definitions, currentSelections, optionEntriesByKey } = args;
  const next = { ...currentSelections };
  const validKeys = new Set<string>();

  for (const definition of definitions) {
    validKeys.add(definition.key);
    const options = optionEntriesByKey[definition.key] ?? [];
    const validIds = new Set(options.map((entry) => String(entry.id)));
    const validNames = new Set(options.map((entry) => entry.name.trim().toLowerCase()));
    const filtered = (next[definition.key] ?? [])
      .filter((value) => validIds.has(String(value)) || validNames.has(String(value).trim().toLowerCase()))
      .slice(0, definition.totalCount);
    if (filtered.length > 0) next[definition.key] = filtered;
    else delete next[definition.key];

    if (definition.abilityChoice) {
      validKeys.add(definition.abilityChoice.key);
      const selectedAbility = (next[definition.abilityChoice.key] ?? []).filter((value) =>
        definition.abilityChoice?.options.includes(String(value) as AbilKey)
      ).slice(0, 1);
      if (selectedAbility.length > 0) next[definition.abilityChoice.key] = selectedAbility;
      else delete next[definition.abilityChoice.key];
    }
  }

  for (const key of Object.keys(next)) {
    if (!validKeys.has(key) && (key.includes(":maneuvers") || key.includes(":plans"))) delete next[key];
  }

  return next;
}

export interface GrowthChoiceItemSummaryLike {
  id: string;
  name: string;
  rarity?: string | null;
  type?: string | null;
  typeKey?: string | null;
  magic?: boolean;
  attunement?: boolean;
}

function matchesNamedItemOption(itemName: string, optionName: string): boolean {
  return normalizeChoiceKey(itemName) === normalizeChoiceKey(optionName)
    || normalizeChoiceKey(itemName.replace(/\s*\([^)]*\)\s*$/u, "")) === normalizeChoiceKey(optionName);
}

export function buildGrowthChoiceItemOptions(
  definition: GrowthChoiceDefinition,
  items: GrowthChoiceItemSummaryLike[],
): Array<{ id: string; name: string; rarity?: string | null; type?: string | null; typeKey?: string | null; magic?: boolean; attunement?: boolean }> {
  if (definition.category !== "plan") return [];

  const resolved: Array<{ id: string; name: string; rarity?: string | null; type?: string | null; typeKey?: string | null; magic?: boolean; attunement?: boolean }> = [];
  const matchesDefinitionCategory = (item: GrowthChoiceItemSummaryLike) => {
    if (!definition.itemCategory) return true;
    const haystack = `${item.type ?? ""} ${item.typeKey ?? ""}`.toLowerCase();
    return haystack.includes(definition.itemCategory.toLowerCase());
  };
  for (const option of definition.itemOptions ?? []) {
    if (option.repeatableGroup === "common-magic-item") {
      items
        .filter((item) =>
          matchesDefinitionCategory(item)
          && String(item.rarity ?? "").trim().toLowerCase() === "common"
          && Boolean(item.magic)
          && !/\bpotion\b/i.test(String(item.type ?? ""))
          && !/\bscroll\b/i.test(String(item.type ?? ""))
        )
        .forEach((item) => resolved.push({
          id: String(item.id),
          name: item.name,
          rarity: item.rarity ?? null,
          type: item.type ?? null,
          typeKey: item.typeKey ?? null,
          magic: item.magic,
          attunement: item.attunement,
        }));
      continue;
    }
    if (option.repeatableGroup === "wondrous-item") {
      items
        .filter((item) =>
          matchesDefinitionCategory(item)
          && String(item.rarity ?? "").trim().toLowerCase() === String(option.rarity ?? "").trim().toLowerCase()
          && Boolean(item.magic)
          && /\bwondrous\b/i.test(`${item.type ?? ""} ${item.typeKey ?? ""}`)
        )
        .forEach((item) => resolved.push({
          id: String(item.id),
          name: item.name,
          rarity: item.rarity ?? null,
          type: item.type ?? null,
          typeKey: item.typeKey ?? null,
          magic: item.magic,
          attunement: item.attunement,
        }));
      continue;
    }
    items
      .filter((item) => matchesDefinitionCategory(item) && matchesNamedItemOption(item.name, option.name))
      .forEach((item) => resolved.push({
        id: String(item.id),
        name: item.name,
        rarity: item.rarity ?? null,
        type: item.type ?? null,
        typeKey: item.typeKey ?? null,
        magic: item.magic,
        attunement: item.attunement,
      }));
  }

  return uniqueByName(resolved).sort((a, b) => a.name.localeCompare(b.name));
}
