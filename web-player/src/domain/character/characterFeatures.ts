import type { FeatureSourceKind } from "@/domain/character/featureEffects";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { StructuredFeatMechanicsLike } from "@/domain/character/structuredFeatureEffects";
import type { CharacterData, ClassFeatureEntry } from "@/views/character/CharacterSheetTypes";
import { normalizeAbilityKey } from "@/views/character/CharacterSheetUtils";
import {
  featureMatchesSubclass,
  getFeatureSubclassName,
  isSubclassChoiceFeature,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import type { CreatorFeatureLike } from "@/views/character-creator/utils/CharacterCreatorClassCoreUtils";

interface CharacterFeatureLike {
  name: string;
  text?: string | null;
  optional?: boolean;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
  effects?: unknown[];
  choices?: CreatorFeatureLike["choices"];
  scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>;
  subclass?: string | null;
  resolution?: "automatic" | "manual" | "mixed";
  resolutionNotes?: string[];
}

interface CharacterAutolevelLike {
  level: number | null;
  features?: CharacterFeatureLike[];
}

interface CharacterClassDetailLike {
  id: string;
  spellAbility?: string | null;
  autolevels: CharacterAutolevelLike[];
}

interface CharacterClassFeatureSelectionLike {
  entry: { id: string; level: number; subclass?: string | null };
  detail: CharacterClassDetailLike;
}

interface CharacterTraitLike {
  name: string;
  text: string;
  scalingRolls?: Array<{ description: string | null; level: number | null; formula: string }>;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
  /** Verbatim FeatureEffect-shaped facts from the compendium's own `effects` field — consumed directly, no parsing. */
  effects?: unknown[];
  resolution?: "automatic" | "manual" | "mixed";
  resolutionNotes?: string[];
}

interface CharacterRaceDetailLike {
  id: string;
  spellAbility?: string | null;
  traits: CharacterTraitLike[];
}

interface CharacterBackgroundDetailLike {
  id: string;
  traits: CharacterTraitLike[];
}

interface CharacterFeatDetailLike {
  id?: string;
  name: string;
  text?: string | null;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
  parsed?: StructuredFeatMechanicsLike;
}

interface CharacterLevelUpFeatDetailLike {
  level: number;
  featId: string;
  feat: CharacterFeatDetailLike;
}

interface CharacterInvocationDetailLike {
  id: string;
  name: string;
  text: string;
  effects?: unknown[];
}

export interface AppliedCharacterFeatureEntry extends ClassFeatureEntry {
  kind: FeatureSourceKind;
  classEffects?: unknown[];
  classChoices?: unknown[];
  /** Verbatim FeatureEffect-shaped facts from a trait's own `effects` field (species/background traits). */
  traitEffects?: unknown[];
  featMechanics?: StructuredFeatMechanicsLike;
  spellcastingAbility?: "str" | "dex" | "con" | "int" | "wis" | "cha" | null;
  /** Progression rows for class/subclass features advance with this owning class, not total level. */
  progressionLevel?: number;
}

interface BuildAppliedCharacterFeaturesArgs {
  charData: CharacterData | null | undefined;
  characterLevel: number;
  /** Level in the class represented by classDetail; defaults to characterLevel for legacy callers. */
  classLevel?: number;
  classDetail: CharacterClassDetailLike | null;
  classSelections?: CharacterClassFeatureSelectionLike[];
  raceDetail: CharacterRaceDetailLike | null;
  backgroundDetail: CharacterBackgroundDetailLike | null;
  bgOriginFeatDetail: CharacterFeatDetailLike | null;
  raceFeatDetail: CharacterFeatDetailLike | null;
  classFeatDetails?: CharacterFeatDetailLike[];
  levelUpFeatDetails: CharacterLevelUpFeatDetailLike[];
  invocationDetails: CharacterInvocationDetailLike[];
  extraFeatDetails?: CharacterFeatDetailLike[];
}

interface BuildDisplayPlayerFeaturesArgs extends BuildAppliedCharacterFeaturesArgs {}

function cleanedText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeOptionalFeatureToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^level\s+\d+\s*:\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isOptionalFeatureChosen(
  featureName: string,
  selectedRaw: Set<string>,
  selectedNormalized: Set<string>,
): boolean {
  if (selectedRaw.has(featureName)) return true;
  const normalizedFeature = normalizeOptionalFeatureToken(featureName);
  if (!normalizedFeature) return false;
  if (selectedNormalized.has(normalizedFeature)) return true;
  const tail = normalizedFeature.split(/\s+/).slice(-3).join(" ");
  if (tail && selectedNormalized.has(tail)) return true;
  for (const selected of selectedNormalized) {
    if (selected && (normalizedFeature.endsWith(selected) || selected.endsWith(normalizedFeature))) return true;
  }
  return false;
}

function shouldSkipBackgroundTrait(name: string): boolean {
  return (
    /^description$/i.test(name)
    || /^ability scores?/i.test(name)
    || /^starting equipment$/i.test(name)
    || /^feat:/i.test(name)
  );
}

function hasSelectedReplacementClassFeat(charData: CharacterData | null | undefined, featureName: string): boolean {
  const normalizedFeature = normalizeOptionalFeatureToken(featureName);
  if (!normalizedFeature) return false;
  return Object.keys(charData?.chosenClassFeatIds ?? {}).some((selectedFeatureName) => {
    const normalizedSelected = normalizeOptionalFeatureToken(selectedFeatureName);
    return normalizedSelected === normalizedFeature
      || normalizedSelected.endsWith(normalizedFeature)
      || normalizedFeature.endsWith(normalizedSelected);
  });
}

export function buildAppliedCharacterFeatures(args: BuildAppliedCharacterFeaturesArgs): AppliedCharacterFeatureEntry[] {
  const {
    charData,
    characterLevel,
    classLevel = characterLevel,
    classDetail,
    classSelections,
    raceDetail,
    backgroundDetail,
    bgOriginFeatDetail,
    raceFeatDetail,
    classFeatDetails = [],
    levelUpFeatDetails,
    invocationDetails,
  } = args;

  const chosenOptionals = new Set(charData?.chosenOptionals ?? []);
  const chosenOptionalsNormalized = new Set(
    Array.from(chosenOptionals)
      .map((value) => normalizeOptionalFeatureToken(value))
      .filter(Boolean),
  );
  const byId = new Map<string, AppliedCharacterFeatureEntry>();
  const dedupeKeys = new Set<string>();

  const addFeature = (feature: AppliedCharacterFeatureEntry | null | undefined) => {
    if (!feature) return;
    const name = String(feature.name ?? "").trim();
    const text = cleanedText(feature.text);
    if (!name) return;
    const dedupeKey = `${feature.kind}:${name.toLowerCase()}::${text.replace(/\s+/g, " ").toLowerCase()}`;
    if (byId.has(feature.id) || dedupeKeys.has(dedupeKey)) return;
    byId.set(feature.id, {
      ...feature,
      name,
      text,
      // Feats are canonical facts. Their descriptions remain player-facing rules text, never a
      // runtime mechanics input.
    });
    dedupeKeys.add(dedupeKey);
  };

  const selectedClasses = classSelections?.length
    ? classSelections
    : classDetail
      ? [{ entry: { id: String(charData?.classes?.[0]?.id ?? classDetail.id), level: classLevel, subclass: charData?.classes?.[0]?.subclass }, detail: classDetail }]
      : [];
  let unarmoredDefenseClaimed = false;
  let bestExtraAttack: { rank: number; feature: AppliedCharacterFeatureEntry } | null = null;
  for (const selection of selectedClasses) {
    const selectedSubclass = String(selection.entry.subclass ?? "").trim();
    for (const autolevel of selection.detail.autolevels ?? []) {
      if (autolevel.level == null || autolevel.level > selection.entry.level) continue;
      for (const feature of autolevel.features ?? []) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      const name = String(feature.name ?? "").trim();
      const text = cleanedText(feature.text);
      if (!name || !text) continue;
      const isSubclassFeature = Boolean(getFeatureSubclassName(feature));
      if (feature.optional && !isSubclassFeature && !isOptionalFeatureChosen(name, chosenOptionals, chosenOptionalsNormalized)) continue;
      if (/^unarmored defense$/i.test(name)) {
        if (unarmoredDefenseClaimed) continue;
        unarmoredDefenseClaimed = true;
      }
      const appliedFeature: AppliedCharacterFeatureEntry = {
        id: `class:${selection.entry.id}:${selection.detail.id}:${name}`,
        kind: "class",
        name,
        text,
        preparedSpellProgression: feature.preparedSpellProgression,
        scalingRolls: feature.scalingRolls,
        classEffects: feature.effects,
        classChoices: feature.choices,
        spellcastingAbility: normalizeAbilityKey(selection.detail.spellAbility),
        progressionLevel: selection.entry.level,
        resolution: feature.resolution,
        resolutionNotes: feature.resolutionNotes,
      };
      if (/^extra attack(?:\s|$)/i.test(name)) {
        const numericRank = name.match(/^extra attack\s*\((\d+)\)$/i)?.[1];
        const rank = numericRank ? Number(numericRank) : 1;
        if (!bestExtraAttack || rank > bestExtraAttack.rank) bestExtraAttack = { rank, feature: appliedFeature };
        continue;
      }
      addFeature(appliedFeature);
      }
    }
  }
  addFeature(bestExtraAttack?.feature);

  // A species' spellcasting ability is either a single fixed value (e.g. Aasimar: Cha) or a
  // player choice among several (e.g. elf lineages, tiefling legacies: Int/Wis/Cha) — the choice
  // is a player decision, so it's read from the character's own stored data, not re-derived.
  const raceSpellAbility = normalizeAbilityKey(charData?.chosenRaceSpellAbility) ?? normalizeAbilityKey(raceDetail?.spellAbility);
  for (const trait of raceDetail?.traits ?? []) {
    addFeature({
      id: `race:${raceDetail?.id}:${trait.name}`,
      kind: "species",
      name: trait.name,
      text: trait.text,
      preparedSpellProgression: trait.preparedSpellProgression,
      scalingRolls: trait.scalingRolls,
      traitEffects: trait.effects,
      spellcastingAbility: raceSpellAbility,
      resolution: trait.resolution,
      resolutionNotes: trait.resolutionNotes,
    });
  }

  if (raceFeatDetail && cleanedText(raceFeatDetail.text)) {
    addFeature({
      id: `race-feat:${raceFeatDetail.id}`,
      kind: "feat",
      name: raceFeatDetail.name,
      text: cleanedText(raceFeatDetail.text),
      preparedSpellProgression: raceFeatDetail.preparedSpellProgression,
      featMechanics: raceFeatDetail.parsed,
    });
  }

  for (const trait of backgroundDetail?.traits ?? []) {
    const name = String(trait.name ?? "").trim();
    if (!name) continue;
    if (shouldSkipBackgroundTrait(name)) continue;
    addFeature({
      id: `background:${backgroundDetail?.id}:${name}`,
      kind: "background",
      name,
      text: trait.text,
      scalingRolls: trait.scalingRolls,
      preparedSpellProgression: trait.preparedSpellProgression,
      traitEffects: trait.effects,
      resolution: trait.resolution,
      resolutionNotes: trait.resolutionNotes,
    });
  }

  if (bgOriginFeatDetail && cleanedText(bgOriginFeatDetail.text)) {
    addFeature({
      id: `bg-feat:${bgOriginFeatDetail.id}`,
      kind: "feat",
      name: bgOriginFeatDetail.name,
      text: cleanedText(bgOriginFeatDetail.text),
      preparedSpellProgression: bgOriginFeatDetail.preparedSpellProgression,
      featMechanics: bgOriginFeatDetail.parsed,
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
      featMechanics: feat.parsed,
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
      featMechanics: entry.feat.parsed,
    });
  }

  for (const invocation of invocationDetails) {
    addFeature({
      id: `invocation:${invocation.id}`,
      kind: "invocation",
      name: String(invocation.name ?? "").replace(/^Invocation:\s*/i, "").trim(),
      text: invocation.text,
      classEffects: invocation.effects,
    });
  }

  for (const feat of args.extraFeatDetails ?? []) {
    if (!cleanedText(feat.text)) continue;
    addFeature({
      id: `extra-feat:${feat.id}`,
      kind: "feat",
      name: feat.name,
      text: cleanedText(feat.text),
      preparedSpellProgression: feat.preparedSpellProgression,
      featMechanics: feat.parsed,
    });
  }

  return Array.from(byId.values());
}

export function buildDisplayPlayerFeatures(args: BuildDisplayPlayerFeaturesArgs): ClassFeatureEntry[] {
  return buildAppliedCharacterFeatures(args)
    .filter((feature) => !(feature.kind === "class" && hasSelectedReplacementClassFeat(args.charData, feature.name)))
    .filter((feature) =>
      feature.kind === "class"
      || feature.kind === "subclass"
      || feature.kind === "feat"
      || feature.kind === "invocation"
      || feature.preparedSpellProgression?.length
      // Species/background traits: the trait's own honest `resolution` decides display —
      // "manual" means pure boilerplate (Description/Creature Type/Size) or a fact already
      // shown via a sibling trait (one fact, one home), never a name/prose guess. A trait
      // without a resolution label (homebrew) is shown, not filtered by keyword.
      || feature.resolution !== "manual"
    )
    .map(({ id, name, text, scalingRolls, preparedSpellProgression }) => ({
      id,
      name,
      text,
      scalingRolls,
      preparedSpellProgression,
    }));
}

export type {
  ProgressionGrantedSpellEntry,
  PreparedSpellProgressionChoiceDefinition,
} from "./characterFeaturesProgression";
export {
  buildPreparedSpellProgressionGrants,
  buildPreparedSpellProgressionChoiceDefinitions,
} from "./characterFeaturesProgression";
