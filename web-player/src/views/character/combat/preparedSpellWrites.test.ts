import { describe, expect, it } from "vitest";
import { buildCharacterRuntimeActions } from "./CharacterViewCombatActions";
import type { CharacterData, TaggedItem } from "@/views/character/CharacterSheetTypes";

// Preparation is a flag on the spell's own entry, the one place it is stored. Removing a spell used
// to leave it in a separate prepared list, still using a slot after it was gone from the sheet.

function wizardActions(spells: TaggedItem[], saves: CharacterData[]) {
  const preparedSpells = spells.filter((spell) => spell.prepared).map((spell) => spell.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return buildCharacterRuntimeActions({
    char: { id: "char-1", className: "Wizard", conditions: [] },
    currentCharacterData: { proficiencies: { spells } as CharacterData["proficiencies"] },
    classSpellcastingStates: [{ classEntryId: "wizard", preparedLimit: 3, preparedSpells }],
    preparedSpells,
    preparedSpellLimit: 3,
    usesFlexiblePreparedList: true,
    forcedPreparedSpellKeys: new Set<string>(),
    normalizeSpellTrackingKey: (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    saveCharacterData: async (patch: CharacterData) => { saves.push(patch); return null; },
  } as unknown as Parameters<typeof buildCharacterRuntimeActions>[0]);
}

const spell = (name: string, prepared = false): TaggedItem =>
  ({ name, source: "Wizard", classEntryId: "wizard", ...(prepared ? { prepared: true } : {}) });
const savedSpells = (saves: CharacterData[]) =>
  (saves.at(-1)!.proficiencies?.spells ?? []).map((entry) => `${entry.name}${entry.prepared ? " (prepared)" : ""}`);

describe("prepared spells live on the spell entries", () => {
  it("removing a prepared spell removes its preparation with it, and writes nothing else", async () => {
    const saves: CharacterData[] = [];
    await wizardActions([spell("Shield", true), spell("Magic Missile", true), spell("Detect Magic", true)], saves)
      .removeTrackedSpell("Magic Missile");

    expect(savedSpells(saves)).toEqual(["Shield (prepared)", "Detect Magic (prepared)"]);
    expect(Object.keys(saves.at(-1)!)).toEqual(["proficiencies"]);
  });

  it("preparing and unpreparing flips only the flags", async () => {
    const saves: CharacterData[] = [];
    await wizardActions([spell("Shield", true), spell("Magic Missile"), spell("Detect Magic")], saves)
      .savePreparedSpells(["magicmissile"]);

    expect(savedSpells(saves)).toEqual(["Shield", "Magic Missile (prepared)", "Detect Magic"]);
  });

  it("the class's limit holds: a fourth spell is not prepared past three", async () => {
    const saves: CharacterData[] = [];
    await wizardActions([spell("A"), spell("B"), spell("C"), spell("D")], saves)
      .savePreparedSpells(["a", "b", "c", "d"]);

    expect(savedSpells(saves)).toEqual(["A (prepared)", "B (prepared)", "C (prepared)", "D"]);
  });

  it("a newly added leveled spell comes in prepared when there is room", async () => {
    const saves: CharacterData[] = [];
    await wizardActions([spell("Shield", true)], saves).addTrackedSpell({ name: "Magic Missile", level: 1 });

    expect(savedSpells(saves)).toEqual(["Magic Missile (prepared)", "Shield (prepared)"]);
  });
});
