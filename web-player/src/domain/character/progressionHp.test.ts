import { expect, it } from "vitest";
import { buildInitialHpProgressionHistory, hpProgressionHistoryProblem, levelUpConstitutionHp, reconcileCreatorHp, reverseHpProgressionToLevel } from "@beholden/shared/domain/progressionHp";
import { buildLevelUpPayload } from "@/views/level-up/buildLevelUpPayload";

it("preserves recorded HP on edits and manual HP during creation", () => {
  expect(reconcileCreatorHp("63", "52", null, true)).toBe("63");
  expect(reconcileCreatorHp("63", "45", "52", true)).toBe("63");
  expect(reconcileCreatorHp("0", "10", null, false)).toBe("10");
  expect(reconcileCreatorHp("10", "17", "10", false)).toBe("17");
  expect(reconcileCreatorHp("19", "17", "10", false)).toBe("19");
});

it("records exact average creation HP per level", () => {
  const history = buildInitialHpProgressionHistory({ level: 3, hitDie: 8, constitution: 14, hpMax: 24, classEntryId: "cleric" });
  expect(history.map((entry) => entry.levelHpGain)).toEqual([10, 7, 7]);
  expect(history.at(-1)?.baseHpMaxAfter).toBe(24);
  expect(history.every((entry) => entry.hpMethod === "average")).toBe(true);
});

it("records a manual creation total as an aggregate without inventing earlier gains", () => {
  const history = buildInitialHpProgressionHistory({ level: 3, hitDie: 8, constitution: 14, hpMax: 30, classEntryId: "cleric" });
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({ characterLevelBefore: 0, characterLevelAfter: 3, levelHpGain: 30, hpMethod: "manual" });
});

it("records each physical creation roll separately from its Constitution-adjusted gain", () => {
  const history = buildInitialHpProgressionHistory({ level: 3, hitDie: 8, constitution: 14, hpMax: 25, classEntryId: "cleric", hpMethod: "physical", physicalRolls: { 2: "6", 3: "5" } });
  expect(history.map((entry) => ({ method: entry.hpMethod, die: entry.hitDieResult, gain: entry.levelHpGain }))).toEqual([
    { method: "average", die: null, gain: 10 },
    { method: "roll", die: 6, gain: 8 },
    { method: "roll", die: 5, gain: 7 },
  ]);
});

it("validates and reverses exact HP history without guessing across an aggregate baseline", () => {
  const history = buildInitialHpProgressionHistory({ level: 3, hitDie: 8, constitution: 14, hpMax: 25, classEntryId: "cleric", hpMethod: "physical", physicalRolls: { 2: "6", 3: "5" } });
  const data = { classes: [{ id: "cleric", level: 3 }], hpProgressionHistory: history };
  expect(hpProgressionHistoryProblem(data, 3, 25)).toBeNull();
  expect(reverseHpProgressionToLevel(history, 2)).toMatchObject({ hpMax: 18, history: [{ characterLevelAfter: 1 }, { characterLevelAfter: 2 }] });
  const aggregate = buildInitialHpProgressionHistory({ level: 3, hitDie: 8, constitution: 14, hpMax: 30, classEntryId: "cleric", hpMethod: "manual" });
  expect(reverseHpProgressionToLevel(aggregate, 2)).toBeNull();
});

it("adjusts all character levels only when the permanent Constitution modifier changes", () => {
  const base = { constitution: 15, nextLevel: 8, mode: "asi" as const, asi: { con: 1 }, feat: {} };
  expect(levelUpConstitutionHp(base)).toEqual({ constitutionAfter: 16, adjustment: 8 });
  expect(levelUpConstitutionHp({ ...base, constitution: 14 }).adjustment).toBe(0);
  expect(levelUpConstitutionHp({ ...base, mode: null }).adjustment).toBe(0);
  expect(levelUpConstitutionHp({ ...base, constitution: 20 }).adjustment).toBe(0);
  expect(levelUpConstitutionHp({ ...base, constitution: 22 })).toEqual({ constitutionAfter: 22, adjustment: 0 });
});

it.each(["asi", "feat"] as const)("persists %s Constitution HP once, preserves damage, and records the transition", (mode) => {
  const args = {
    char: { hpMax: 50, hpCurrent: 38, className: "Cleric", characterData: { classes: [{ id: "cleric", classId: "c_cleric", level: 7 }], hpProgressionHistory: [{ legacyBaseline: true }] } },
    nextLevel: 8, nextClassLevel: 8, targetClassEntryId: "cleric", hpGain: 7, featHpBonus: 0,
    subclass: "", chosenCantrips: [], chosenSpells: [], chosenInvocations: [], chosenExpertise: {}, chosenFeatOptions: {}, chosenFeatureChoices: {},
    expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "", newFeatures: [],
    classDetailName: "Cleric", selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
    baseScores: { con: 15 }, asiMode: mode, asiStats: { con: 1, wis: 1 }, featAbilityBonuses: { con: 1 },
  };
  const first = buildLevelUpPayload(args as never) as { hpMax: number; hpCurrent: number; conScore: number; characterData: { hpProgressionHistory: unknown[] } };
  expect(first.hpMax).toBe(65);
  expect(first.hpCurrent).toBe(53);
  expect(first.hpMax - first.hpCurrent).toBe(12);
  expect(first.conScore).toBe(16);
  expect(first.characterData.hpProgressionHistory).toEqual([
    { legacyBaseline: true },
    expect.objectContaining({ characterLevelBefore: 7, characterLevelAfter: 8, baseHpMaxBefore: 50, baseHpMaxAfter: 65, levelHpGain: 7, constitutionHpAdjustment: 8 }),
  ]);
  const second = buildLevelUpPayload({ ...args, char: { ...args.char, hpMax: first.hpMax, hpCurrent: first.hpCurrent, characterData: first.characterData },
    nextLevel: 9, nextClassLevel: 9, hpGain: 8, baseScores: { con: 16 }, asiMode: null } as never);
  expect(second.hpMax).toBe(73);
  expect(second.hpCurrent).toBe(61);
});
