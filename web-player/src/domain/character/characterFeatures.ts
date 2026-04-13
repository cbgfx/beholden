import type { FeatureSourceKind } from "@/domain/character/featureEffects";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { CharacterData, ClassFeatureEntry } from "@/views/character/CharacterSheetTypes";
import {
  featureMatchesSubclass,
  getFeatureSubclassName,
  isSubclassChoiceFeature,
} from "@/views/character-creator/utils/CharacterCreatorUtils";

export interface CharacterFeatureLike {
  name: string;
  text?: string | null;
  optional?: boolean;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
  subclass?: string | null;
}

export interface CharacterAutolevelLike {
  level: number | null;
  features?: CharacterFeatureLike[];
}

export interface CharacterClassDetailLike {
  id: string;
  autolevels: CharacterAutolevelLike[];
}

export interface CharacterTraitLike {
  name: string;
  text: string;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

export interface CharacterRaceDetailLike {
  id: string;
  traits: CharacterTraitLike[];
}

export interface CharacterBackgroundDetailLike {
  id: string;
  traits: CharacterTraitLike[];
}

export interface CharacterFeatDetailLike {
  id?: string;
  name: string;
  text?: string | null;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

export interface CharacterLevelUpFeatDetailLike {
  level: number;
  featId: string;
  feat: CharacterFeatDetailLike;
}

export interface CharacterInvocationDetailLike {
  id: string;
  name: string;
  text: string;
}

export interface AppliedCharacterFeatureEntry extends ClassFeatureEntry {
  kind: FeatureSourceKind;
}

export interface ProgressionGrantedSpellEntry {
  key: string;
  spellName: string;
  sourceName: string;
  note: string;
}

export interface PreparedSpellProgressionChoiceDefinition {
  key: string;
  featureId: string;
  sourceName: string;
  prompt: string;
  options: string[];
}

function splitProgressionChoiceOptions(text: string): string[] {
  return String(text ?? "")
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeProgressionChoiceToken(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\b(?:land|terrain|type|table|spells?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferPreparedSpellProgressionChoiceMetadata(
  text: string | null | undefined,
  tables: PreparedSpellProgressionTable[],
): PreparedSpellProgressionTable[] {
  if (tables.length <= 1) return tables;
  if (tables.some((table) => table.choiceGroupKey && table.choiceOptionLabel)) return tables;

  const match = String(text ?? "").match(/choose one ([^:]+):\s*([^.]+?)\.\s*consult the table below that corresponds to the chosen/i);
  if (!match) return tables;

  const promptTarget = String(match[1] ?? "").trim();
  const options = splitProgressionChoiceOptions(match[2] ?? "");
  if (options.length <= 1) return tables;
  const choiceGroupKey = normalizeProgressionChoiceToken(promptTarget).replace(/\s+/g, "-") || "progression-choice";

  return tables.map((table) => {
    const matchedOption = options.find((option) => {
      const normalizedOption = normalizeProgressionChoiceToken(option);
      const normalizedLabel = normalizeProgressionChoiceToken(table.label ?? "");
      return normalizedOption && normalizedLabel && (
        normalizedOption === normalizedLabel
        || normalizedLabel.startsWith(normalizedOption)
        || normalizedOption.startsWith(normalizedLabel)
      );
    });
    if (!matchedOption) return table;
    return {
      ...table,
      choiceGroupKey,
      choicePrompt: `Choose one ${promptTarget}`,
      choiceOptionLabel: matchedOption,
      choiceOptions: options,
    };
  });
}

interface BuildAppliedCharacterFeaturesArgs {
  charData: CharacterData | null | undefined;
  characterLevel: number;
  classDetail: CharacterClassDetailLike | null;
  raceDetail: CharacterRaceDetailLike | null;
  backgroundDetail: CharacterBackgroundDetailLike | null;
  bgOriginFeatDetail: CharacterFeatDetailLike | null;
  raceFeatDetail: CharacterFeatDetailLike | null;
  classFeatDetails?: CharacterFeatDetailLike[];
  levelUpFeatDetails: CharacterLevelUpFeatDetailLike[];
  invocationDetails: CharacterInvocationDetailLike[];
}

interface BuildDisplayPlayerFeaturesArgs extends BuildAppliedCharacterFeaturesArgs {}

function cleanedText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function shouldSkipBackgroundTrait(name: string): boolean {
  return (
    /^description$/i.test(name)
    || /^ability scores?/i.test(name)
    || /^starting equipment$/i.test(name)
    || /^feat:/i.test(name)
  );
}

export function shouldDisplayPlayerFeature(name: string, text: string): boolean {
  const normalizedName = String(name ?? "").trim();
  const normalizedText = String(text ?? "").trim();
  const haystack = `${normalizedName} ${normalizedText}`;
  if (!normalizedName && !normalizedText) return false;

  if (
    /^(description|creature type|size|speed|tool proficiency|tool proficiencies|skill proficiency|skill proficiencies|languages?|starting equipment)$/i.test(normalizedName)
    || /^ability scores?/i.test(normalizedName)
    || /^feat:/i.test(normalizedName)
    || /^(level\s+\d+:\s+)?weapon mastery$/i.test(normalizedName)
  ) {
    return false;
  }

  if (
    /^(resourceful|trance|fey ancestry|brave|hellish resistance|necrotic resistance|fire resistance|cold resistance|lightning resistance|poison resilience|dwarven resilience|gnomish cunning|lucky|relentless endurance|powerful build|celestial revelation|draconic flight|arcane recovery)$/i.test(normalizedName)
  ) {
    return true;
  }

  if (
    /\byou can cast .+ only as rituals?\b/i.test(normalizedText)
    || /\bonly as rituals?\b/i.test(haystack)
  ) {
    return true;
  }

  if (
    /^(darkvision|superior darkvision|blindsight|tremorsense|truesight)$/i.test(normalizedName)
    || /\byou have (darkvision|blindsight|tremorsense|truesight)\b/i.test(normalizedText)
  ) {
    return false;
  }

  if (
    /\b(darkvision|blindsight|tremorsense|truesight|short rest|long rest|regain|recover|heroic inspiration|advantage on saving throws|immune to the charmed|magic can't put you to sleep|resistance to|you have resistance to|damage resistance|can't be (?:put to sleep|surprised)|reroll|once per turn|once per combat|once per (?:short|long) rest)\b/i.test(haystack)
  ) {
    return true;
  }

  if (
    /^(high elf lineage|wood elf lineage|drow lineage|forest lineage|celestial lineage|draconic ancestry|creature type|size|tool proficiency|tool proficiencies|skill proficiency|skill proficiencies|instrument training|artisan'?s tools|weapon training|armor training)$/i.test(normalizedName)
  ) {
    return false;
  }

  if (
    /\b(creature type|you are a .*?(humanoid|celestial|fey|fiend|undead|construct|beast|dragon|elemental|giant|monstrosity|ooze|plant))\b/i.test(normalizedText)
    || /\b(you have proficiency|you gain proficiency|you gain training|you have training|you know the .* cantrip|you always have .* prepared|you can cast .* without a spell slot|you learn the .* cantrip|you gain one skill proficiency|you gain one tool proficiency)\b/i.test(normalizedText)
  ) {
    return false;
  }

  return /(?:advantage|disadvantage|resistance|immunity|vision|rest|recover|regain|heroic inspiration|sleep|charmed|frightened|poisoned|reroll|movement|speed|climb speed|swim speed|fly speed)/i.test(haystack);
}

export function buildAppliedCharacterFeatures(args: BuildAppliedCharacterFeaturesArgs): AppliedCharacterFeatureEntry[] {
  const {
    charData,
    characterLevel,
    classDetail,
    raceDetail,
    backgroundDetail,
    bgOriginFeatDetail,
    raceFeatDetail,
    classFeatDetails = [],
    levelUpFeatDetails,
    invocationDetails,
  } = args;

  const selectedSubclass = String(charData?.classes?.[0]?.subclass ?? "").trim();
  const chosenOptionals = new Set(charData?.chosenOptionals ?? []);
  const byId = new Map<string, AppliedCharacterFeatureEntry>();
  const dedupeKeys = new Set<string>();

  const addFeature = (feature: AppliedCharacterFeatureEntry | null | undefined) => {
    if (!feature) return;
    const name = String(feature.name ?? "").trim();
    const text = cleanedText(feature.text);
    if (!name || !text) return;
    const dedupeKey = `${feature.kind}:${name.toLowerCase()}::${text.replace(/\s+/g, " ").toLowerCase()}`;
    if (byId.has(feature.id) || dedupeKeys.has(dedupeKey)) return;
    byId.set(feature.id, { ...feature, name, text });
    dedupeKeys.add(dedupeKey);
  };

  for (const autolevel of classDetail?.autolevels ?? []) {
    if (autolevel.level == null || autolevel.level > characterLevel) continue;
    for (const feature of autolevel.features ?? []) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      const name = String(feature.name ?? "").trim();
      const text = cleanedText(feature.text);
      if (!name || !text) continue;
      const isSubclassFeature = Boolean(getFeatureSubclassName(feature));
      if (feature.optional && !isSubclassFeature && !chosenOptionals.has(name)) continue;
      addFeature({
        id: `class:${classDetail?.id}:${name}`,
        kind: "class",
        name,
        text,
        preparedSpellProgression: feature.preparedSpellProgression,
      });
    }
  }

  for (const trait of raceDetail?.traits ?? []) {
    addFeature({
      id: `race:${raceDetail?.id}:${trait.name}`,
      kind: "species",
      name: trait.name,
      text: trait.text,
      preparedSpellProgression: trait.preparedSpellProgression,
    });
  }

  if (raceFeatDetail && cleanedText(raceFeatDetail.text)) {
    addFeature({
      id: `race-feat:${raceFeatDetail.id}`,
      kind: "feat",
      name: raceFeatDetail.name,
      text: cleanedText(raceFeatDetail.text),
      preparedSpellProgression: raceFeatDetail.preparedSpellProgression,
    });
  }

  for (const trait of backgroundDetail?.traits ?? []) {
    const name = String(trait.name ?? "").trim();
    if (!name || shouldSkipBackgroundTrait(name)) continue;
    addFeature({
      id: `background:${backgroundDetail?.id}:${name}`,
      kind: "background",
      name,
      text: trait.text,
      preparedSpellProgression: trait.preparedSpellProgression,
    });
  }

  if (bgOriginFeatDetail && cleanedText(bgOriginFeatDetail.text)) {
    addFeature({
      id: `bg-feat:${bgOriginFeatDetail.id}`,
      kind: "feat",
      name: bgOriginFeatDetail.name,
      text: cleanedText(bgOriginFeatDetail.text),
      preparedSpellProgression: bgOriginFeatDetail.preparedSpellProgression,
    });
  }

  for (const feat of classFeatDetails) {
    if (!cleanedText(feat.text)) continue;
    addFeature({
      id: `class-feat:${feat.id}`,
      kind: "feat",
      name: feat.name,
      text: cleanedText(feat.text),
      preparedSpellProgression: feat.preparedSpellProgression,
    });
  }

  for (const entry of levelUpFeatDetails) {
    if (!cleanedText(entry.feat.text)) continue;
    addFeature({
      id: `levelupfeat:${entry.level}:${entry.featId}`,
      kind: "feat",
      name: entry.feat.name,
      text: cleanedText(entry.feat.text),
      preparedSpellProgression: entry.feat.preparedSpellProgression,
    });
  }

  for (const invocation of invocationDetails) {
    addFeature({
      id: `invocation:${invocation.id}`,
      kind: "invocation",
      name: String(invocation.name ?? "").replace(/^Invocation:\s*/i, "").trim(),
      text: invocation.text,
    });
  }

  return Array.from(byId.values());
}

export function buildDisplayPlayerFeatures(args: BuildDisplayPlayerFeaturesArgs): ClassFeatureEntry[] {
  return buildAppliedCharacterFeatures(args)
    .filter((feature) =>
      feature.kind === "class"
      || feature.kind === "invocation"
      || feature.preparedSpellProgression?.length
      || shouldDisplayPlayerFeature(feature.name, feature.text ?? "")
    )
    .map(({ id, name, text, preparedSpellProgression }) => ({
      id,
      name,
      text,
      preparedSpellProgression,
    }));
}

export function buildPreparedSpellProgressionGrants(
  features: Array<Pick<AppliedCharacterFeatureEntry, "id" | "name" | "text" | "preparedSpellProgression">>,
  characterLevel: number,
  chosenFeatureChoices: Record<string, string[]> | null | undefined = {},
): ProgressionGrantedSpellEntry[] {
  const grants = new Map<string, ProgressionGrantedSpellEntry>();

  for (const feature of features) {
    const tables = inferPreparedSpellProgressionChoiceMetadata(feature.text, feature.preparedSpellProgression ?? []);
    const groupedTables = tables.filter((table) => table.choiceGroupKey && table.choiceOptionLabel);
    const tablesToApply = (() => {
      if (tables.length === 1) return tables;
      if (groupedTables.length === 0) return [];

      const groups = new Map<string, PreparedSpellProgressionTable[]>();
      for (const table of groupedTables) {
        const groupKey = String(table.choiceGroupKey);
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey)!.push(table);
      }

      return Array.from(groups.entries()).flatMap(([groupKey, groupTables]) => {
        const selectionKey = `${feature.id}:prepared-spell-progression:${groupKey}`;
        const selected = chosenFeatureChoices?.[selectionKey]?.[0];
        if (!selected) return [];
        const normalizedSelection = selected.trim().toLowerCase();
        const matched = groupTables.find((table) => String(table.choiceOptionLabel ?? "").trim().toLowerCase() === normalizedSelection);
        return matched ? [matched] : [];
      });
    })();

    for (const table of tablesToApply) {
      for (const row of table.rows ?? []) {
        if (row.level > characterLevel) continue;
        for (const spellName of row.spells ?? []) {
          // Reject table-row data misidentified as spell names (e.g. "1/4 | No")
          if (/[|]/.test(spellName) || /^[\d/]+$/.test(spellName.trim()) || /^(yes|no)$/i.test(spellName.trim())) continue;
          const normalized = spellName.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!normalized) continue;
          if (grants.has(normalized)) continue;
          grants.set(normalized, {
            key: `progression:${feature.id}:${normalized}`,
            spellName,
            sourceName: feature.name,
            note: "Always prepared.",
          });
        }
      }
    }
  }

  return Array.from(grants.values());
}

export function buildPreparedSpellProgressionChoiceDefinitions(
  features: Array<Pick<AppliedCharacterFeatureEntry, "id" | "name" | "text" | "preparedSpellProgression">>,
): PreparedSpellProgressionChoiceDefinition[] {
  const definitions: PreparedSpellProgressionChoiceDefinition[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const tablesWithMetadata = inferPreparedSpellProgressionChoiceMetadata(feature.text, feature.preparedSpellProgression ?? []);
    const groups = new Map<string, PreparedSpellProgressionTable[]>();
    for (const table of tablesWithMetadata) {
      if (!table.choiceGroupKey || !table.choiceOptionLabel) continue;
      const groupKey = String(table.choiceGroupKey);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(table);
    }

    for (const [groupKey, tables] of groups) {
      const options = Array.from(new Set(
        tables
          .flatMap((table) => table.choiceOptions?.length ? table.choiceOptions : [table.choiceOptionLabel ?? ""])
          .map((option) => String(option ?? "").trim())
          .filter(Boolean)
      ));
      if (options.length <= 1) continue;
      const key = `${feature.id}:prepared-spell-progression:${groupKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      definitions.push({
        key,
        featureId: feature.id,
        sourceName: feature.name,
        prompt: tables[0]?.choicePrompt ?? "Choose a progression table",
        options,
      });
    }
  }

  return definitions;
}
