import assert from "node:assert/strict";
import test from "node:test";
import { spellStateValidationProblem } from "./spellStateValidation.js";

test("spell state validation accepts bounded slot, preparation and concentration state", () => {
  assert.equal(spellStateValidationProblem({
    usedSpellSlots: { "1": 2, "pact:warlock:2": 1 },
    proficiencies: { spells: [{ name: "Bless", classEntryId: "cleric", prepared: true }, { name: "Shield", classEntryId: "wizard" }] },
    classSpellSelections: { cleric: { chosenSpells: ["bless"] } },
    concentrationSpell: "Bless",
  }), null);
});

test("spell state validation rejects malformed or unbounded mutable spell state", () => {
  for (const data of [
    { usedSpellSlots: [] },
    { usedSpellSlots: { "1": -1 } },
    { usedSpellSlots: { "1": 21 } },
    { classSpellSelections: [] },
    { classSpellSelections: { cleric: "bless" } },
    { proficiencies: { spells: [{ name: "Bless", prepared: "yes" }] } },
    { concentrationSpell: "" },
  ]) assert.equal(spellStateValidationProblem(data)?.code, "invalid-spell-state");
});
