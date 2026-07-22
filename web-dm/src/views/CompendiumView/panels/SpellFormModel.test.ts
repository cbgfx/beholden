import { describe, expect, it } from "vitest";
import { buildSpellPayload, emptySpellForm, spellToForm, type SpellForEdit } from "./SpellFormModel";

describe("Spell Grand form conversion", () => {
  it("builds every structured spell fact", () => {
    const form = emptySpellForm();
    Object.assign(form, { name: "Storm Burst", source: "Homebrew", level: "3", school: "Evocation", time: "1 action", range: "120 feet", duration: "Up to 1 minute", concentration: true, ritual: true, verbal: true, somatic: true, material: true, materialText: "a copper wire", access: ["sl_sorcerer", "sl_wizard"], check: "dex", text: "Lightning erupts.\n\nA target takes damage.", rolls: [{ formula: "4d8", effects: ["lightning", "thunder"], description: "Burst damage", level: "3" }] });
    expect(buildSpellPayload(form, null)).toEqual({ ruleset: "5.5e", name: "Storm Burst", source: "Homebrew", level: 3, school: "Evocation", casting: { time: "1 action", range: "120 feet", components: { verbal: true, somatic: true, material: "a copper wire" }, duration: { description: "Up to 1 minute", concentration: true } }, ritual: true, access: ["sl_sorcerer", "sl_wizard"], check: "dex", rolls: [{ formula: "4d8", effect: ["lightning", "thunder"], description: "Burst damage", level: 3 }], description: ["Lightning erupts.", "A target takes damage."] });
  });

  it("round-trips canonical spell fields", () => {
    const spell: SpellForEdit = { id: "s_light", ruleset: "5e", name: "Light", level: 0, school: "Evocation", casting: { components: { verbal: true, material: true }, duration: { concentration: true } }, ritual: true, access: ["sl_wizard"], check: "attack", rolls: [{ formula: "1d8", effect: "radiant", level: 5 }], description: ["Bright light."] };
    expect(buildSpellPayload(spellToForm(spell), spell)).toMatchObject(spell);
  });

  it("rejects invalid mixed healing and damage effects", () => {
    const form = emptySpellForm(); form.name = "Broken"; form.text = "Broken."; form.rolls = [{ formula: "1d8", effects: ["healing", "fire"], description: "", level: "" }];
    expect(() => buildSpellPayload(form, null)).toThrow("cannot combine healing");
  });
});
