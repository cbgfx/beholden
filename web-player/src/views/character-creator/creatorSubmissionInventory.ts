import type { BgDetail, ClassDetail } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { ParsedFeatChoiceLike as ParsedFeatChoice } from "@/views/character-creator/utils/FeatChoiceTypes";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { buildStartingInventory as buildStartingInventoryFromUtils } from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import { collectEquipmentLookupNames, getBackgroundGrantedToolSelections as getBackgroundGrantedToolSelectionsFromUtils } from "@/views/character-creator/utils/CharacterCreatorEquipmentUtils";
import { extractClassStartingEquipment } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { buildItemLookupBodyFromNames, fetchCompendiumItemsByLookup, isItemLookupBodyEmpty } from "@/views/character-creator/utils/ItemLookupUtils";

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
    ...collectEquipmentLookupNames(form.chosenBgEquipmentOption, bgDetail?.equipment, bgToolSelections),
    ...collectEquipmentLookupNames(
      form.chosenClassEquipmentOption,
      extractClassStartingEquipment(classDetail),
      [],
    ),
  ];
  const lookupBody = buildItemLookupBodyFromNames(equipmentLookupNames);
  const startingInventoryItems = isItemLookupBodyEmpty(lookupBody)
    ? []
    : await fetchCompendiumItemsByLookup(lookupBody);
  return buildStartingInventoryFromUtils(form, bgDetail, classDetail, startingInventoryItems);
}

