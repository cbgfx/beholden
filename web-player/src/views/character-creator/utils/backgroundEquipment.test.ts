import { describe, expect, it } from "vitest";
import { buildEquipmentItems, collectEquipmentLookupNames } from "./CharacterCreatorEquipmentUtils";
import { parseStartingEquipmentOptions } from "./CharacterCreatorRaceParseUtils";

const structured = [
  {
    id: "A",
    entries: [
      { kind: "item" as const, name: "Dagger", quantity: 2 },
      { kind: "currency" as const, denomination: "GP" as const, amount: 15 },
    ],
  },
  {
    id: "B",
    entries: [
      { kind: "currency" as const, denomination: "GP" as const, amount: 50 },
    ],
  },
];

describe("structured background equipment", () => {
  it("prefers canonical options over reparsing prose", () => {
    expect(parseStartingEquipmentOptions("unparseable legacy prose", structured)).toEqual([
      { id: "A", entries: ["2× Dagger", "15 GP"], text: "2× Dagger, 15 GP" },
      { id: "B", entries: ["50 GP"], text: "50 GP" },
    ]);
  });

  it("uses canonical entries for item lookup", () => {
    expect(collectEquipmentLookupNames("A", "ignored", [], structured)).toEqual(["Dagger"]);
  });

  it("creates item quantities and currency from canonical entries", () => {
    expect(buildEquipmentItems("A", "ignored", "bg", [], [], structured)).toEqual([
      expect.objectContaining({ name: "Dagger", quantity: 2, source: "custom" }),
      expect.objectContaining({ name: "GP", quantity: 15, source: "custom" }),
    ]);
  });
});
