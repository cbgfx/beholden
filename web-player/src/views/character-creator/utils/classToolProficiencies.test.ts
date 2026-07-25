/**
 * Tests for class tool proficiency handling in the Character Creator.
 *
 * Covers:
 *  - Bard:     3 Musical Instruments choice
 *  - Monk:     1 from Artisan's Tools OR Musical Instruments (merged pool)
 *  - Artificer: fixed Thieves' Tools + Tinker's Tools, then 1 Artisan's Tool choice
 *  - Duplicate prevention: already-taken tool is blocked
 */

import { describe, expect, it } from "vitest";
import { buildProficiencyMap } from "./CharacterCreatorProficiencyUtils";
import { getStep5ChoiceState } from "./CharacterCreatorStep5Utils";
import type { ClassToolProficiencyLike } from "./CharacterCreatorStep5Utils";

// ── Shared fixtures ──────────────────────────────────────────────────────────

const MUSICAL_INSTRUMENTS = [
  "Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre",
  "Horn", "Pan Flute", "Shawm", "Viol",
];

const ARTISAN_TOOLS = [
  "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies",
  "Carpenter's Tools", "Cobbler's Tools", "Cook's Utensils",
  "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools",
  "Mason's Tools", "Painter's Supplies", "Potter's Tools",
  "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools",
];

const BARD_TOOLS: ClassToolProficiencyLike = {
  fixed: [],
  choices: [{ count: 3, from: MUSICAL_INSTRUMENTS }],
  notes: [],
};

const MONK_TOOLS: ClassToolProficiencyLike = {
  fixed: [],
  choices: [{ count: 1, from: [...ARTISAN_TOOLS, ...MUSICAL_INSTRUMENTS] }],
  notes: [],
};

const ARTIFICER_TOOLS: ClassToolProficiencyLike = {
  fixed: ["Thieves' Tools", "Tinker's Tools"],
  choices: [{ count: 1, from: ARTISAN_TOOLS }],
  notes: [],
};

function makeBaseForm(overrides: Partial<{
  chosenClassTools: string[];
  chosenBgTools: string[];
  chosenRaceTools: string[];
}> = {}) {
  return {
    level: 1,
    subclass: null,
    chosenSkills: [],
    chosenClassLanguages: [],
    chosenClassTools: overrides.chosenClassTools ?? [],
    chosenWeaponMasteries: [],
    chosenOptionals: [],
    chosenFeatOptions: {},
    chosenFeatureChoices: {},
    chosenBgSkills: [],
    chosenBgTools: overrides.chosenBgTools ?? [],
    chosenBgLanguages: [],
    chosenRaceSkills: [],
    chosenRaceLanguages: [],
    chosenRaceTools: overrides.chosenRaceTools ?? [],
    chosenCantrips: [],
    chosenSpells: [],
    chosenInvocations: [],
    chosenBgEquipmentOption: null,
    chosenClassEquipmentOption: null,
  };
}

function makeClassDetail(tools: ClassToolProficiencyLike | undefined) {
  return {
    name: "Test Class",
    armor: "",
    weapons: "",
    tools: "",
    proficiency: "",
    proficiencies: tools ? { tools } : undefined,
    autolevels: [],
  };
}

function makeStep5FormArgs(classToolProficiency: ClassToolProficiencyLike | null, overrides: Partial<{
  chosenClassTools: string[];
  chosenBgTools: string[];
  chosenRaceTools: string[];
}> = {}) {
  const form = {
    chosenSkills: [],
    chosenRaceSkills: [],
    chosenRaceTools: overrides.chosenRaceTools ?? [],
    chosenRaceLanguages: [],
    chosenBgTools: overrides.chosenBgTools ?? [],
    chosenBgLanguages: [],
    chosenClassLanguages: [],
    chosenClassTools: overrides.chosenClassTools ?? [],
    chosenClassFeatIds: {},
    chosenFeatOptions: {},
    chosenWeaponMasteries: [],
  };
  return {
    form,
    bgDetail: null,
    bgOriginFeatDetail: null,
    bgSkillFixed: [],
    bgToolFixed: [],
    classToolProficiency,
    classFeatChoices: [],
    classFeatDetails: {},
    raceFeatDetail: null,
    levelUpFeatDetails: [],
    classLanguageChoice: null,
    coreLanguageChoice: null,
    classExpertiseChoices: [],
    weaponMasteryChoice: null,
    weaponOptions: [],
  };
}

// ── buildProficiencyMap tests ────────────────────────────────────────────────

describe("buildProficiencyMap – class tool proficiency", () => {
  const BASE_MAP_ARGS = {
    classCantrips: [],
    classSpells: [],
    classInvocations: [],
    bgOriginFeatDetail: null,
    raceFeatDetail: null,
    classFeatDetails: {},
    levelUpFeatDetails: [],
  };

  it("Artificer: fixed tools appear without any form selection", () => {
    const form = makeBaseForm();
    const classDetail = makeClassDetail(ARTIFICER_TOOLS);
    const map = buildProficiencyMap({ ...BASE_MAP_ARGS, form, classDetail, raceDetail: null, bgDetail: null });
    const toolNames = map.tools.map((t) => t.name);
    expect(toolNames).toContain("Thieves' Tools");
    expect(toolNames).toContain("Tinker's Tools");
  });

  it("Artificer: selected artisan tool choice appears in proficiency map", () => {
    const form = makeBaseForm({ chosenClassTools: ["Smith's Tools"] });
    const classDetail = makeClassDetail(ARTIFICER_TOOLS);
    const map = buildProficiencyMap({ ...BASE_MAP_ARGS, form, classDetail, raceDetail: null, bgDetail: null });
    const toolNames = map.tools.map((t) => t.name);
    expect(toolNames).toContain("Smith's Tools");
  });

  it("Artificer: unselected choice tools do NOT appear in proficiency map", () => {
    const form = makeBaseForm({ chosenClassTools: [] });
    const classDetail = makeClassDetail(ARTIFICER_TOOLS);
    const map = buildProficiencyMap({ ...BASE_MAP_ARGS, form, classDetail, raceDetail: null, bgDetail: null });
    const toolNames = map.tools.map((t) => t.name);
    expect(toolNames).not.toContain("Smith's Tools");
  });

  it("Bard: 3 selected musical instruments appear in proficiency map", () => {
    const form = makeBaseForm({ chosenClassTools: ["Lute", "Flute", "Lyre"] });
    const classDetail = makeClassDetail(BARD_TOOLS);
    const map = buildProficiencyMap({ ...BASE_MAP_ARGS, form, classDetail, raceDetail: null, bgDetail: null });
    const toolNames = map.tools.map((t) => t.name);
    expect(toolNames).toContain("Lute");
    expect(toolNames).toContain("Flute");
    expect(toolNames).toContain("Lyre");
  });

  it("Bard: class is the source for selected instruments", () => {
    const form = makeBaseForm({ chosenClassTools: ["Lute"] });
    const classDetail = makeClassDetail(BARD_TOOLS);
    const map = buildProficiencyMap({ ...BASE_MAP_ARGS, form, classDetail, raceDetail: null, bgDetail: null });
    const luteEntry = map.tools.find((t) => t.name === "Lute");
    expect(luteEntry?.source).toBe("Test Class");
  });

  it("Monk: selected tool from merged pool appears in proficiency map", () => {
    const form = makeBaseForm({ chosenClassTools: ["Drum"] });
    const classDetail = makeClassDetail(MONK_TOOLS);
    const map = buildProficiencyMap({ ...BASE_MAP_ARGS, form, classDetail, raceDetail: null, bgDetail: null });
    expect(map.tools.map((t) => t.name)).toContain("Drum");
  });

  it("includes fixed language grants from structured species traits", () => {
    const form = makeBaseForm();
    const raceDetail = {
      id: "r_dragonborn",
      name: "Dragonborn",
      traits: [{
        name: "Languages",
        text: "You know Common and Draconic.",
        modifier: [],
        effects: [{ type: "proficiency_grant", category: "language", grants: ["Common", "Draconic"] }],
      }],
    };
    const map = buildProficiencyMap({ ...BASE_MAP_ARGS, form, classDetail: null, raceDetail, bgDetail: null });

    expect(map.languages.map((entry) => entry.name)).toEqual(["Common", "Draconic"]);
  });

});

// ── getStep5ChoiceState – takenToolKeys and missingClassToolChoices ──────────

describe("getStep5ChoiceState – class tool proficiency", () => {
  it("Artificer fixed tools appear in takenToolKeys", () => {
    const args = makeStep5FormArgs(ARTIFICER_TOOLS);
    const state = getStep5ChoiceState(args);
    // Fixed tools should be counted as taken even without a user selection.
    // normalizeChoiceKey strips apostrophes and merges adjacent separators:
    //   "Thieves' Tools" → "thieves tools" (apostrophe+space merged)
    //   "Tinker's Tools" → "tinker s tools" (apostrophe replaced by space, "s" stays)
    expect(state.takenToolKeys.has("thieves tools")).toBe(true);
    expect(state.takenToolKeys.has("tinker s tools")).toBe(true);
  });

  it("Bard: missingClassToolChoices is true when 0/3 instruments chosen", () => {
    const args = makeStep5FormArgs(BARD_TOOLS, { chosenClassTools: [] });
    const state = getStep5ChoiceState(args);
    expect(state.missingClassToolChoices).toBe(true);
  });

  it("Bard: missingClassToolChoices is true when only 2/3 instruments chosen", () => {
    const args = makeStep5FormArgs(BARD_TOOLS, { chosenClassTools: ["Lute", "Flute"] });
    const state = getStep5ChoiceState(args);
    expect(state.missingClassToolChoices).toBe(true);
  });

  it("Bard: missingClassToolChoices is false when all 3 instruments chosen", () => {
    const args = makeStep5FormArgs(BARD_TOOLS, { chosenClassTools: ["Lute", "Flute", "Lyre"] });
    const state = getStep5ChoiceState(args);
    expect(state.missingClassToolChoices).toBe(false);
  });

  it("Artificer: missingClassToolChoices is true before the artisan tool is chosen", () => {
    const args = makeStep5FormArgs(ARTIFICER_TOOLS, { chosenClassTools: [] });
    const state = getStep5ChoiceState(args);
    expect(state.missingClassToolChoices).toBe(true);
  });

  it("Artificer: missingClassToolChoices is false after artisan tool is chosen", () => {
    const args = makeStep5FormArgs(ARTIFICER_TOOLS, { chosenClassTools: ["Smith's Tools"] });
    const state = getStep5ChoiceState(args);
    expect(state.missingClassToolChoices).toBe(false);
  });

  it("duplicate prevention: selected class tool appears in takenToolKeys", () => {
    const args = makeStep5FormArgs(MONK_TOOLS, { chosenClassTools: ["Drum"] });
    const state = getStep5ChoiceState(args);
    expect(state.takenToolKeys.has("drum")).toBe(true);
  });

  it("duplicate prevention: bg tool and class tool pool overlap is tracked correctly", () => {
    // If the background grants "Drum" and Monk tries to pick "Drum" again,
    // takenToolKeys prevents the duplicate.
    const args = makeStep5FormArgs(MONK_TOOLS, {
      chosenClassTools: [],
      chosenBgTools: ["Drum"],
    });
    const state = getStep5ChoiceState(args);
    expect(state.takenToolKeys.has("drum")).toBe(true);
  });

  it("no class tool proficiency: missingClassToolChoices is always false", () => {
    const args = makeStep5FormArgs(null);
    const state = getStep5ChoiceState(args);
    expect(state.missingClassToolChoices).toBe(false);
  });

  it("classToolProficiency is passed through to the returned state", () => {
    const args = makeStep5FormArgs(BARD_TOOLS, { chosenClassTools: ["Lute", "Flute", "Lyre"] });
    const state = getStep5ChoiceState(args);
    expect(state.classToolProficiency).toBe(BARD_TOOLS);
  });
});
