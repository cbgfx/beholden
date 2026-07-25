import { describe, expect, it } from "vitest";
import { buildEquipmentItems, collectEquipmentLookupIds, collectEquipmentLookupNames } from "./CharacterCreatorEquipmentUtils";
import { parseStartingEquipmentOptions } from "./CharacterCreatorRaceParseUtils";

const structured = [
  {
    id: "A",
    entries: [
      { kind: "item" as const, itemId: "i_dagger", quantity: 2, sourceLabel: "Dagger" },
      { kind: "choiceRef" as const, choiceKey: "background.tools" as const, quantity: 1, sourceLabel: "Gaming Set (any)" },
      { kind: "itemChoice" as const, choiceKey: "background.equipment.A.2", itemIds: ["i_crystal", "i_wand"], quantity: 1, sourceLabel: "Arcane Focus" },
      { kind: "currency" as const, denomination: "GP" as const, amount: 15 },
    ],
  },
  { id: "B", entries: [{ kind: "currency" as const, denomination: "GP" as const, amount: 50 }] },
];

describe("structured background equipment", () => {
  it("projects canonical equipment options for display", () => {
    expect(parseStartingEquipmentOptions(structured)).toEqual([
      {
        id: "A",
        entries: ["2× Dagger", "Gaming Set (any)", "Arcane Focus", "15 GP"],
        text: "2× Dagger, Gaming Set (any), Arcane Focus, 15 GP",
        structuredEntries: structured[0].entries,
      },
      { id: "B", entries: ["50 GP"], text: "50 GP", structuredEntries: structured[1].entries },
    ]);
  });

  it("looks up direct IDs, choices, and referenced tools without guessing item names", () => {
    expect(collectEquipmentLookupNames("A", ["Dice Set"], structured)).toEqual(["Dice Set"]);
    expect(collectEquipmentLookupIds("A", structured)).toEqual(["i_dagger", "i_crystal", "i_wand"]);
  });

  it("creates canonical items, the selected focus, referenced tool, and currency", () => {
    expect(buildEquipmentItems(
      "A", "bg", ["Dice Set"],
      [
        { id: "i_dagger", name: "Dagger", type: "Melee Weapon", dmg1: "1d4" },
        { id: "i_crystal", name: "Crystal", type: "Adventuring Gear" },
        { id: "dice", name: "Dice Set", type: "Gaming Set" },
      ],
      structured,
      { "background.equipment.A.2": ["i_crystal"] },
    )).toEqual([
      // Weapons with quantity > 1 are split into separate quantity-1 rows (not stacked) —
      // this is the only way to get two independently-equippable starting weapons into
      // inventory, since there's no stack-splitting UI. See pushItem() in
      // CharacterCreatorEquipmentUtils.ts.
      expect.objectContaining({ name: "Dagger", quantity: 1, itemId: "i_dagger" }),
      expect.objectContaining({ name: "Dagger", quantity: 1, itemId: "i_dagger" }),
      expect.objectContaining({ name: "Dice Set", quantity: 1 }),
      expect.objectContaining({ name: "Crystal", quantity: 1, itemId: "i_crystal" }),
      expect.objectContaining({ name: "GP", quantity: 15, source: "custom" }),
    ]);
  });
});
