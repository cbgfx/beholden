import type { BgDetail, ClassDetail } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { ParsedFeatChoiceLike as ParsedFeatChoice } from "@/views/character-creator/utils/FeatChoiceTypes";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { buildStartingInventory as buildStartingInventoryFromUtils } from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import { collectEquipmentLookupIds, collectEquipmentLookupNames, getBackgroundGrantedToolSelections as getBackgroundGrantedToolSelectionsFromUtils } from "@/views/character-creator/utils/CharacterCreatorEquipmentUtils";
import { addItemLookupIds, buildItemLookupBodyFromNames, fetchCompendiumItemsByLookup, isItemLookupBodyEmpty } from "@/views/character-creator/utils/ItemLookupUtils";

export async function buildCreatorStartingInventory(args: {
  form: FormState;
  bgDetail: BgDetail | null;
  classDetail: ClassDetail | null;
  isEditing: boolean;
  classifyFeatSelection: (
    choice: ParsedFeatChoice<string>,
    value: string,
  ) => "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw" | "weapon_mastery" | null;
}) {
  const {
    form,
    bgDetail,
    classDetail,
    isEditing,
    classifyFeatSelection,
  } = args;

  if (isEditing) return undefined;

  const bgToolSelections = getBackgroundGrantedToolSelectionsFromUtils(form, bgDetail, [], classifyFeatSelection);
  const equipmentLookupNames = [
    ...collectEquipmentLookupNames(
      form.chosenBgEquipmentOption,
      bgToolSelections,
      bgDetail?.equipmentOptions,
    ),
    ...collectEquipmentLookupNames(
      form.chosenClassEquipmentOption,
      [],
      classDetail?.equipmentOptions,
    ),
  ];
  const equipmentLookupIds = [
    ...collectEquipmentLookupIds(form.chosenBgEquipmentOption, bgDetail?.equipmentOptions),
    ...collectEquipmentLookupIds(form.chosenClassEquipmentOption, classDetail?.equipmentOptions),
  ];
  const lookupBody = addItemLookupIds(buildItemLookupBodyFromNames(equipmentLookupNames), equipmentLookupIds);
  const startingInventoryItems = isItemLookupBodyEmpty(lookupBody)
    ? []
    : await fetchCompendiumItemsByLookup(lookupBody);
  return buildStartingInventoryFromUtils(form, bgDetail, classDetail, startingInventoryItems);
}
