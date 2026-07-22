import { describe, expect, it } from "vitest";
import { multiclassRequirementMet } from "./multiclassEligibility";
import { deriveMulticlassSpellSlots } from "./multiclassSpellcasting";
import { buildLevelUpPayload } from "@/views/level-up/buildLevelUpPayload";
import { buildCharacterViewDerivedState } from "@/views/character/CharacterViewDerivedState";
import { getLongRestRecovery } from "@/views/character/CharacterRestRecovery";
import { collectClassResources, mergeResourceState } from "@/views/character/CharacterViewResourceHelpers";
import { normalizeCharacterTransfer } from "@/views/home/PlayerHomeUtils";
import type { CharacterViewDerivedStateArgs } from "@/views/character/CharacterViewDerivedTypes";
import type { CharacterClassDetailSelection, ClassRestDetail } from "@/views/character/CharacterViewTypes";

function classDetail(args: {
  id: string;
  name: string;
  hd: number;
  spellAbility?: string;
  progression?: "full" | "half" | "pact";
  slots?: number[];
  subclassId?: string;
  subclassName?: string;
  feature?: string;
  resource?: string;
}): ClassRestDetail {
  return {
    id: args.id,
    name: args.name,
    hd: args.hd,
    spellAbility: args.spellAbility ?? null,
    slotsReset: args.progression === "pact" ? "S" : "L",
    multiclass: args.progression ? { spellcasting: { progression: args.progression } } : null,
    subclassDetails: args.subclassId ? { [args.subclassId]: { name: args.subclassName ?? args.subclassId } } : {},
    autolevels: [{
      level: 1,
      slots: args.slots ?? null,
      counters: args.resource ? [{ name: args.resource, value: 1, reset: "S" }] : [],
      features: args.feature ? [{ name: args.feature, text: `${args.name} feature.` }] : [],
    }, {
      level: 20,
      slots: args.slots ?? null,
      counters: [],
    }],
  };
}

function selection(detail: ClassRestDetail, level: number, subclass: string | null = null): CharacterClassDetailSelection {
  const existingLevel = detail.autolevels.find((row) => row.level === level);
  const slotTemplate = detail.autolevels.find((row) => row.slots)?.slots ?? null;
  return {
    entry: { id: `entry_${detail.id}`, classId: detail.id, className: detail.name, level, subclass },
    detail: existingLevel ? detail : {
      ...detail,
      autolevels: [...detail.autolevels, { level, slots: slotTemplate, counters: [] }],
    },
  };
}

function sheetArgs(selections: CharacterClassDetailSelection[]): CharacterViewDerivedStateArgs {
  const level = selections.reduce((sum, item) => sum + item.entry.level, 0);
  return {
    char: {
      id: "regression-character",
      ruleset: "5.5e",
      name: "Regression Character",
      playerName: "Tester",
      className: selections[0]?.detail.name ?? "Adventurer",
      species: "Human",
      level,
      hpMax: 40,
      hpCurrent: 40,
      ac: 15,
      speed: 30,
      strScore: 14,
      dexScore: 14,
      conScore: 14,
      intScore: 16,
      wisScore: 13,
      chaScore: 16,
      color: null,
      imageUrl: null,
      campaigns: [],
      characterData: {
        classes: selections.map(({ entry }) => entry),
        classSpellSelections: Object.fromEntries(selections.map(({ entry }) => [entry.id, {
          chosenCantrips: [], chosenSpells: [], preparedSpells: [], chosenInvocations: [],
        }])),
      },
    },
    classDetail: selections[0]?.detail ?? null,
    classSelections: selections,
    raceDetail: null,
    backgroundDetail: null,
    bgOriginFeatDetail: null,
    raceFeatDetail: null,
    classFeatDetails: [],
    levelUpFeatDetails: [],
    invocationDetails: [],
    extraFeatDetails: [],
    subclass: selections[0]?.entry.subclass ?? null,
    polymorphCondition: null,
    polymorphMonsterState: { monster: null, busy: false, error: null },
  };
}

function levelUp(characterData: Record<string, unknown>, targetId: string, targetName: string, totalLevel: number, classLevel: number) {
  return buildLevelUpPayload({
    char: { hpMax: 40, hpCurrent: 40, className: "Fighter", characterData },
    nextLevel: totalLevel,
    nextClassLevel: classLevel,
    targetClassEntryId: targetId,
    hpGain: 6,
    featHpBonus: 0,
    subclass: "",
    chosenCantrips: [], chosenSpells: [], chosenInvocations: [], chosenExpertise: {}, chosenFeatOptions: {}, chosenFeatureChoices: {},
    expertiseChoices: [], featChoiceEntries: [], chosenFeatDetail: null, featSourceLabel: "", newFeatures: [],
    classDetailName: targetName, selectedCantripEntries: [], selectedSpellEntries: [], selectedInvocationEntries: [],
    baseScores: {}, asiMode: null, asiStats: {}, featAbilityBonuses: {},
  } as never) as { level: number; characterData: Record<string, unknown> & { classes: Array<{ id: string; level: number }> } };
}

describe("multiclass representative characters", () => {
  it("presents Fighter 3 / Wizard 2 with class-owned features, hit dice, and Wizard slots", () => {
    const fighter = classDetail({ id: "fighter", name: "Fighter", hd: 10, subclassId: "champion", subclassName: "Champion", feature: "Second Wind", resource: "Second Wind" });
    const wizard = classDetail({ id: "wizard", name: "Wizard", hd: 6, spellAbility: "int", progression: "full", slots: [0, 3], feature: "Arcane Recovery", resource: "Arcane Recovery" });
    const state = buildCharacterViewDerivedState(sheetArgs([selection(fighter, 3, "champion"), selection(wizard, 2)]));

    expect(state.classPresentation).toEqual([
      expect.objectContaining({ className: "Fighter", classLevel: 3, subclassName: "Champion" }),
      expect.objectContaining({ className: "Wizard", classLevel: 2 }),
    ]);
    expect(state.hitDicePools).toEqual([{ dieSize: 10, max: 3, current: 3 }, { dieSize: 6, max: 2, current: 2 }]);
    expect(state.spellSlotState.sharedSlots).toEqual([0, 3]);
    expect(state.classFeaturesList.map((feature) => feature.id)).toEqual(expect.arrayContaining([
      expect.stringContaining("class:entry_fighter:"), expect.stringContaining("class:entry_wizard:"),
    ]));
    expect(state.classResourcesWithSpellCasts.map((resource) => resource.key)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^class:entry_fighter:/), expect.stringMatching(/^class:entry_wizard:/),
    ]));
  });

  it("combines Paladin 5 / Sorcerer 3 as caster level 5", () => {
    const paladin = selection(classDetail({ id: "paladin", name: "Paladin", hd: 10, spellAbility: "cha", progression: "half" }), 5);
    const sorcerer = selection(classDetail({ id: "sorcerer", name: "Sorcerer", hd: 6, spellAbility: "cha", progression: "full" }), 3);
    expect(deriveMulticlassSpellSlots([paladin, sorcerer])).toMatchObject({ casterLevel: 5, sharedSlots: [0, 4, 3, 2] });
  });

  it("keeps Warlock 2 Pact Magic separate from Bard 4 shared slots", () => {
    const warlock = selection(classDetail({ id: "warlock", name: "Warlock", hd: 8, spellAbility: "cha", progression: "pact", slots: [0, 2] }), 2);
    const bard = selection(classDetail({ id: "bard", name: "Bard", hd: 8, spellAbility: "cha", progression: "full", slots: [0, 4, 3] }), 4);
    const slots = deriveMulticlassSpellSlots([warlock, bard]);
    expect(slots.sharedSlots).toEqual([0, 4, 3]);
    expect(slots.pactPools).toEqual([expect.objectContaining({ classEntryId: "entry_warlock", slots: [0, 2] })]);
  });

  it("supports a non-spellcasting multiclass with two resolved subclasses", () => {
    const fighter = selection(classDetail({ id: "fighter", name: "Fighter", hd: 10, subclassId: "champion", subclassName: "Champion" }), 3, "champion");
    const rogue = selection(classDetail({ id: "rogue", name: "Rogue", hd: 8, subclassId: "thief", subclassName: "Thief" }), 3, "thief");
    const state = buildCharacterViewDerivedState(sheetArgs([fighter, rogue]));
    expect(state.spellSlotState).toEqual({ casterLevel: 0, sharedSlots: null, pactPools: [] });
    expect(state.classPresentation.map((entry) => entry.subclassName)).toEqual(["Champion", "Thief"]);
  });

  it("rejects a character that fails either side of a multiclass prerequisite", () => {
    const scores = { str: 12, dex: 14, con: 14, int: 13, wis: 10, cha: 8 };
    expect(multiclassRequirementMet("str", 13, scores)).toBe(false);
    expect(multiclassRequirementMet("int", 13, scores)).toBe(true);
    expect(multiclassRequirementMet({ all: ["str", "cha"] }, 13, scores)).toBe(false);
  });

  it("preserves every class through repeated level-ups and an export/import JSON round-trip", () => {
    const initial = {
      classes: [
        { id: "entry_fighter", classId: "fighter", className: "Fighter", level: 3 },
        { id: "entry_wizard", classId: "wizard", className: "Wizard", level: 2 },
      ],
      classSpellSelections: { entry_wizard: { preparedSpells: ["shield"], chosenSpells: ["shield"] } },
    };
    const first = levelUp(initial, "entry_wizard", "Wizard", 6, 3);
    const second = levelUp(first.characterData, "entry_fighter", "Fighter", 7, 4);
    const exported = JSON.parse(JSON.stringify({
      name: "Level Tester", className: "Fighter", species: "Human", level: second.level,
      hpMax: 52, hpCurrent: 52, ac: 16, speed: 30, characterData: second.characterData,
    })) as Record<string, unknown>;
    const imported = normalizeCharacterTransfer(exported);
    const data = imported.characterData as typeof initial;

    expect(data.classes).toEqual([
      expect.objectContaining({ id: "entry_fighter", level: 4 }),
      expect.objectContaining({ id: "entry_wizard", level: 3 }),
    ]);
    expect(data.classSpellSelections.entry_wizard.preparedSpells).toEqual(["shield"]);
  });

  it("restores hit dice and class-scoped resources without merging their ownership", () => {
    expect(getLongRestRecovery(8, 2)).toEqual({ hitDiceCurrent: 8, exhaustion: 1 });
    const fighter = classDetail({ id: "fighter", name: "Fighter", hd: 10, resource: "Second Wind" });
    const wizard = classDetail({ id: "wizard", name: "Wizard", hd: 6, resource: "Arcane Recovery" });
    const definitions = [
      ...collectClassResources(fighter, 3, null, "entry_fighter"),
      ...collectClassResources(wizard, 2, null, "entry_wizard"),
    ];
    const merged = mergeResourceState(definitions.map((resource) => ({ ...resource, current: 0 })), definitions);
    expect(merged.map((resource) => resource.key)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^class:entry_fighter:/), expect.stringMatching(/^class:entry_wizard:/),
    ]));
    expect(merged.every((resource) => resource.current === 0)).toBe(true);
  });
});
