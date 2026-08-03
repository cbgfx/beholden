import type {
  StartingEquipmentOption,
  StructuredStartingEquipmentOption,
} from "./CharacterCreatorClassCoreUtils";

/** Canonical equipment is already structured; descriptions are display-only. */
export function parseStartingEquipmentOptions(
  structuredOptions?: StructuredStartingEquipmentOption[],
): StartingEquipmentOption[] {
  return (structuredOptions ?? []).map((option) => {
    const entries = option.entries.map((entry) => entry.kind === "currency"
      ? `${entry.amount} ${entry.denomination}`
      : `${entry.quantity > 1 ? `${entry.quantity}× ` : ""}${entry.sourceLabel ?? (entry.kind === "item" ? entry.name ?? entry.itemId : entry.choiceKey)}`);
    return { id: option.id, entries, text: entries.join(", "), structuredEntries: option.entries };
  });
}
