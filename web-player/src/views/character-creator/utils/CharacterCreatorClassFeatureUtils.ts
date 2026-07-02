import {
  buildEquipmentItems as buildEquipmentItemsFromUtils,
  getBackgroundGrantedToolSelections as getBackgroundGrantedToolSelectionsFromUtils,
} from "./CharacterCreatorEquipmentUtils";
import {
  classifyFeatSelection,
  extractClassStartingEquipment,
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
  CreatorWeaponMasteryChoice,
} from "./CharacterCreatorProficiencyTypes";

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
      } satisfies ParseFeatureEffectsInput));
    }
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
    bgDetail?.equipment,
    "bg",
    getBackgroundGrantedToolSelectionsFromUtils(form as never, bgDetail as never, [], classifyFeatSelection),
    itemIndex as never,
    bgDetail?.equipmentOptions,
  );
  const classItems = buildEquipmentItemsFromUtils(
    form.chosenClassEquipmentOption,
    extractClassStartingEquipment(classDetail as never),
    "class",
    [],
    itemIndex as never,
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
      const parsed = parseFeatureEffects({
        source: {
          id: `creator-class-feature:${autolevel.level}:${feature.name}`,
          kind: "class",
          name: feature.name,
          text: feature.text,
        },
        text: feature.text,
        classEffects: feature.effects,
      });
      const masteryEffect = parsed.effects.find((effect) => effect.type === "weapon_mastery");
      if (masteryEffect?.type !== "weapon_mastery") continue;
      const count = masteryEffect.choice?.count?.kind === "fixed" ? masteryEffect.choice.count.value : null;
      applyCandidate(feature.name, count);
      for (const match of String(feature.text ?? "").matchAll(/(\d+)\s+at\s+level\s+(\d+)/gi)) {
        const progressiveCount = Number(match[1]);
        const requiredLevel = Number(match[2]);
        if (Number.isFinite(progressiveCount) && Number.isFinite(requiredLevel) && level >= requiredLevel) {
          applyCandidate(feature.name, progressiveCount);
        }
      }
    }
  }
  return best;
}
