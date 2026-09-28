import { describe, expect, it } from "vitest";
import { hitDicePatchForTotal, keepPreparedWithinClassLimits } from "./CharacterViewCombatActions";
import { buildHitDicePools } from "@/views/character/CharacterViewDerivedState";

const selection = (hd: number, level: number) => ({ entry: { level }, detail: { hd } }) as unknown as Parameters<typeof buildHitDicePools>[0][number];

describe("hitDicePatchForTotal", () => {
  // Hit dice are stored as spent (shared/domain/hitDice), so what is left follows the maximum.
  it("stores what was spent for a single die size", () => {
    expect(hitDicePatchForTotal(4, [{ dieSize: 10, max: 5, current: 5 }])).toEqual({ hitDiceSpent: { "10": 1 } });
    expect(hitDicePatchForTotal(5, [{ dieSize: 10, max: 5, current: 4 }])).toEqual({ hitDiceSpent: {} });
  });

  it("stores nothing without a single die size to set", () => {
    expect(hitDicePatchForTotal(2, [])).toBeNull();
    expect(hitDicePatchForTotal(2, [{ dieSize: 10, max: 3, current: 3 }, { dieSize: 6, max: 2, current: 2 }])).toBeNull();
  });

  it("a level-up adds a full die: spent stays spent, the new die is available", () => {
    const beforeLevelUp = buildHitDicePools([selection(10, 5)], { "10": 2 });
    expect(beforeLevelUp).toEqual([{ dieSize: 10, max: 5, current: 3 }]);
    expect(buildHitDicePools([selection(10, 6)], { "10": 2 })).toEqual([{ dieSize: 10, max: 6, current: 4 }]);
    expect(buildHitDicePools([selection(10, 6)], undefined)).toEqual([{ dieSize: 10, max: 6, current: 6 }]);
  });
});

describe("keepPreparedWithinClassLimits", () => {
  it("keeps legacy unowned spells preparable on a single-class character", () => {
    expect(keepPreparedWithinClassLimits({
      preparedSpellKeys: ["shield", "detectmagic"],
      classStates: [{ classEntryId: "wizard", preparedLimit: 5 }],
      trackedSpells: [{ name: "Shield" }, { name: "Detect Magic" }],
    })).toEqual(["shield", "detectmagic"]);
  });

  it("uses explicit ownership and counts unowned spells toward the primary prepared caster", () => {
    expect(keepPreparedWithinClassLimits({
      preparedSpellKeys: ["shield", "curewounds", "detectmagic"],
      classStates: [
        { classEntryId: "wizard", preparedLimit: 2 },
        { classEntryId: "cleric", preparedLimit: 3 },
      ],
      trackedSpells: [
        { name: "Shield", classEntryId: "wizard" },
        { name: "Cure Wounds", classEntryId: "cleric" },
        { name: "Detect Magic" },
      ],
    }).sort()).toEqual(["curewounds", "detectmagic", "shield"]);
  });

  it("enforces each class limit independently and does not count always-prepared spells", () => {
    expect(keepPreparedWithinClassLimits({
      preparedSpellKeys: ["domainspell", "bless", "aid", "shield"],
      classStates: [
        { classEntryId: "cleric", preparedLimit: 1 },
        { classEntryId: "wizard", preparedLimit: 1 },
      ],
      trackedSpells: [
        { name: "Domain Spell", classEntryId: "cleric" },
        { name: "Bless", classEntryId: "cleric" },
        { name: "Aid", classEntryId: "cleric" },
        { name: "Shield", classEntryId: "wizard" },
      ],
      forcedPreparedKeys: new Set(["domainspell"]),
    })).toEqual(["domainspell", "bless", "shield"]);
  });
});
