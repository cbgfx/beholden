import { describe, expect, it, vi } from "vitest";

import {
  buildResolvedSpellChoiceEntry,
  loadSpellChoiceOptions,
  type SharedResolvedSpellChoiceEntry,
} from "./SpellChoiceUtils";
import { resolveFeatSpellEntries } from "./FeatSpellcastingUtils";

function magicalDiscoveriesChoice(maxLevel: number): SharedResolvedSpellChoiceEntry {
  return {
    key: "classfeature:magical-discoveries",
    title: "Bonus Spell",
    sourceLabel: "Level 6: Magical Discoveries (College of Lore)",
    count: 2,
    level: null,
    maxLevel,
    listNames: ["Cleric", "Druid", "Wizard"],
  };
}

describe("loadSpellChoiceOptions", () => {
  it("caps any-level class feature searches to the highest available spell slot", async () => {
    const queries: string[] = [];
    const fetchSpells = vi.fn(async (query: string) => {
      queries.push(query);
      return [];
    });

    await loadSpellChoiceOptions([magicalDiscoveriesChoice(3)], fetchSpells);

    expect(queries).toHaveLength(3);
    for (const query of queries) {
      const params = new URL(query, "http://beholden.local").searchParams;
      expect(params.get("maxLevel")).toBe("3");
      expect(params.has("level")).toBe(false);
    }
  });

  it("restricts Blessed Warrior choices to Cleric cantrips", () => {
    const choice = buildResolvedSpellChoiceEntry({
      key: "classfeat:Fighting Style:named_cantrip_choice_1",
      choice: {
        id: "named_cantrip_choice_1",
        count: 2,
        options: ["Cleric"],
        level: 0,
      },
      level: 1,
      sourceLabel: "Fighting Style: Blessed Warrior",
      chosenOptions: {},
    });

    expect(choice.listNames).toEqual(["Cleric"]);
    expect(choice.level).toBe(0);
    expect(choice.count).toBe(2);
  });

  it("tags Blessed Warrior cantrips with Charisma", () => {
    const entries = resolveFeatSpellEntries({
      feat: {
        name: "Fighting Style: Blessed Warrior",
        parsed: {
          grants: {
            skills: [],
            tools: [],
            languages: [],
            armor: [],
            weapons: [],
            savingThrows: [],
            spells: [],
            cantrips: [],
            abilityIncreases: {},
          },
          choices: [{
            id: "named_cantrip_choice_1",
            type: "spell",
            count: 2,
            options: ["Cleric"],
            level: 0,
          }],
          spellcastingAbility: "cha",
        },
      },
      selectedChoices: {
        named_cantrip_choice_1: ["spell:sacred-flame"],
      },
      spellChoiceOptionsByKey: {
        named_cantrip_choice_1: [{ id: "spell:sacred-flame", name: "Sacred Flame" }],
      },
    });

    expect(entries).toEqual([
      expect.objectContaining({ name: "Sacred Flame", ability: "cha" }),
    ]);
  });
});
