import {
  buildEquipmentItems as buildEquipmentItemsFromUtils,
  getBackgroundGrantedToolSelections as getBackgroundGrantedToolSelectionsFromUtils,
} from "./CharacterCreatorEquipmentUtils";
import {
  classifyFeatSelection,
  featureMatchesSubclass,
  getFeatureSubclassName,
  isSubclassChoiceFeature,
} from "./CharacterCreatorUtils";
import {
  parseFeatureEffects,
  type ParseFeatureEffectsInput,
} from "@/domain/character/parseFeatureEffects";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import type {
  CreatorClassDetailLike,
  CreatorBgDetailLike,
  CreatorFormLike,
  CreatorInventoryItemSeed,
  CreatorItemSummaryLike,
  CreatorRaceDetailLike,
  CreatorWeaponMasteryChoice,
} from "./CharacterCreatorProficiencyTypes";
import { resolveSpeciesTraitEffects } from "@/domain/character/speciesTraitChoices";

export function parseAppliedClassFeatureEffects(
  classDetail: CreatorClassDetailLike | null,
  level: number,
  selectedSubclass: string | null | undefined,
  chosenOptionals: string[],
): ParsedFeatureEffects[] {
  if (!classDetail) return [];
  const selected = new Set(chosenOptionals);
  const parsed: ParsedFeatureEffects[] = [];
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level == null || autolevel.level > level) continue;
    for (const feature of autolevel.features) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      const isSubclassFeature = Boolean(getFeatureSubclassName(feature));
      if (feature.optional && !isSubclassFeature && !selected.has(feature.name)) continue;
      if (!String(feature.text ?? "").trim() && !(feature.effects?.length)) continue;
      parsed.push(parseFeatureEffects({
        source: {
          id: `creator-class-feature:${autolevel.level}:${feature.name}`,
          kind: isSubclassFeature ? "subclass" : "class",
          name: feature.name,
          level: autolevel.level,
          parentName: classDetail.name,
          text: feature.text,
        },
        text: feature.text,
        classEffects: feature.effects,
        classChoices: feature.choices,
        // Canonical class prose is display text, never a mechanical input. A feature
        // without typed effects/choices is deliberately table-resolved.
      } satisfies ParseFeatureEffectsInput));
    }
  }
  return parsed;
}

/**
 * Same structured-effects pipeline as class features (parseAppliedClassFeatureEffects), applied
 * to species traits — so a species-granted AC/speed/defense fact (e.g. Warforged's Integrated
 * Protection) shows up in the creator's live preview, not just the saved character sheet.
 */
export function parseAppliedSpeciesTraitEffects(
  raceDetail: CreatorRaceDetailLike | null,
  chosenFeatureChoices?: Record<string, string[]>,
): ParsedFeatureEffects[] {
  if (!raceDetail) return [];
  const parsed: ParsedFeatureEffects[] = [];
  for (const trait of raceDetail.traits) {
    if (!String(trait.text ?? "").trim() && !(trait.effects?.length)) continue;
    parsed.push(parseFeatureEffects({
      source: {
        id: `creator-species-trait:${trait.name}`,
        kind: "species",
        name: trait.name,
        parentName: raceDetail.name,
        text: trait.text,
      },
      text: trait.text,
      traitEffects: resolveSpeciesTraitEffects(
        String(raceDetail.id ?? ""),
        trait.name,
        trait.effects,
        chosenFeatureChoices,
      ),
    } satisfies ParseFeatureEffectsInput));
  }
  return parsed;
}

export function buildStartingInventory(
  form: CreatorFormLike,
  bgDetail: CreatorBgDetailLike | null,
  classDetail: CreatorClassDetailLike | null,
  itemIndex: CreatorItemSummaryLike[],
): CreatorInventoryItemSeed[] {
  const bgItems = buildEquipmentItemsFromUtils(
    form.chosenBgEquipmentOption,
    "bg",
    getBackgroundGrantedToolSelectionsFromUtils(form as never, bgDetail as never, [], classifyFeatSelection),
    itemIndex as never,
    bgDetail?.equipmentOptions,
    form.chosenFeatureChoices,
  );
  const classItems = buildEquipmentItemsFromUtils(
    form.chosenClassEquipmentOption,
    "class",
    form.chosenClassTools,
    itemIndex as never,
    classDetail?.equipmentOptions as never,
    form.chosenFeatureChoices,
  );
  return [...classItems, ...bgItems];
}

export function getWeaponMasteryChoice(
  classDetail: CreatorClassDetailLike | null,
  level: number,
): CreatorWeaponMasteryChoice | null {
  if (!classDetail) return null;
  let best: CreatorWeaponMasteryChoice | null = null;
  const applyCandidate = (source: string, count: number | null) => {
    if (count && count > 0 && (!best || count > best.count)) best = { source, count };
  };
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level == null || autolevel.level > level) continue;
    for (const feature of autolevel.features) {
      const structured = feature.choices?.find((choice) => choice.kind === "weapon_mastery");
      if (structured?.kind === "weapon_mastery") {
        for (const [requiredLevelText, count] of Object.entries(structured.known)) {
          if (level >= Number(requiredLevelText)) applyCandidate(feature.name, count);
        }
        continue;
      }
      const parsed = parseFeatureEffects({
        source: {
          id: `creator-class-feature:${autolevel.level}:${feature.name}`,
          kind: "class",
          name: feature.name,
          text: feature.text,
        },
        text: feature.text,
        classEffects: feature.effects,
        classChoices: feature.choices,
      });
      const masteryEffect = parsed.effects.find((effect) => effect.type === "weapon_mastery");
      if (masteryEffect?.type !== "weapon_mastery") continue;
      const count = masteryEffect.choice?.count?.kind === "fixed" ? masteryEffect.choice.count.value : null;
      applyCandidate(feature.name, count);
    }
  }
  return best;
}
