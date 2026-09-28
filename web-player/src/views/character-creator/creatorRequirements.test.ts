import { expect, it } from "vitest";
import { creatorRequirements } from "./creatorRequirements";
import { initForm } from "./utils/CharacterCreatorFormUtils";
import { buildCreatorSubmissionBody } from "./creatorSubmission";
import { requirementBlocks } from "@beholden/shared/domain/progressionRequirements";
import { buildInitialHpProgressionHistory } from "@beholden/shared/domain/progressionHp";

const cleric = { id: "cleric", name: "Cleric", hd: 8, armor: "", weapons: "", proficiency: "", spellAbility: "wis", preparedSpellChanges: "long_rest", autolevels: [{ level: 1, spellsPrepared: 12, features: [] }] };
function args(): Parameters<typeof creatorRequirements>[0] {
  return {
    form: { ...initForm(null, new URLSearchParams()), ruleset: "5.5e", characterName: "Diego", hpMax: "50", age: "30", gender: "male", classId: "cleric", level: 8, chosenSpells: Array.from({ length: 20 }, (_, i) => `spell-${i}`) },
    classDetail: cleric as never, scores: { wis: 18 }, levelUpFeatLevels: [], levelUpFeatConflict: false,
    loads: [], optionsLoaded: true, step5: {} as never, skillsCount: 0, skillOptions: [], invocCount: 0,
    invocationIds: [], spellLists: [], spellChoices: [], spellOptions: {},
  };
}

it("creator accepts the same flexible spell model as level-up without skipping required feat spells", () => {
  expect(creatorRequirements(args()).filter(requirementBlocks)).toEqual([]);
  const required = creatorRequirements({ ...args(), spellChoices: [{ key: "feat:spell", title: "Feat spell", count: 1 }], spellOptions: {} });
  expect(required.find((entry) => entry.id === "feat:spell")?.state).toBe("loading");
  const loaded = creatorRequirements({ ...args(), spellChoices: [{ key: "feat:spell", count: 1 }], spellOptions: { "feat:spell": [{ id: "misty-step" }] } });
  expect(loaded.find((entry) => entry.id === "feat:spell")?.state).toBe("incomplete");
});

it("creator final requirements include duplicate feats and malformed ASIs even after a step jump", () => {
  const base = args();
  const requirements = creatorRequirements({ ...base, levelUpFeatLevels: [8], levelUpFeatConflict: true,
    form: { ...base.form, chosenLevelUpFeats: [{ level: 8, type: "asi", abilityBonuses: { str: -1, con: 3 } }] } });
  expect(requirements.filter(requirementBlocks).map((entry) => entry.id)).toEqual(["level-8-choice", "duplicate-feats"]);
});

it("creator includes untouched secondary classes in the level cap", () => {
  const base = args();
  const requirements = creatorRequirements({ ...base, form: { ...base.form, level: 19 },
    existingClasses: [{ classId: "cleric", level: 8 }, { classId: "wizard", level: 2 }] });
  expect(requirements.filter(requirementBlocks).map((entry) => entry.id)).toContain("character-level");
});

// Preparation is a flag on each spell's entry (shared/domain/spellPreparation).
const preparedNames = (spells: Array<{ name: string; prepared?: boolean }> | undefined) =>
  (spells ?? []).filter((spell) => spell.prepared).map((spell) => spell.name).sort();

it("creator edits preserve actual preparations instead of preparing every stored spell", async () => {
  const form = { ...args().form, chosenSpells: ["bless-id", "aid-id"] };
  const { body } = await buildCreatorSubmissionBody({
    form, classDetail: cleric as never, selectedClassSummary: null, raceDetail: null, bgDetail: null,
    featDetailCache: {}, resolvedRaceFeatDetail: null, resolvedBgOriginFeatDetail: null,
    classFeatDetails: {}, levelUpFeatDetails: [], featSpellChoiceOptions: {}, growthOptionEntriesByKey: {},
    classCantrips: [], classSpells: [{ id: "bless-id", name: "Bless", level: 1 }, { id: "aid-id", name: "Aid", level: 2 }] as never,
    classInvocations: [], isEditing: true,
    existingSpells: [{ id: "bless-id", name: "Bless", prepared: true }, { id: "aid-id", name: "Aid" }],
    existingExtraFeatIds: [], existingInvocationFeatIds: [],
    classifyFeatSelection: () => null, api: async () => { throw new Error("Unexpected lookup"); },
  });
  expect(preparedNames(body.characterData.proficiencies?.spells as never)).toEqual(["Bless"]);
  expect(body.characterData).not.toHaveProperty("preparedSpells");
  expect(Object.values(body.characterData.classSpellSelections)[0]?.chosenSpells).toEqual(form.chosenSpells);
  expect(body.characterData).not.toHaveProperty("chosenSpells");
});


it("creator saves scoped spell choices without replacing another class or imported identity", async () => {
  const form = { ...args().form, chosenCantrips: ["cleric-cantrip"], chosenSpells: ["cleric-spell"] };
  const secondary = { chosenSpells: ["wizard-spell"], chosenCantrips: ["wizard-cantrip"] };
  const shield = { name: "Shield", source: "Wizard", classEntryId: "wizard-entry", sourceKey: "class:wizard-entry", prepared: true };
  const { body } = await buildCreatorSubmissionBody({
    form, classDetail: cleric as never, selectedClassSummary: null, raceDetail: null, bgDetail: null,
    featDetailCache: {}, resolvedRaceFeatDetail: null, resolvedBgOriginFeatDetail: null,
    classFeatDetails: {}, levelUpFeatDetails: [], featSpellChoiceOptions: {}, growthOptionEntriesByKey: {},
    classCantrips: [], classSpells: [], classInvocations: [], isEditing: true,
    existingClasses: [{ id: "imported-cleric", classId: "cleric", level: 8 }, { id: "wizard-entry", classId: "wizard", level: 2 }],
    existingSpells: [shield],
    existingProficiencies: { spells: [shield] } as never,
    existingClassSpellSelections: { "imported-cleric": { chosenSpells: ["old-choice"] }, "wizard-entry": secondary },
    existingExtraFeatIds: [], existingInvocationFeatIds: [],
    classifyFeatSelection: () => null, api: async () => { throw new Error("Unexpected lookup"); },
  });
  expect(body.progressionClassEntryId).toBe("imported-cleric");
  expect(body.characterData.classes.map((entry) => entry.id)).toEqual(["imported-cleric", "wizard-entry"]);
  expect(body.characterData.classSpellSelections["wizard-entry"]).toEqual(secondary);
  expect(body.characterData.classSpellSelections["imported-cleric"]).toMatchObject({ chosenSpells: ["cleric-spell"], chosenCantrips: ["cleric-cantrip"] });
  // The other class's prepared spell survives the primary class being rebuilt.
  expect(preparedNames(body.characterData.proficiencies?.spells as never)).toEqual(["Shield"]);
  const { readClassSpellSelection } = await import("@/domain/character/classSpellSelections");
  const reloaded = JSON.parse(JSON.stringify(body.characterData));
  expect(readClassSpellSelection(reloaded, "imported-cleric").chosenSpells).toEqual(form.chosenSpells);
  expect(readClassSpellSelection(reloaded, "wizard-entry").chosenSpells).toEqual(secondary.chosenSpells);
});

it("new characters persist an initial reversible HP baseline", async () => {
  const form = { ...args().form, level: 1, hpMax: "8", abilityMethod: "pointbuy" as const, pbScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
  const { body } = await buildCreatorSubmissionBody({
    form, classDetail: cleric as never, selectedClassSummary: null, raceDetail: null, bgDetail: null,
    featDetailCache: {}, resolvedRaceFeatDetail: null, resolvedBgOriginFeatDetail: null,
    classFeatDetails: {}, levelUpFeatDetails: [], featSpellChoiceOptions: {}, growthOptionEntriesByKey: {},
    classCantrips: [], classSpells: [], classInvocations: [], isEditing: false,
    existingExtraFeatIds: [], existingInvocationFeatIds: [],
    classifyFeatSelection: () => null, api: async () => { throw new Error("Unexpected lookup"); },
  });
  expect(body.characterData.hpProgressionHistory).toEqual([
    expect.objectContaining({ characterLevelBefore: 0, characterLevelAfter: 1, classLevelAfter: 1, levelHpGain: 8, hpMethod: "average" }),
  ]);
});

it("creator stamps primary ASIs and preserves secondary class feat records", async () => {
  const form = { ...args().form, chosenLevelUpFeats: [{ level: 8, type: "asi" as const, abilityBonuses: { wis: 2 } }] };
  const secondaryFeat = { level: 4, classEntryId: "wizard-entry", classLevel: 4, characterLevel: 12, type: "feat" as const, featId: "observant", abilityBonuses: { int: 1 } };
  const { body } = await buildCreatorSubmissionBody({
    form, classDetail: cleric as never, selectedClassSummary: null, raceDetail: null, bgDetail: null,
    featDetailCache: {}, resolvedRaceFeatDetail: null, resolvedBgOriginFeatDetail: null,
    classFeatDetails: {}, levelUpFeatDetails: [], featSpellChoiceOptions: {}, growthOptionEntriesByKey: {},
    classCantrips: [], classSpells: [], classInvocations: [], isEditing: true,
    existingClasses: [{ id: "cleric-entry", classId: "cleric", level: 8 }, { id: "wizard-entry", classId: "wizard", level: 4 }],
    preservedLevelUpFeats: [secondaryFeat],
    preservedLevelUpFeatOptions: { "levelupfeat:12:observant:skill": ["Investigation"] },
    existingExtraFeatIds: [], existingInvocationFeatIds: [],
    classifyFeatSelection: () => null, api: async () => { throw new Error("Unexpected lookup"); },
  });
  expect(body.characterData.chosenLevelUpFeats).toEqual([
    secondaryFeat,
    expect.objectContaining({ level: 8, classEntryId: "cleric-entry", classLevel: 8, sourceFeatureId: "class:cleric-entry:asi:8", type: "asi" }),
  ]);
  expect(body.intScore).toBe(9);
  expect(body.characterData.chosenFeatOptions["levelupfeat:12:observant:skill"]).toEqual(["Investigation"]);
});

it("creator edits carry the revision they hydrated", async () => {
  const { body } = await buildCreatorSubmissionBody({
    form: args().form, classDetail: cleric as never, selectedClassSummary: null, raceDetail: null, bgDetail: null,
    featDetailCache: {}, resolvedRaceFeatDetail: null, resolvedBgOriginFeatDetail: null,
    classFeatDetails: {}, levelUpFeatDetails: [], featSpellChoiceOptions: {}, growthOptionEntriesByKey: {},
    classCantrips: [], classSpells: [], classInvocations: [], isEditing: true, existingCharacterRevision: 9876,
    existingClasses: [{ id: "cleric-entry", classId: "cleric", level: 8 }], existingExtraFeatIds: [], existingInvocationFeatIds: [],
    classifyFeatSelection: () => null, api: async () => { throw new Error("Unexpected lookup"); },
  });
  expect(body.expectedCharacterRevision).toBe(9876);
});

it("an exact single-class level-down reverses HP history and preserves existing damage", async () => {
  const history = buildInitialHpProgressionHistory({ level: 8, hitDie: 8, constitution: 8, hpMax: 35, classEntryId: "cleric-entry" });
  const { body } = await buildCreatorSubmissionBody({
    form: { ...args().form, level: 7, hpMax: "35" }, classDetail: cleric as never, selectedClassSummary: null, raceDetail: null, bgDetail: null,
    featDetailCache: {}, resolvedRaceFeatDetail: null, resolvedBgOriginFeatDetail: null,
    classFeatDetails: {}, levelUpFeatDetails: [], featSpellChoiceOptions: {}, growthOptionEntriesByKey: {},
    classCantrips: [], classSpells: [], classInvocations: [], isEditing: true,
    existingHpMax: 35, existingHpCurrent: 30, existingHpProgressionHistory: history,
    existingClasses: [{ id: "cleric-entry", classId: "cleric", level: 8 }],
    existingExtraFeatIds: [], existingInvocationFeatIds: [],
    classifyFeatSelection: () => null, api: async () => { throw new Error("Unexpected lookup"); },
  });
  expect(body.hpMax).toBe(31);
  expect(body.hpCurrent).toBe(26);
  expect(body.characterData.hpProgressionHistory?.at(-1)?.characterLevelAfter).toBe(7);
});

it("a reviewed legacy level-down replaces ambiguous HP history with the entered aggregate baseline", async () => {
  const legacyAggregate = buildInitialHpProgressionHistory({ level: 8, hitDie: 8, constitution: 8, hpMax: 40, classEntryId: "cleric-entry", hpMethod: "manual" });
  const { body } = await buildCreatorSubmissionBody({
    form: { ...args().form, level: 7, hpMax: "34" }, classDetail: cleric as never, selectedClassSummary: null, raceDetail: null, bgDetail: null,
    featDetailCache: {}, resolvedRaceFeatDetail: null, resolvedBgOriginFeatDetail: null,
    classFeatDetails: {}, levelUpFeatDetails: [], featSpellChoiceOptions: {}, growthOptionEntriesByKey: {},
    classCantrips: [], classSpells: [], classInvocations: [], isEditing: true,
    existingHpMax: 40, existingHpCurrent: 35, existingHpProgressionHistory: legacyAggregate,
    existingClasses: [{ id: "cleric-entry", classId: "cleric", level: 8 }],
    existingExtraFeatIds: [], existingInvocationFeatIds: [],
    classifyFeatSelection: () => null, api: async () => { throw new Error("Unexpected lookup"); },
  });
  expect(body.hpMax).toBe(34);
  expect(body.hpCurrent).toBe(29);
  expect(body.characterData.hpProgressionHistory).toEqual([
    expect.objectContaining({ characterLevelBefore: 0, characterLevelAfter: 7, baseHpMaxAfter: 34, hpMethod: "manual" }),
  ]);
});
