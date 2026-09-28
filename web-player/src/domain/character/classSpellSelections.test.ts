import { describe, expect, it } from "vitest";
import { readClassSpellSelection } from "./classSpellSelections";

describe("class spell selection baseline", () => {
  const data = {
    classSpellSelections: { secondary: { chosenSpells: ["secondary-spell"], chosenCantrips: [] } },
  };
  it("returns an empty selection when a class has no scoped record", () => {
    expect(readClassSpellSelection(data, "primary").chosenSpells).toEqual([]);
  });
  it("locks choices from the selected class, including intentional empty lists", () => {
    expect(readClassSpellSelection(data, "secondary")).toMatchObject({ chosenSpells: ["secondary-spell"], chosenCantrips: [], chosenInvocations: [] });
  });
});
