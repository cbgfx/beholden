import { describe, expect, it } from "vitest";

import { buildMonsterPayload, monsterToForm } from "./MonsterFormSections";
import type { MonsterForEdit } from "./MonsterFormParts";

describe("Monster Grand form conversion", () => {
  it("builds structured Grand fields without JSON text inputs", () => {
    const form = monsterToForm(null, false);
    Object.assign(form, {
      name: "Ash Drake",
      ruleset: "5.5e",
      source: "Homebrew",
      cr: "4",
      xp: "1100",
      typeFull: "dragon",
      alignment: "unaligned",
      ac: "16",
      acSource: "natural armor",
      hpAverage: "68",
      walk: "30",
      fly: "60",
      hover: true,
      saves: [{ name: "DEX", bonus: "5" }],
      skills: [{ name: "Perception", bonus: "4" }],
      actions: [{ name: "Bite", text: "Melee attack.", attack: { toHit: 6, reach: "5 ft.", melee: true }, damage: { roll: "2d10 + 4", type: "piercing" } }],
      legendary: [{ name: "Wing Attack", text: "The drake beats its wings." }],
      legendaryUses: "3",
      lair: [{ name: "Falling Cinders", description: "Cinders fall from the ceiling." }],
      spells: [{ id: "spell_shield", level: 2 }],
    });

    expect(buildMonsterPayload(form, null)).toMatchObject({
      ruleset: "5.5e",
      name: "Ash Drake",
      challenge: { rating: "4", xp: 1100 },
      classification: { size: "M", type: "dragon", description: "dragon", alignment: "unaligned" },
      armorClass: { value: 16, source: "natural armor" },
      hitPoints: { average: 68 },
      movement: { walk: 30, fly: 60, hover: true },
      proficiencies: { savingThrows: [{ name: "DEX", bonus: 5 }], skills: [{ name: "Perception", bonus: 4 }] },
      actions: [{ id: "action_1", name: "Bite", description: "Melee attack.", attack: { toHit: 6, reach: "5 ft.", melee: true }, damage: { roll: "2d10 + 4", type: "piercing" } }],
      legendaryUses: 3,
      lair: [{ name: "Falling Cinders", description: "Cinders fall from the ceiling." }],
      spells: [{ id: "spell_shield", level: 2 }],
    });
  });

  it("round-trips canonical fields used by the editor", () => {
    const monster: MonsterForEdit = {
      id: "m_owl_mage",
      ruleset: "5e",
      name: "Owl Mage",
      classification: { size: "S", type: "humanoid", environment: ["forest"] },
      challenge: { rating: "2", xp: 450 },
      spellcasting: [{ id: "innate", name: "Innate Spellcasting", text: "The mage casts innately.", recharge: { period: "long_rest" } }],
      spells: [{ id: "spell_misty_step" }],
      lair: [{ name: "Moonlit Hall", description: "Dim light fills the hall." }],
      senses: [],
      languages: [],
    };

    const payload = buildMonsterPayload(monsterToForm(monster, false), monster);
    expect(payload).toMatchObject({
      id: "m_owl_mage",
      ruleset: "5e",
      classification: { size: "S", type: "humanoid", environment: ["forest"] },
      spellcasting: [{ id: "innate", name: "Innate Spellcasting", description: "The mage casts innately.", recharge: { period: "long_rest" } }],
      spells: [{ id: "spell_misty_step" }],
      lair: [{ name: "Moonlit Hall", description: "Dim light fills the hall." }],
    });
  });

  it("rejects invalid numeric fields before the request", () => {
    const form = monsterToForm(null, false);
    form.name = "Broken Walker";
    form.walk = "12.5";
    expect(() => buildMonsterPayload(form, null)).toThrow("walk speed must be an integer");
  });
});
