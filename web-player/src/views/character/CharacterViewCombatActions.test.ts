import { describe, expect, it } from "vitest";
import { scopePreparedSpellsByClass } from "./CharacterViewCombatActions";

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
