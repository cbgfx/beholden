import { describe, expect, it } from "vitest";
import { progressionOwnershipProblem, reconcileProgressionOccurrences, removeClassProgressionOccurrences } from "@beholden/shared/domain/progressionOwnership";
import { buildClassLevelReduction } from "@beholden/shared/domain/progressionReduction";

describe("progression occurrence ownership", () => {
  it("keeps duplicate repeatable selections independently addressable", () => {
    const first = reconcileProgressionOccurrences({ existing: [], kind: "invocation", values: ["lesson", "lesson"], sourceKey: "class:warlock:invocations", classEntryId: "warlock", classLevel: 2, characterLevel: 2 });
    expect(new Set(first.map((entry) => entry.occurrenceId)).size).toBe(2);
    const second = reconcileProgressionOccurrences({ existing: first, kind: "invocation", values: ["lesson"], sourceKey: "class:warlock:invocations", classEntryId: "warlock", classLevel: 3, characterLevel: 3 });
    expect(second.map((entry) => entry.occurrenceId)).toEqual([first[0]!.occurrenceId]);
  });

  it("removes only occurrences acquired above the reduced class level", () => {
    const entries = [
      { occurrenceId: "a", kind: "invocation" as const, valueId: "lesson", sourceKey: "x", classEntryId: "warlock", classLevel: 2 },
      { occurrenceId: "b", kind: "invocation" as const, valueId: "lesson", sourceKey: "x", classEntryId: "warlock", classLevel: 5 },
      { occurrenceId: "c", kind: "optional" as const, valueId: "archery", sourceKey: "y", classEntryId: "fighter", classLevel: 1 },
    ];
    expect(removeClassProgressionOccurrences(entries, "warlock", 4).map((entry) => entry.occurrenceId)).toEqual(["a", "c"]);
  });

  it("reduces every occurrence-owned grant family without touching another class", () => {
    const kinds = ["invocation", "optional", "extra-feat", "maneuver", "metamagic", "infusion", "plan"] as const;
    const result = buildClassLevelReduction({
      classEntryId: "target", level: 3, hpMax: 22, hpCurrent: 19,
      classes: [{ id: "target", level: 2 }, { id: "other", level: 1 }],
      characterData: {
        hpProgressionHistory: [
          { characterLevelBefore: 0, characterLevelAfter: 1, classEntryId: "target", classLevelAfter: 1, baseHpMaxBefore: 0, baseHpMaxAfter: 10, levelHpGain: 10, hpMethod: "average", hitDieResult: null, constitutionBefore: 10, constitutionAfter: 10, constitutionHpAdjustment: 0 },
          { characterLevelBefore: 1, characterLevelAfter: 2, classEntryId: "other", classLevelAfter: 1, baseHpMaxBefore: 10, baseHpMaxAfter: 16, levelHpGain: 6, hpMethod: "average", hitDieResult: null, constitutionBefore: 10, constitutionAfter: 10, constitutionHpAdjustment: 0 },
          { characterLevelBefore: 2, characterLevelAfter: 3, classEntryId: "target", classLevelAfter: 2, baseHpMaxBefore: 16, baseHpMaxAfter: 22, levelHpGain: 6, hpMethod: "average", hitDieResult: null, constitutionBefore: 10, constitutionAfter: 10, constitutionHpAdjustment: 0 },
        ],
        progressionSelectionOccurrences: [
          ...kinds.map((kind) => ({ occurrenceId: `remove-${kind}`, kind, valueId: `${kind}-value`, sourceKey: `class:target:${kind}`, classEntryId: "target", classLevel: 2 })),
          { occurrenceId: "keep-other", kind: "metamagic", valueId: "subtle", sourceKey: "class:other:metamagic", classEntryId: "other", classLevel: 1 },
        ],
      },
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect((result.characterData.progressionSelectionOccurrences as any[]).map((entry) => entry.occurrenceId)).toEqual(["keep-other"]);
  });

  it("rejects duplicate occurrence IDs and ownership beyond the saved class level", () => {
    expect(progressionOwnershipProblem({ classes: [{ id: "warlock", level: 2 }], progressionSelectionOccurrences: [
      { occurrenceId: "same", kind: "invocation", valueId: "lesson", sourceKey: "x", classEntryId: "warlock", classLevel: 1 },
      { occurrenceId: "same", kind: "invocation", valueId: "lesson", sourceKey: "x", classEntryId: "warlock", classLevel: 2 },
    ] })).toContain("unique");
    expect(progressionOwnershipProblem({ classes: [{ id: "warlock", level: 2 }], progressionSelectionOccurrences: [
      { occurrenceId: "late", kind: "invocation", valueId: "lesson", sourceKey: "x", classEntryId: "warlock", classLevel: 3 },
    ] })).toContain("invalid class level");
  });

  it("removes a level-one secondary class and only its owned records", () => {
    const result = buildClassLevelReduction({
      classEntryId: "wizard", level: 4, hpMax: 30, hpCurrent: 25,
      classes: [{ id: "fighter", className: "Fighter", level: 3 }, { id: "wizard", className: "Wizard", level: 1 }],
      characterData: {
        hpProgressionHistory: [
          { characterLevelBefore: 0, characterLevelAfter: 3, classEntryId: "fighter", classLevelAfter: 3, baseHpMaxBefore: 0, baseHpMaxAfter: 24, levelHpGain: 24, hpMethod: "manual", hitDieResult: null, constitutionBefore: 12, constitutionAfter: 12, constitutionHpAdjustment: 0 },
          { characterLevelBefore: 3, characterLevelAfter: 4, classEntryId: "wizard", classLevelAfter: 1, baseHpMaxBefore: 24, baseHpMaxAfter: 30, levelHpGain: 6, hpMethod: "average", hitDieResult: null, constitutionBefore: 12, constitutionAfter: 12, constitutionHpAdjustment: 0 },
        ],
        classSpellSelections: { fighter: { chosenSpells: [] }, wizard: { chosenSpells: ["shield"] } },
        progressionSelectionOccurrences: [{ occurrenceId: "wiz", kind: "optional", valueId: "school", sourceKey: "class:wizard:optionals", classEntryId: "wizard", classLevel: 1 }],
        proficiencies: { skills: [{ name: "Athletics", classEntryId: "fighter" }], spells: [{ name: "Shield", classEntryId: "wizard", level: 1 }] },
      },
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.characterData.classes).toEqual([{ id: "fighter", className: "Fighter", level: 3 }]);
    expect((result.characterData.classSpellSelections as any).wizard).toBeUndefined();
    expect((result.characterData.proficiencies as any).skills).toHaveLength(1);
  });

  it("replays later HP entries when the removed secondary level was gained earlier", () => {
    const result = buildClassLevelReduction({
      classEntryId: "wizard", level: 3, hpMax: 25, hpCurrent: 25,
      classes: [{ id: "fighter", className: "Fighter", level: 2 }, { id: "wizard", className: "Wizard", level: 1 }],
      characterData: { hpProgressionHistory: [
        { characterLevelBefore: 0, characterLevelAfter: 1, classEntryId: "fighter", classLevelAfter: 1, baseHpMaxBefore: 0, baseHpMaxAfter: 11, levelHpGain: 11, hpMethod: "average", hitDieResult: null, constitutionBefore: 12, constitutionAfter: 12, constitutionHpAdjustment: 0 },
        { characterLevelBefore: 1, characterLevelAfter: 2, classEntryId: "wizard", classLevelAfter: 1, baseHpMaxBefore: 11, baseHpMaxAfter: 17, levelHpGain: 6, hpMethod: "average", hitDieResult: null, constitutionBefore: 12, constitutionAfter: 12, constitutionHpAdjustment: 0 },
        { characterLevelBefore: 2, characterLevelAfter: 3, classEntryId: "fighter", classLevelAfter: 2, baseHpMaxBefore: 17, baseHpMaxAfter: 25, levelHpGain: 8, hpMethod: "average", hitDieResult: null, constitutionBefore: 12, constitutionAfter: 12, constitutionHpAdjustment: 0 },
      ] },
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.hpMax).toBe(19);
    expect((result.characterData.hpProgressionHistory as any[]).map((entry) => [entry.characterLevelBefore, entry.characterLevelAfter, entry.baseHpMaxBefore, entry.baseHpMaxAfter])).toEqual([[0, 1, 0, 11], [1, 2, 11, 19]]);
  });

  it("preserves effective damage while reversing a retained or removed level-scaled HP feat", () => {
    const history = [
      { characterLevelBefore: 0, characterLevelAfter: 1, classEntryId: "fighter", classLevelAfter: 1, baseHpMaxBefore: 0, baseHpMaxAfter: 10, levelHpGain: 10, hpMethod: "average", hitDieResult: null, constitutionBefore: 10, constitutionAfter: 10, constitutionHpAdjustment: 0 },
      { characterLevelBefore: 1, characterLevelAfter: 2, classEntryId: "fighter", classLevelAfter: 2, baseHpMaxBefore: 10, baseHpMaxAfter: 16, levelHpGain: 6, hpMethod: "average", hitDieResult: null, constitutionBefore: 10, constitutionAfter: 10, constitutionHpAdjustment: 0 },
    ];
    const retained = buildClassLevelReduction({
      classEntryId: "fighter", level: 2, hpMax: 16, hpCurrent: 17,
      classes: [{ id: "fighter", level: 2 }],
      characterData: { hpProgressionHistory: history, chosenLevelUpFeats: [{ classEntryId: "fighter", classLevel: 1, type: "feat", hitPointMaxBonusPerLevel: 2 }] },
    });
    expect("error" in retained).toBe(false);
    if (!("error" in retained)) expect(retained.hpCurrent).toBe(9); // effective max 12, preserving 3 damage

    const removed = buildClassLevelReduction({
      classEntryId: "fighter", level: 2, hpMax: 16, hpCurrent: 17,
      classes: [{ id: "fighter", level: 2 }],
      characterData: { hpProgressionHistory: history, chosenLevelUpFeats: [{ classEntryId: "fighter", classLevel: 2, type: "feat", hitPointMaxBonusPerLevel: 2 }] },
    });
    expect("error" in removed).toBe(false);
    if (!("error" in removed)) expect(removed.hpCurrent).toBe(7); // base max 10, preserving 3 damage after the feat is gone
  });
});
