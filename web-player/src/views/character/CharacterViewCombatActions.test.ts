import { describe, expect, it } from "vitest";
import { hitDicePatchForTotal, scopePreparedSpellsByClass } from "./CharacterViewCombatActions";

describe("hitDicePatchForTotal", () => {
  it("updates the size-owned pool used by single-class derived state", () => {
    expect(hitDicePatchForTotal(4, 5, [{ dieSize: 10, max: 5, current: 5 }])).toEqual({
      hitDiceCurrent: 4,
      hitDiceCurrentBySize: { "10": 4 },
    });
  });

  it("keeps the legacy total-only representation when no pool exists", () => {
    expect(hitDicePatchForTotal(2, 3, [])).toEqual({ hitDiceCurrent: 2 });
  });
});

describe("scopePreparedSpellsByClass", () => {
  it("keeps legacy unowned spells preparable on a single-class character", () => {
    expect(scopePreparedSpellsByClass({
      preparedSpellKeys: ["shield", "detectmagic"],
      classStates: [{ classEntryId: "wizard", preparedLimit: 5 }],
      trackedSpells: [{ name: "Shield" }, { name: "Detect Magic" }],
    })).toEqual({ wizard: { preparedSpells: ["shield", "detectmagic"] } });
  });

  it("uses explicit ownership and assigns only legacy spells to the primary prepared caster", () => {
    expect(scopePreparedSpellsByClass({
      preparedSpellKeys: ["shield", "curewounds", "detectmagic"],
      classStates: [
        { classEntryId: "wizard", preparedLimit: 4 },
        { classEntryId: "cleric", preparedLimit: 3 },
      ],
      trackedSpells: [
        { name: "Shield", classEntryId: "wizard" },
        { name: "Cure Wounds", classEntryId: "cleric" },
        { name: "Detect Magic" },
      ],
    })).toEqual({
      wizard: { preparedSpells: ["shield", "detectmagic"] },
      cleric: { preparedSpells: ["curewounds"] },
    });
  });
});
